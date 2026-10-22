using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Thao tác của nhân viên (S02–S05, S09) và quản lý (M03, M05–M07). Mỗi thao tác lưu trong một lần SaveChanges
/// (một giao dịch) và ghi activity_logs. Điều kiện chặn giống src/ops/reducer.js (có test ở giao diện).
/// </summary>
public partial class FacilityOpsService
{
    private static readonly Regex DocNumberPattern = new(@"^\d{9}$|^\d{12}$|^[A-Z]\d{7}$", RegexOptions.IgnoreCase);
    private static readonly string[] TicketNextStates = ["IN_PROGRESS", "WAITING_CUSTOMER", "DONE"];

    // ------------------------------------------------------------------
    // Tải thực thể trong cơ sở được phân công (khác cơ sở → 404, không lộ dữ liệu)
    // ------------------------------------------------------------------
    private async Task<Reservation> ReservationAsync(long facilityId, string code, CancellationToken ct)
    {
        var id = ParseCode(code, "SS-", "đơn đặt chỗ");
        return await dbContext.Reservations
                   .Include(r => r.UnitType)
                   .Include(r => r.UnitAssignments)
                   .FirstOrDefaultAsync(r => r.ReservationId == id && r.FacilityId == facilityId, ct)
               ?? throw new KeyNotFoundException("Không tìm thấy đơn đặt chỗ tại cơ sở của bạn.");
    }

    private async Task<HandoverRecord> HandoverAsync(long facilityId, string code, string prefix, CancellationToken ct)
    {
        var id = ParseCode(code, prefix, prefix == "XM-" ? "lịch xác minh" : "lịch nhận chìa khóa");
        return await dbContext.HandoverRecords
                   .Include(h => h.Contract).ThenInclude(c => c.Unit)
                   .Include(h => h.Contract).ThenInclude(c => c.Reservation)
                   .Include(h => h.Contract).ThenInclude(c => c.AccessCredentials)
                   .FirstOrDefaultAsync(h => h.HandoverId == id && h.Contract.Unit.FacilityId == facilityId, ct)
               ?? throw new KeyNotFoundException("Không tìm thấy lịch nhận chìa khóa tại cơ sở của bạn.");
    }

    private async Task<ReturnInspection> InspectionAsync(long facilityId, string code, CancellationToken ct)
    {
        var id = ParseCode(code, "TK-", "lịch trả kho");
        return await dbContext.ReturnInspections
                   .Include(i => i.Contract).ThenInclude(c => c.Unit)
                   .Include(i => i.Contract).ThenInclude(c => c.AccessCredentials)
                   .FirstOrDefaultAsync(i => i.InspectionId == id && i.Contract.Unit.FacilityId == facilityId, ct)
               ?? throw new KeyNotFoundException("Không tìm thấy lịch trả kho tại cơ sở của bạn.");
    }

    private async Task<SupportTicket> TicketAsync(long facilityId, string code, CancellationToken ct)
    {
        var id = ParseCode(code, "HT-", "yêu cầu hỗ trợ");
        return await dbContext.SupportTickets
                   .FirstOrDefaultAsync(t => t.TicketId == id
                                             // Code cũ được giữ để đối chiếu.
                                             // && ((t.Unit != null && t.Unit.FacilityId == facilityId)
                                             //     || (t.Contract != null && t.Contract.Unit.FacilityId == facilityId)), ct)
                                             // Ưu tiên cơ sở của hợp đồng để liên kết ô sai trong dữ liệu cũ không mở quyền cho cơ sở khác.
                                             && (t.Contract != null ? t.Contract.Unit.FacilityId == facilityId
                                                 : t.Unit != null && t.Unit.FacilityId == facilityId), ct)
               ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu hỗ trợ tại cơ sở của bạn.");
    }

    private async Task<RentalContract> ContractAsync(long facilityId, string code, CancellationToken ct)
    {
        var id = ParseCode(code, "HĐ-", "hợp đồng");
        return await dbContext.RentalContracts
                   .Include(c => c.Unit)
                   .Include(c => c.Payments)
                   .Include(c => c.ReturnInspections)
                   .Include(c => c.OverdueCases)
                   .Include(c => c.AccessCredentials)
                   .FirstOrDefaultAsync(c => c.ContractId == id && c.Unit.FacilityId == facilityId, ct)
               ?? throw new KeyNotFoundException("Không tìm thấy hợp đồng tại cơ sở của bạn.");
    }

