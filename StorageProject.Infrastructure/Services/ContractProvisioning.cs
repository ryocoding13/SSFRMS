using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Tiến trình tự động cấp hợp đồng (Contract Provisioning) sau khi đơn đặt chỗ thanh toán thành công (F03/D26/D41).
/// Chạy trong phạm vi giao dịch đặt chỗ của caller, sau khi đã ghi nhận biên lai thanh toán (ReservationSettlement).
/// Tự động tìm ô kho trống phù hợp, khởi tạo hợp đồng thuê, cấp mã số PIN/QR ra vào và liên kết thanh toán/chính sách.
/// </summary>
public static class ContractProvisioning
{
    /// <summary>
    /// Đảm bảo hợp đồng thuê và thông tin mở khoá được cấp đầy đủ cho đơn đặt chỗ đã thanh toán.
    /// </summary>
    /// <param name="db">EF Core database context của hệ thống SSFRMS.</param>
    /// <param name="reservation">Bản ghi đơn đặt chỗ cần cấp hợp đồng.</param>
    /// <param name="actor">ID người dùng kích hoạt tiến trình (null nếu do hệ thống/webhook chạy tự động).</param>
    /// <param name="ct">Token hủy bất đồng bộ.</param>
    /// <returns>True nếu cấp hợp đồng thành công hoặc hợp đồng đã kích hoạt; False nếu kho hết ô cần can thiệp tay.</returns>
    public static async Task<bool> EnsureAsync(AppDbContext db, Reservation reservation, long? actor, CancellationToken ct)
    {
        // Khóa tồn kho cơ sở để chống race condition cấp trùng ô khi nhiều khách thanh toán cùng lúc
        await CheckoutTransaction.LockAsync(db, $"inventory:{reservation.FacilityId}", ct);
        var contract = await db.RentalContracts.Include(c => c.Unit).Include(c => c.AccessCredentials)
            .SingleOrDefaultAsync(c => c.ReservationId == reservation.ReservationId, ct);
        if (contract != null && contract.Status != "DRAFT") return contract.Status is "ACTIVE" or "EXPIRING";
        
        // Yêu cầu đơn phải có đủ các khoản thu (tiền thuê + cọc 1 tháng theo D09/D27) trước khi kích hoạt
        await ReservationSettlement.RequirePaidAsync(db, reservation, ct);
        var now = DateTime.UtcNow;
        // Các thay đổi tự động từ hệ thống ghi nhận theo UserId của khách hàng để đảm bảo toàn vẹn dữ liệu
        var recordedBy = actor ?? reservation.CustomerId;
        if (contract == null)
        {
            // D41: Ưu tiên chọn ô trống thật; nếu hết ô trống mới chọn ô sắp hết hạn (trống từ ngày hết hạn + ngày đệm RELET_BUFFER)
            // #2: dùng đúng ô hệ thống đã bố trí khi tạo đơn nếu còn trống cả kỳ; không thì chọn ô khác, bỏ qua ô đang đề xuất cho đơn khác
            var proposed = await UnitProposal.OfAsync(db, reservation.ReservationId, ct);
            var unit = await UnitProposal.ChooseAsync(db, reservation, ct);
            if (unit != null && proposed != null && proposed.UnitId != unit.UnitId)
                ReservationSettlement.Audit(db, actor, "UNIT_REPROPOSED", reservation.ReservationId,
                    new { from = proposed.UnitNumber, to = unit.UnitNumber, system = true });
            if (unit == null)
            {
                // Tiền thanh toán của khách là thật. Nếu hết ô, tuyệt đối không rollback tiền hay tạo hợp đồng ảo;
                // ghi nhận log AUTO_ALLOCATION_PENDING để Quản lý cơ sở xử lý thủ công (M05).
                if (!await db.ActivityLogs.AnyAsync(l => l.Action == "AUTO_ALLOCATION_PENDING" &&
                    l.EntityType == "RESERVATION" && l.EntityId == reservation.ReservationId, ct))
                    ReservationSettlement.Audit(db, actor, "AUTO_ALLOCATION_PENDING", reservation.ReservationId,
                        new { reason = "Không còn ô kho phù hợp; quản lý cần xử lý", system = true });
                return false;
            }
            contract = new RentalContract { Reservation = reservation, CustomerId = reservation.CustomerId,
                Unit = unit, StartDate = reservation.StartDate, EndDate = reservation.ExpectedEndDate,
                AgreedMonthlyRate = reservation.QuotedMonthlyRate, DepositAmount = reservation.RequiredDeposit,
                CreatedAt = now, Status = "DRAFT" };
            db.RentalContracts.Add(contract);
            db.UnitAssignments.Add(new UnitAssignment { Reservation = reservation, Unit = unit,
                AssignedBy = recordedBy, AssignedAt = now, Status = "ACTIVE", Reason = "Hệ thống tự phân bổ sau thanh toán" });
        }
        if (contract.Status is not ("DRAFT" or "ACTIVE" or "EXPIRING")) return false;
        
        // D36 (thay thế D26): Không tự động tạo lịch nhận chìa khóa. Lịch chỉ tạo khi khách gửi yêu cầu chủ đề "Nhận chìa khóa"
        // (SupportTicketService, IssueType KEY_PICKUP).
        var changed = contract.Status == "DRAFT";
        contract.Status = contract.Status == "EXPIRING" ? "EXPIRING" : "ACTIVE";
        contract.ActivatedAt ??= now;
        
        // Cấp mã mở khoá thông minh QR và PIN (D26/D33)
        foreach (var kind in new[] { "QR", "PIN" })
        {
            // Không cấp đè hoặc phục hồi các credential đã bị thu hồi trong quá khứ
            if (contract.AccessCredentials.Any(c => c.CredentialType == "ACCESS_CODE" &&
                (c.CredentialReference ?? "").StartsWith(kind + "-"))) continue;
            if (!changed && contract.AccessCredentials.Any(c => c.CredentialType == "ACCESS_CODE" &&
                !(c.CredentialReference ?? "").StartsWith("QR-") && !(c.CredentialReference ?? "").StartsWith("PIN-"))) continue;
            contract.AccessCredentials.Add(new AccessCredential { Unit = contract.Unit, IssuedBy = recordedBy,
                CredentialType = "ACCESS_CODE", CredentialReference = $"{kind}-{reservation.ReservationId}",
                IssuedAt = now, Status = "ACTIVE" });
        }
        
        // Cập nhật trạng thái ô kho: RESERVED nếu ngày thuê trong tương lai, OCCUPIED nếu bắt đầu ngay hôm nay
        var unitStatus = reservation.StartDate > DateOnly.FromDateTime(now.AddHours(7)) ? "RESERVED" : "OCCUPIED";
        // D41: Ô khách cũ còn đang thuê/chờ kiểm tra thì giữ nguyên trạng thái; đến ngày bắt đầu UnitStartActivation sẽ đổi
        var heldByOther = await db.RentalContracts.AnyAsync(c => c.UnitId == contract.Unit.UnitId && c.ContractId != contract.ContractId
            && UnitAvailability.HoldingStatuses.Contains(c.Status) && c.StartDate < reservation.StartDate, ct);
        if (!heldByOther && contract.Unit.Status != unitStatus)
        {
            db.UnitStatusHistories.Add(new UnitStatusHistory { Unit = contract.Unit, ChangedBy = recordedBy,
                OldStatus = contract.Unit.Status, NewStatus = unitStatus, ChangedAt = now, Reason = "Tự cấp hợp đồng sau thanh toán" });
            contract.Unit.Status = unitStatus;
            contract.Unit.UpdatedAt = now;
        }
        foreach (var payment in await db.Payments.Where(p => p.ReservationId == reservation.ReservationId).ToListAsync(ct))
            payment.Contract = contract;

        // BO07: Liên kết các bằng chứng PolicyConsent từ đơn sang hợp đồng được cấp
        var consents = await db.PolicyConsents
            .Where(c => c.ReservationId == reservation.ReservationId && c.ContractId == null)
            .ToListAsync(ct);
        foreach (var c in consents) c.Contract = contract;
        reservation.Status = "UNIT_ASSIGNED";
        if (changed) ReservationSettlement.Audit(db, actor, "CONTRACT_AUTO_ISSUED", reservation.ReservationId,
            new { unit = contract.Unit.UnitNumber, system = true, access = "QR_PIN6", physicalKey = "AT_COUNTER" });
        await db.SaveChangesAsync(ct);
        if (changed)
        {
            CustomerEmailDelivery.QueueContract(db, contract.ContractId, now);
            await db.SaveChangesAsync(ct);
        }
        return true;
    }
}
