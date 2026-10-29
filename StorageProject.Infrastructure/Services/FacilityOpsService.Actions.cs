using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;

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

        var docType = Clip(request.DocType, 50);
        object evidence;
        if (request.OriginalDocumentValid.HasValue || request.BookingMatched.HasValue)
        {
            // S02 mới (Figma 436:13163): nhân viên tích 4 mục trên giấy tờ gốc, không nhập lại số giấy tờ.
            if (request.OriginalDocumentValid != true || !request.PhotoMatched || !request.InfoMatched || request.BookingMatched != true)
            {
                throw new ArgumentException("Đánh dấu đủ bốn mục đối chiếu trước khi xác minh.");
            }
            evidence = new
            {
                checklist = true, originalDocumentValid = true, photoMatched = true, infoMatched = true, bookingMatched = true,
                docType = docType.Length > 0 ? docType : null, staff = StaffCode(actor.UserId)
            };
        }
        else
        {
            var docNumber = (request.DocNumber ?? string.Empty).Trim();
            if (!DocNumberPattern.IsMatch(docNumber))
            {
                throw new ArgumentException("Số giấy tờ gồm 9 hoặc 12 chữ số (CCCD/CMND) hoặc 1 chữ + 7 số (hộ chiếu).");
            }
            if (!request.PhotoMatched || !request.InfoMatched)
            {
                throw new ArgumentException("Đánh dấu cả hai mục đối chiếu trước khi xác minh.");
            }
            evidence = new { docType = docType.Length > 0 ? docType : "Căn cước công dân", docLast4 = docNumber[^4..] };
        }

        h.Status = "VERIFIED";
        h.VerifiedAt = NowUtc;
        if (!actor.IsManager) h.StaffId = actor.UserId;
        Log(actor.UserId, LogAction.CustomerVerified, LogEntity.Handover, h.HandoverId, evidence);
        await dbContext.SaveChangesAsync(ct);
    }

    // =====================================================================
    // S03 · Bàn giao kho + cấp phương thức mở khoá
    // =====================================================================
    public Task CompleteHandoverAsync(OpsActor actor, string id, OpsHandoverRequest request, CancellationToken ct = default) =>
        RecordKeyReceiptAsync(actor, id, ct);

    public Task RecordKeyReceiptAsync(OpsActor actor, string id, CancellationToken ct = default) =>
        RecordKeyReceiptAsync(actor, id, null, ct);

    public async Task RecordKeyReceiptAsync(OpsActor actor, string id, OpsKeyReceiptRequest? request, CancellationToken ct = default)
    {
        // Màn mới gửi checklist: chỉ ghi nhận khi nhân viên đã đối chiếu và thực sự giao chìa khóa.
        if (request != null && (request.IdentityChecked != true || request.ConditionChecked != true || request.KeyDelivered != true))
        {
            throw new ArgumentException("Đánh dấu đủ ba mục đối chiếu và chỉ xác nhận sau khi đã giao chìa khóa.");
        }
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
        Log(actor.UserId, "PHYSICAL_KEY_RECEIVED", LogEntity.Handover, h.HandoverId, new { quantity = 1, checklist = request != null });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    // =====================================================================
    // S04 · Kiểm tra trả kho → chờ quản lý xác nhận hoàn cọc
    // =====================================================================
    /// <summary>Đề xuất "cho thuê lại ngay" trên màn S04 — chỉ được chọn khi không có hư hỏng và không cần vệ sinh.</summary>
    internal const string ReadyToRelet = "Sẵn sàng cho thuê lại";

    public async Task SubmitReturnInspectionAsync(OpsActor actor, string id, OpsReturnInspectionRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);

        var items = Clip(request.Items, 500);
        var walls = Clip(request.Walls, 500);
        var keys = Clip(request.Keys, 500);
        var proposal = Clip(request.Proposal, 500);
        if (items.Length == 0 || walls.Length == 0 || keys.Length == 0 || proposal.Length == 0)
        {
            throw new ArgumentException("Điền đủ 4 mục kiểm tra trước khi gửi biên bản.");
        }

        // D32 / T05: phí hư hỏng do nhân viên nhập (số nguyên VNĐ, không âm); vệ sinh = 10% cọc cố định do server tính.
        var damageFee = request.DamageFee ?? 0m;
        if (damageFee < 0 || damageFee != decimal.Truncate(damageFee) || damageFee > 1_000_000_000m)
        {
            throw new ArgumentException("Khấu trừ hư hỏng phải là số tiền nguyên không âm.");
        }
        var cleaningRequired = request.CleaningRequired == true;
        var damageItem = (request.DamageItem ?? string.Empty).Trim();
        var feeReason = (request.FeeReason ?? string.Empty).Trim();
        if (damageItem.Length > 200) throw new ArgumentException("Hạng mục hư hỏng tối đa 200 ký tự.");
        if (feeReason.Length > 500) throw new ArgumentException("Lý do khấu trừ tối đa 500 ký tự.");
        if (damageFee > 0 && damageItem.Length == 0) throw new ArgumentException("Hư hỏng cần ghi rõ hạng mục.");
        if ((damageFee > 0 || cleaningRequired) && feeReason.Length == 0) throw new ArgumentException("Nhập lý do khấu trừ.");
        if ((damageFee > 0 || cleaningRequired) && proposal == ReadyToRelet)
        {
            throw new ArgumentException("Kho cần vệ sinh hoặc sửa phải chờ kiểm tra/bảo trì, không chọn cho thuê lại ngay.");
        }
        // Kiểm toàn bộ ảnh trước khi ghi; hư hỏng bắt buộc có ảnh bằng chứng.
        var photos = EvidencePhotos.Decode(request.Photos, required: damageFee > 0, what: "bằng chứng hư hỏng");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"return-inspection:{facility.FacilityId}:{id}", ct);
        var i = await InspectionAsync(facility.FacilityId, id, ct);
        if (i.Status == "COMPLETED") throw new InvalidOperationException("Biên bản trả kho đã được gửi.");
        if (i.Status == "CANCELLED") throw new InvalidOperationException("Lịch trả kho đã huỷ.");
        var contract = i.Contract;
        if (contract.Status is "COMPLETED" or "TERMINATED" or "CANCELLED")
        {
            throw new InvalidOperationException("Hợp đồng đã kết thúc, không gửi được biên bản trả kho.");
        }

        var now = NowUtc;
        i.Status = "COMPLETED";
        i.InspectedAt = now;
        i.DamageDescription = walls;
        i.Notes = $"Đồ đạc còn lại: {items}\nTường, sàn, cửa: {walls}\nChìa khoá, thẻ: {keys}\nĐề xuất: {proposal}";
        i.DamageFee = damageFee;
        i.CleaningRequired = cleaningRequired;
        i.CleaningFee = cleaningRequired ? CleaningFeeFor(contract.DepositAmount) : 0m;
        i.MaintenanceRequired = damageFee > 0 || proposal != ReadyToRelet;
        i.ConditionStatus = damageFee > 0 ? "DAMAGED" : cleaningRequired ? "DIRTY" : proposal != ReadyToRelet ? "MAINTENANCE_REQUIRED" : "GOOD";
        i.DamageItem = damageItem.Length > 0 ? damageItem : null;
        i.FeeReason = feeReason.Length > 0 ? feeReason : null;
        if (!actor.IsManager) i.StaffId = actor.UserId;

        if (contract.Status is "ACTIVE" or "EXPIRING" or "OVERDUE") contract.Status = "RETURN_PENDING";
        SetUnitStatus(contract.Unit, "INSPECTION", actor.UserId, $"Khách trả kho · {ReturnCode(i.InspectionId)}");
        foreach (var cred in contract.AccessCredentials.Where(a => a.Status == "ACTIVE"))
        {
            cred.Status = "RETURNED";
            cred.ReturnedAt = now;
        }
        EvidencePhotos.Attach(dbContext, photos, EvidencePhotos.ReturnInspection, i.InspectionId, actor.UserId, now);
        Log(actor.UserId, LogAction.ReturnInspected, LogEntity.Return, i.InspectionId, new
        {
            items, walls, keys, proposal, damageFee, cleaningRequired, cleaningFee = i.CleaningFee,
            damageItem, feeReason, photos = photos.Count
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>Vệ sinh cơ bản: 10% tiền cọc cố định (D27, giữ trong D32).</summary>
    internal static decimal CleaningFeeFor(decimal deposit) =>
        Math.Round(deposit * RefundPolicy.HygieneFeeRate, 0, MidpointRounding.AwayFromZero);

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
        var vnToday = DateOnly.FromDateTime(now + VnOffset);

        // Re-check rate at approval time
        var activeRate = await dbContext.RentalRates
            .Where(rate => rate.FacilityId == contract.Unit.FacilityId
                     && rate.UnitTypeId == contract.Unit.UnitTypeId
                     && rate.EffectiveFrom <= vnToday
                     && (rate.EffectiveTo == null || rate.EffectiveTo >= vnToday))
            .OrderByDescending(rate => rate.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var newRate = activeRate?.MonthlyRate ?? contract.AgreedMonthlyRate;
        r.NewMonthlyRate = newRate;
        r.RenewalAmount = newRate * r.RenewalPeriodMonths;

        // Payment deadline: min(now + 24h, 00:00 contract expiry date in Vietnam time)
        var contractExpiryVn = r.OldEndDate.ToDateTime(TimeOnly.MinValue);
        var contractExpiryUtc = contractExpiryVn.AddHours(-7);
        var deadline = now.AddHours(24);
        if (contractExpiryUtc < deadline)
        {
            deadline = contractExpiryUtc;
        }

        r.PaymentDeadlineAt = deadline;
        r.Status = "APPROVED";
        r.ApprovedBy = actor.UserId;
        r.ApprovedAt = now;
        // EndDate remains OldEndDate! DO NOT CHANGE contract.EndDate on approval!

        // Khoản gia hạn khách cần thanh toán (hiện ở "Thanh toán" của khách)
        var payment = await dbContext.Payments
            .FirstOrDefaultAsync(p => p.RenewalId == r.RenewalId && p.PaymentType == "RENEWAL", ct);

        if (payment == null)
        {
            dbContext.Payments.Add(new Payment
            {
                ContractId = contract.ContractId,
                RenewalId = r.RenewalId,
                PaymentType = "RENEWAL",
                Amount = r.RenewalAmount,
                Currency = "VND",
                PaymentMethod = "BANK_TRANSFER",
                DueDate = r.OldEndDate,
                Status = "PENDING",
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            payment.Amount = r.RenewalAmount;
            payment.Status = "PENDING";
            payment.UpdatedAt = now;
        }

        Log(actor.UserId, LogAction.RenewalApproved, LogEntity.Renewal, r.RenewalId, new {
            renewalId = r.RenewalId,
            contractId = contract.ContractId,
            amount = r.RenewalAmount,
            paymentDeadlineAt = deadline,
            newEndDate = r.NewEndDate.ToString("yyyy-MM-dd")
        });
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

    /// <summary>
    /// M07 · Chốt quyết toán trả kho theo D32 (xem <see cref="RefundPolicy"/>): tổng khấu trừ tối đa bằng cọc.
    /// Hoàn tiền hai bước (T07): bước này chỉ tạo khoản REFUND PENDING ("Chờ hoàn"); quản lý ghi mã giao dịch
    /// ở màn hoàn cọc mới chuyển PAID. Ô cần vệ sinh / sửa giữ MAINTENANCE, không tự về AVAILABLE.
    /// </summary>
    public async Task<OpsSettlementResult> ConfirmRefundAsync(OpsActor actor, string id, string? note = null, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract-settlement:{facility.FacilityId}:{id}", ct);
        var contract = await ContractAsync(facility.FacilityId, id, ct);
        var inspection = contract.ReturnInspections.Where(i => i.Status == "COMPLETED")
            .OrderByDescending(i => i.InspectedAt ?? i.CreatedAt).FirstOrDefault();
        if (contract.Status != "RETURN_PENDING" || inspection == null)
        {
            throw new InvalidOperationException("Hợp đồng chưa có biên bản trả kho.");
        }
        if (contract.Payments.Any(p => p.PaymentType == "REFUND"))
        {
            throw new InvalidOperationException("Hợp đồng đã ghi nhận hoàn tiền.");
        }

        var now = NowUtc;
        // D32 / T09: Dừng tính phí quá hạn khi gửi trả kho thành công (inspection.CreatedAt là thời điểm khách gửi move-out).
        var moveOutDate = DateOnly.FromDateTime((inspection.CreatedAt != default ? inspection.CreatedAt : (inspection.InspectedAt ?? now)) + VnOffset);
        var returnDate = DateOnly.FromDateTime((inspection.InspectedAt ?? now) + VnOffset);
        var scenario = moveOutDate < contract.EndDate ? RefundScenario.EarlyStop : RefundScenario.NormalReturn;
        var overdueDays = Math.Max(0, moveOutDate.DayNumber - contract.EndDate.DayNumber);
        decimal overdueFee = 0;
        if (overdueDays > 0)
        {
            var policy = await OpsRules.FindApplicablePolicyAsync(dbContext, "OVERDUE", facility.FacilityId,
                contract.Unit.UnitTypeId, moveOutDate, ct);
            overdueFee = RefundPolicy.OverdueFeeFor(policy?.CalculationType, policy?.Value, contract.DepositAmount, overdueDays, maxCap: contract.DepositAmount);
        }
        var rentPaid = contract.Payments.Where(p => p.PaymentType == "RENT" && p.Status == "PAID").Sum(p => p.Amount);
        var result = RefundPolicy.Calculate(new RefundInput(scenario, contract.DepositAmount, rentPaid,
            contract.StartDate, contract.EndDate, returnDate,
            HygieneViolation: inspection.CleaningRequired || inspection.CleaningFee > 0 || inspection.ConditionStatus == "DIRTY",
            Overdue: overdueDays > 0, DamageFee: inspection.DamageFee, OverdueFee: overdueFee));

        // Khoản đã phát sinh trên hợp đồng được bù trừ bằng đúng phần đã trừ vào cọc; phần còn lại vẫn là nợ.
        SettleFromDeposit(contract, "DAMAGE_FEE", result.DamageDeduction, now);
        SettleFromDeposit(contract, "OVERDUE_FEE", result.OverdueDeduction, now);
        if (result.FixedDeduction > 0) SettleFromDeposit(contract, "CLEANING_FEE", decimal.MaxValue, now);

        var refund = result.Total;
        var refundStatus = refund > 0 ? "PENDING" : "NO_REFUND";
        if (refund > 0)
        {
            // Chưa ghi mã giao dịch / thời điểm chuyển: chỉ có khi quản lý xác nhận ở màn hoàn cọc (CONFIRM_DEPOSIT_REFUND).
            dbContext.Payments.Add(new Payment
            {
                ContractId = contract.ContractId, PaymentType = "REFUND", Amount = refund, Currency = "VND",
                PaymentMethod = "BANK_TRANSFER", DueDate = RefundDueDate(now),
                Status = "PENDING", CreatedAt = now, UpdatedAt = now
            });
        }
        contract.Status = "COMPLETED";
        contract.CompletedAt = now;
        foreach (var oc in contract.OverdueCases.Where(o => o.Status != "RESOLVED"))
        {
            oc.Status = "RESOLVED";
            oc.ResolvedAt = now;
        }
        var needsWork = inspection.CleaningRequired || inspection.MaintenanceRequired || inspection.DamageFee > 0;
        SetUnitStatus(contract.Unit, needsWork ? "MAINTENANCE" : "AVAILABLE", actor.UserId,
            needsWork ? $"Cần vệ sinh / sửa sau trả kho · {ContractCode(contract)}" : $"Đã trả kho, chốt hoàn cọc · {ContractCode(contract)}");
        Log(actor.UserId, LogAction.DepositRefunded, LogEntity.Contract, contract.ContractId, new
        {
            refund, refundStatus, scenario = scenario.ToString(), rentRefund = result.RentRefund, depositRefund = result.DepositRefund,
            fixedDeduction = result.FixedDeduction, damage = result.DamageDeduction, overdue = result.OverdueDeduction,
            overdueDays, note = Clip(note, 500)
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new OpsSettlementResult(refund, refundStatus);
    }

    /// <summary>Hạn hoàn: 5 ngày làm việc (thứ 2–6) sau ngày chốt theo giờ Việt Nam (D32: 3–5 ngày làm việc).</summary>
    internal static DateOnly RefundDueDate(DateTime settledUtc)
    {
        var day = DateOnly.FromDateTime(settledUtc + VnOffset);
        for (var added = 0; added < 5;)
        {
            day = day.AddDays(1);
            if (day.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)) added++;
        }
        return day;
    }

    // Đánh dấu khoản chưa thanh toán loại `type` là đã trừ vào cọc tới tối đa `budget`; khoản trả một phần được tách đôi.
    private void SettleFromDeposit(RentalContract contract, string type, decimal budget, DateTime now)
    {
        foreach (var p in contract.Payments.Where(p => p.PaymentType == type && (p.Status == "PENDING" || p.Status == "FAILED"))
                     .OrderBy(p => p.PaymentId).ToList())
        {
            if (budget <= 0) break;
            if (p.Amount <= budget)
            {
                budget -= p.Amount;
                p.Status = "PAID"; p.PaidAt = now; p.UpdatedAt = now; p.TransactionReference = "Trừ vào tiền cọc";
                continue;
            }
            dbContext.Payments.Add(new Payment
            {
                ContractId = p.ContractId, PaymentType = p.PaymentType, Amount = budget, Currency = p.Currency,
                PaymentMethod = p.PaymentMethod, TransactionReference = "Trừ vào tiền cọc", DueDate = p.DueDate,
                PaidAt = now, Status = "PAID", CreatedAt = now, UpdatedAt = now
            });
            p.Amount -= budget; p.UpdatedAt = now;
            budget = 0;
        }
    }

    /// <summary>
    /// M08 · Quản lý ghi bằng chứng đã chuyển khoản hoàn cho đơn đã huỷ (khoản REFUND ghi lúc khách huỷ).
    /// D32: chỉ hoàn vào tài khoản chính chủ khách khai khi huỷ; cần mã giao dịch, thời điểm chuyển thực tế và xác nhận.
    /// </summary>
    public async Task<decimal> ConfirmReservationRefundAsync(OpsActor actor, string id, OpsReservationRefundRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var method = (request.Method ?? "BANK_TRANSFER").Trim().ToUpperInvariant();
        if (method != "BANK_TRANSFER") throw new ArgumentException("Hoàn tiền chỉ chuyển khoản vào tài khoản chính chủ của khách.");
        if (!request.Confirmed) throw new ArgumentException("Cần xác nhận đã chuyển đúng số tiền vào đúng tài khoản.");
        var reference = TransactionRefOf(request.TransactionRef);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation-refund:{facility.FacilityId}:{id}", ct);
        var r = await ReservationAsync(facility.FacilityId, id, ct);
        if (r.Status != "CANCELLED") throw new InvalidOperationException("Đơn chưa bị huỷ nên không có khoản hoàn tiền.");
        var refunds = await dbContext.Payments.Where(p => p.ReservationId == r.ReservationId && p.PaymentType == "REFUND").ToListAsync(ct);
        if (refunds.Count == 0) throw new InvalidOperationException("Đơn này không có khoản hoàn tiền.");
        var pending = refunds.FirstOrDefault(p => p.Status == "PENDING")
            ?? throw new InvalidOperationException("Khoản hoàn tiền này đã được xác nhận.");
        if (!RefundBank.IsComplete(r.RefundBankName, r.RefundAccountNumber, r.RefundAccountHolder))
        {
            throw new InvalidOperationException("Đơn huỷ chưa có tài khoản nhận hoàn chính chủ. Liên hệ khách bổ sung trước khi chuyển tiền.");
        }
        var paidAt = TransferTimeOf(request.TransferredAt, r.CancelledAt ?? pending.CreatedAt, "huỷ đơn");
        await EnsureUniqueTransactionRefAsync(reference, pending.PaymentId, ct);

        pending.Status = "PAID"; pending.PaidAt = paidAt; pending.UpdatedAt = NowUtc;
        pending.TransactionReference = reference;
        Log(actor.UserId, LogAction.DepositRefunded, LogEntity.Reservation, r.ReservationId,
            new { refund = pending.Amount, reservation = true, transactionRef = reference, transferredAt = paidAt });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return pending.Amount;
    }

    // ------------------------------------------------------------------
    // Bằng chứng chuyển tiền dùng chung cho M08 (đơn huỷ) và hoàn cọc sau trả kho
    // ------------------------------------------------------------------
    internal static string TransactionRefOf(string? value)
    {
        var reference = (value ?? string.Empty).Trim();
        if (reference.Length == 0 || reference.Length > 100) throw new ArgumentException("Nhập mã giao dịch không quá 100 ký tự.");
        return reference;
    }

    /// <summary>
    /// Thời điểm chuyển tiền thực tế (UTC). JSON có "Z"/offset được đổi về UTC; không có múi giờ thì coi là UTC (D10).
    /// Không ở tương lai và không trước thời điểm chốt (so theo phút).
    /// </summary>
    internal static DateTime TransferTimeOf(DateTime? value, DateTime notBeforeUtc, string what)
    {
        if (value is not DateTime t || t == default) throw new ArgumentException("Nhập thời gian chuyển tiền thực tế.");
        var utc = t.Kind switch
        {
            DateTimeKind.Local => t.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(t, DateTimeKind.Utc),
            _ => t
        };
        if (utc > NowUtc.AddMinutes(1)) throw new ArgumentException("Thời gian thực tế không được ở tương lai.");
        var floor = DateTime.SpecifyKind(notBeforeUtc, DateTimeKind.Utc);
        floor = floor.AddTicks(-(floor.Ticks % TimeSpan.TicksPerMinute));
        if (utc < floor) throw new ArgumentException($"Thời gian chuyển không được trước khi {what}.");
        return utc;
    }

    private async Task EnsureUniqueTransactionRefAsync(string reference, long paymentId, CancellationToken ct)
    {
        if (await dbContext.Payments.AnyAsync(p => p.TransactionReference == reference && p.PaymentId != paymentId, ct))
        {
            throw new InvalidOperationException("Mã giao dịch này đã được ghi cho khoản khác. Kiểm tra lại mã giao dịch.");
        }
    }
}