    // =====================================================================
    // S09 · Đối soát chuyển khoản
    // =====================================================================
    public async Task ConfirmPaymentAsync(OpsActor actor, string id, CancellationToken ct = default)
    {
        await new StaffService(dbContext).ConfirmPaymentAsync(actor.UserId, id, ct);
    }

    public async Task ReportMismatchAsync(OpsActor actor, string id, OpsNoteRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var r = await ReservationAsync(facility.FacilityId, id, ct);
        if (r.Status != "PENDING_VERIFICATION") throw new InvalidOperationException("Khoản này đã được xử lý.");
        var note = Clip(request.Note, 500);
        if (note.Length == 0) throw new ArgumentException("Vui lòng ghi rõ sai lệch (số tiền, nội dung hoặc thời gian).");

        var last = await dbContext.ActivityLogs
            .Where(l => l.EntityType == LogEntity.Reservation && l.EntityId == r.ReservationId
                        && (l.Action == LogAction.PaymentMismatch || l.Action == LogAction.TransferReported))
            .OrderByDescending(l => l.LoggedAt)
            .FirstOrDefaultAsync(ct);
        if (last?.Action == LogAction.PaymentMismatch) throw new InvalidOperationException("Khoản này đã được xử lý.");

        // Đơn vẫn chờ đối soát; quản lý liên hệ khách rồi nhân viên xác nhận lại khi đã khớp
        Log(actor.UserId, LogAction.PaymentMismatch, LogEntity.Reservation, r.ReservationId, new { note });
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // S02 · Xác minh khách khi đến nhận kho — chỉ lưu 4 số cuối giấy tờ
    // =====================================================================
    public async Task VerifyCustomerAsync(OpsActor actor, string id, OpsVerifyRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var h = await HandoverAsync(facility.FacilityId, id, "XM-", ct);
        if (h.Contract.Status is not ("ACTIVE" or "EXPIRING")) throw new InvalidOperationException("Cần thanh toán và được cấp hợp đồng trước khi nhận chìa khóa.");
        if (h.Status != "SCHEDULED") throw new InvalidOperationException("Khách hàng này đã được xác minh.");

        var docNumber = (request.DocNumber ?? string.Empty).Trim();
        if (!DocNumberPattern.IsMatch(docNumber))
        {
            throw new ArgumentException("Số giấy tờ gồm 9 hoặc 12 chữ số (CCCD/CMND) hoặc 1 chữ + 7 số (hộ chiếu).");
        }
        if (!request.PhotoMatched || !request.InfoMatched)
        {
            throw new ArgumentException("Đánh dấu cả hai mục đối chiếu trước khi xác minh.");
        }

        var docType = Clip(request.DocType, 50);
        h.Status = "VERIFIED";
        h.VerifiedAt = NowUtc;
        if (!actor.IsManager) h.StaffId = actor.UserId;
        Log(actor.UserId, LogAction.CustomerVerified, LogEntity.Handover, h.HandoverId,
            new { docType = docType.Length > 0 ? docType : "Căn cước công dân", docLast4 = docNumber[^4..] });
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // S03 · Bàn giao kho + cấp phương thức mở khoá
    // =====================================================================
    public Task CompleteHandoverAsync(OpsActor actor, string id, OpsHandoverRequest request, CancellationToken ct = default) =>
        RecordKeyReceiptAsync(actor, id, ct);

    public async Task RecordKeyReceiptAsync(OpsActor actor, string id, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        // Serialize repeated receipt requests without changing credentials or contract dates/status.
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"key-receipt:{facility.FacilityId}:{id}", ct);
        var h = await HandoverAsync(facility.FacilityId, id, "BG-", ct);
        if (h.Status == "HANDED_OVER") { await tx.CommitAsync(ct); return; }
        if (h.Status != "VERIFIED") throw new InvalidOperationException("Cần xác minh giấy tờ trước khi nhận chìa khóa.");
        if (h.Contract.Status is not ("ACTIVE" or "EXPIRING"))
            throw new InvalidOperationException("Hợp đồng chưa được cấp hoặc không còn hiệu lực.");
        await ReservationSettlement.RequirePaidAsync(dbContext, h.Contract.Reservation, ct);
        h.Status = "HANDED_OVER";
        h.HandoverAt = NowUtc;
        h.StaffId = actor.UserId;
        h.StaffConfirmed = true;
        h.CustomerConfirmed = true;
        h.Notes = "Khách nhận 01 chìa khóa vật lý tại quầy";
        if (!h.Contract.AccessCredentials.Any(c => c.CredentialType == "KEY" && c.Status == "ACTIVE"))
            h.Contract.AccessCredentials.Add(new AccessCredential { UnitId = h.Contract.UnitId, IssuedBy = actor.UserId,
                CredentialType = "KEY", CredentialReference = $"KEY-{h.HandoverId}-{Guid.NewGuid():N}", IssuedAt = NowUtc, Status = "ACTIVE" });
        Log(actor.UserId, "PHYSICAL_KEY_RECEIVED", LogEntity.Handover, h.HandoverId, new { quantity = 1 });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    // =====================================================================
    // S04 · Kiểm tra trả kho → chờ quản lý xác nhận hoàn cọc
    // =====================================================================
    public async Task SubmitReturnInspectionAsync(OpsActor actor, string id, OpsReturnInspectionRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var i = await InspectionAsync(facility.FacilityId, id, ct);
        if (i.Status == "COMPLETED") throw new InvalidOperationException("Biên bản trả kho đã được gửi.");
        if (i.Status == "CANCELLED") throw new InvalidOperationException("Lịch trả kho đã huỷ.");

        var items = Clip(request.Items, 500);
        var walls = Clip(request.Walls, 500);
        var keys = Clip(request.Keys, 500);
        var proposal = Clip(request.Proposal, 500);
        if (items.Length == 0 || walls.Length == 0 || keys.Length == 0 || proposal.Length == 0)
        {
            throw new ArgumentException("Điền đủ 4 mục kiểm tra trước khi gửi biên bản.");
        }

        var now = NowUtc;
        i.Status = "COMPLETED";
        i.InspectedAt = now;
        i.DamageDescription = walls;
        i.Notes = $"Đồ đạc còn lại: {items}\nTường, sàn, cửa: {walls}\nChìa khoá, thẻ: {keys}\nĐề xuất: {proposal}";
        if (!actor.IsManager) i.StaffId = actor.UserId;

        var contract = i.Contract;
        if (contract.Status is "ACTIVE" or "EXPIRING" or "OVERDUE") contract.Status = "RETURN_PENDING";
        SetUnitStatus(contract.Unit, "INSPECTION", actor.UserId, $"Khách trả kho · {ReturnCode(i.InspectionId)}");
        foreach (var cred in contract.AccessCredentials.Where(a => a.Status == "ACTIVE"))
        {
            cred.Status = "RETURNED";
            cred.ReturnedAt = now;
        }
        Log(actor.UserId, LogAction.ReturnInspected, LogEntity.Return, i.InspectionId, new { items, walls, keys, proposal });
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // S05 · Phản hồi yêu cầu hỗ trợ
    // =====================================================================
    public async Task RespondTicketAsync(OpsActor actor, string id, OpsTicketResponseRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var t = await TicketAsync(facility.FacilityId, id, ct);
        if (t.Status is "CLOSED" or "CANCELLED") throw new InvalidOperationException("Yêu cầu đã đóng.");
        var note = Clip(request.Note, 1000);
        if (note.Length == 0) throw new ArgumentException("Ghi nhận nội dung xử lý trước khi lưu.");
        var next = (request.NextStatus ?? string.Empty).Trim().ToUpperInvariant();
        if (!TicketNextStates.Contains(next)) throw new ArgumentException("Chọn trạng thái tiếp theo.");

        var now = NowUtc;
        if (t.AssignedStaffId == null)
        {
            t.AssignedStaffId = actor.UserId;
            t.AssignedAt = now;
        }
        switch (next)
        {
            case "IN_PROGRESS":
                t.Status = "IN_PROGRESS";
                break;
            case "WAITING_CUSTOMER": // đã xử lý, chờ khách xác nhận
                t.Status = "RESOLVED";
                t.ResolvedAt = now;
                break;
            default: // DONE
                t.Status = "CLOSED";
                t.ResolvedAt ??= now;
                t.ClosedAt = now;
                break;
        }
        Log(actor.UserId, LogAction.TicketResponse, LogEntity.Ticket, t.TicketId, new { note, status = next, staff = StaffCode(actor.UserId) });
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // M05 · Phân bổ ô cho đơn đã đối soát → hợp đồng nháp + lịch xác minh / bàn giao
    // =====================================================================
    public async Task AllocateAsync(OpsActor actor, string id, OpsAllocateRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var r = await ReservationAsync(facility.FacilityId, id, ct);
        await ReservationAllocation.AllocateAsync(dbContext, actor.UserId, facility.FacilityId, r.ReservationId, request.UnitCode ?? "", ct);
    }

    // =====================================================================
    // M06 · Giao việc bàn giao / trả kho / hỗ trợ cho nhân viên cùng cơ sở
    // =====================================================================
    public async Task AssignAsync(OpsActor actor, string id, OpsAssignRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var staff = await FacilityStaffAsync(facility.FacilityId, ct);
        var staffUser = staff.FirstOrDefault(u => StaffCode(u.UserId) == (request.StaffId ?? string.Empty).Trim())
                        ?? throw new ArgumentException("Chọn nhân viên phụ trách.");

        var reference = (id ?? string.Empty).Trim();
        if (reference.StartsWith("PC-", StringComparison.OrdinalIgnoreCase)) reference = reference[3..];

        if (reference.StartsWith("BG-", StringComparison.OrdinalIgnoreCase))
        {
            var h = await HandoverAsync(facility.FacilityId, reference, "BG-", ct);
            if (h.Status is "HANDED_OVER" or "CANCELLED") throw new InvalidOperationException("Công việc đã hoàn tất.");
            h.StaffId = staffUser.UserId;
            Log(actor.UserId, LogAction.TaskAssigned, LogEntity.Handover, h.HandoverId, new { staff = StaffCode(staffUser.UserId) });
        }
        else if (reference.StartsWith("TK-", StringComparison.OrdinalIgnoreCase))
        {
            var i = await InspectionAsync(facility.FacilityId, reference, ct);
            if (i.Status is "COMPLETED" or "CANCELLED") throw new InvalidOperationException("Công việc đã hoàn tất.");
            i.StaffId = staffUser.UserId;
            Log(actor.UserId, LogAction.TaskAssigned, LogEntity.Return, i.InspectionId, new { staff = StaffCode(staffUser.UserId) });
        }
        else if (reference.StartsWith("HT-", StringComparison.OrdinalIgnoreCase))
        {
            var t = await TicketAsync(facility.FacilityId, reference, ct);
            if (t.Status is "RESOLVED" or "CLOSED" or "CANCELLED") throw new InvalidOperationException("Công việc đã hoàn tất.");
            t.AssignedStaffId = staffUser.UserId;
            t.AssignedAt = NowUtc;
            if (t.Status == "OPEN") t.Status = "ASSIGNED";
            Log(actor.UserId, LogAction.TaskAssigned, LogEntity.Ticket, t.TicketId, new { staff = StaffCode(staffUser.UserId) });
        }
        else
        {
            throw new KeyNotFoundException("Không tìm thấy công việc.");
        }
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // M03 · Duyệt / từ chối gia hạn
    // =====================================================================
    private async Task<ContractRenewal> RenewalAsync(long facilityId, string code, CancellationToken ct)
    {
        var id = ParseCode(code, "GH-", "yêu cầu gia hạn");
        return await dbContext.ContractRenewals
                   .Include(r => r.Contract).ThenInclude(c => c.Unit)
                   .FirstOrDefaultAsync(r => r.RenewalId == id && r.Contract.Unit.FacilityId == facilityId, ct)
               ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn tại cơ sở của bạn.");
    }

    public async Task ApproveRenewalAsync(OpsActor actor, string id, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var r = await RenewalAsync(facility.FacilityId, id, ct);
        if (r.Status != "PENDING") throw new InvalidOperationException("Yêu cầu này đã được xử lý.");
        var contract = r.Contract;
        if (contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE"))
        {
            throw new InvalidOperationException("Hợp đồng không còn hiệu lực để gia hạn.");
        }

        var now = NowUtc;
        r.Status = "APPROVED";
        r.ApprovedBy = actor.UserId;
        r.ApprovedAt = now;
        contract.EndDate = r.NewEndDate;
        if (contract.Status is "EXPIRING" or "OVERDUE") contract.Status = "ACTIVE";

        // Khoản gia hạn khách cần thanh toán (hiện ở "Thanh toán" của khách)
        dbContext.Payments.Add(new Payment
        {
            ContractId = contract.ContractId, RenewalId = r.RenewalId, PaymentType = "RENEWAL", Amount = r.RenewalAmount,
            Currency = "VND", PaymentMethod = "BANK_TRANSFER", DueDate = r.OldEndDate, Status = "PENDING",
            CreatedAt = now, UpdatedAt = now
        });
        Log(actor.UserId, LogAction.RenewalApproved, LogEntity.Renewal, r.RenewalId, new { newEndDate = r.NewEndDate.ToString("yyyy-MM-dd") });
        await dbContext.SaveChangesAsync(ct);
    }

    public async Task RejectRenewalAsync(OpsActor actor, string id, OpsRejectRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var r = await RenewalAsync(facility.FacilityId, id, ct);
        if (r.Status != "PENDING") throw new InvalidOperationException("Yêu cầu này đã được xử lý.");
        var reason = Clip(request.Reason, 500);
        if (reason.Length == 0) throw new ArgumentException("Nhập lý do từ chối để gửi cho khách hàng.");

        r.Status = "REJECTED";
        r.ApprovedBy = actor.UserId; // người quyết định
        r.ApprovedAt = NowUtc;
        Log(actor.UserId, LogAction.RenewalRejected, LogEntity.Renewal, r.RenewalId, new { reason });
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // M07 · Nhắc khách / xác nhận hoàn cọc sau trả kho
    // =====================================================================
    public async Task RemindAsync(OpsActor actor, string id, OpsNoteRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var contract = await ContractAsync(facility.FacilityId, id, ct);
        var note = Clip(request.Note, 500);
        if (note.Length == 0) note = "Đã liên hệ nhắc khách thanh toán / xử lý hợp đồng.";

        var stamp = (NowUtc + VnOffset).ToString("dd/MM/yyyy HH:mm", Invariant);
        foreach (var oc in contract.OverdueCases.Where(o => o.Status is not ("RESOLVED" or "ESCALATED")))
        {
            oc.Status = "CONTACTED";
            oc.Notes = string.IsNullOrWhiteSpace(oc.Notes) ? $"{stamp}: {note}" : $"{oc.Notes}\n{stamp}: {note}";
        }
        Log(actor.UserId, LogAction.OverdueReminder, LogEntity.Contract, contract.ContractId, new { note });
        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<decimal> ConfirmRefundAsync(OpsActor actor, string id, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var contract = await ContractAsync(facility.FacilityId, id, ct);
        if (contract.Status != "RETURN_PENDING" || !contract.ReturnInspections.Any(i => i.Status == "COMPLETED"))
        {
            throw new InvalidOperationException("Hợp đồng chưa có biên bản trả kho.");
        }

        var now = NowUtc;
        var unpaidPayments = contract.Payments.Where(p => (p.Status == "PENDING" || p.Status == "FAILED") && p.PaymentType != "REFUND").ToList();
        var unpaid = unpaidPayments.Sum(p => p.Amount);
        var refund = Math.Max(0, contract.DepositAmount - unpaid);

        // Khoản còn nợ được trừ vào tiền cọc
        foreach (var p in unpaidPayments)
        {
            p.Status = "PAID";
            p.PaidAt = now;
            p.TransactionReference = "Trừ vào tiền cọc";
            p.UpdatedAt = now;
        }
        if (refund > 0)
        {
            dbContext.Payments.Add(new Payment
            {
                ContractId = contract.ContractId, PaymentType = "REFUND", Amount = refund, Currency = "VND",
                PaymentMethod = "BANK_TRANSFER", TransactionReference = $"Hoàn cọc {ContractCode(contract)}",
                PaidAt = now, Status = "PAID", CreatedAt = now, UpdatedAt = now
            });
        }
        contract.Status = "COMPLETED";
        contract.CompletedAt = now;
        foreach (var oc in contract.OverdueCases.Where(o => o.Status != "RESOLVED"))
        {
            oc.Status = "RESOLVED";
            oc.ResolvedAt = now;
        }
        SetUnitStatus(contract.Unit, "AVAILABLE", actor.UserId, $"Đã trả kho, hoàn cọc · {ContractCode(contract)}");
        Log(actor.UserId, LogAction.DepositRefunded, LogEntity.Contract, contract.ContractId, new { refund, deducted = unpaid });
        await dbContext.SaveChangesAsync(ct);
        return refund;
    }
}
