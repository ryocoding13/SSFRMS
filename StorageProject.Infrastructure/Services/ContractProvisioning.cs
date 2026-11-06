using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

// Runs inside the caller's reservation transaction, after receipts have been saved.
public static class ContractProvisioning
{
    public static async Task<bool> EnsureAsync(AppDbContext db, Reservation reservation, long? actor, CancellationToken ct)
    {
        await CheckoutTransaction.LockAsync(db, $"inventory:{reservation.FacilityId}", ct);
        var contract = await db.RentalContracts.Include(c => c.Unit).Include(c => c.AccessCredentials)
            .SingleOrDefaultAsync(c => c.ReservationId == reservation.ReservationId, ct);
        if (contract != null && contract.Status != "DRAFT") return contract.Status is "ACTIVE" or "EXPIRING";
        await ReservationSettlement.RequirePaidAsync(db, reservation, ct);
        var now = DateTime.UtcNow;
        // Automated changes use the customer's user FK, with explicit system attribution in the audit.
        var recordedBy = actor ?? reservation.CustomerId;
        if (contract == null)
        {
            // D41: ưu tiên ô trống thật; hết ô trống mới dùng ô sắp hết hạn (trống từ ngày hết hạn + ngày đệm).
            var today = OpsRules.TodayLocal;
            var buffer = await UnitAvailability.BufferDaysAsync(db, reservation.FacilityId, reservation.UnitTypeId, today, ct);
            var slots = await UnitAvailability.SlotsAsync(db, reservation.FacilityId, reservation.UnitTypeId, ct);
            var unit = UnitAvailability.Pick(slots, reservation.StartDate, reservation.ExpectedEndDate, buffer, today)?.Unit;
            if (unit == null)
            {
                // Payment is real even when inventory needs manual resolution. Never roll it back or fake a contract.
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
        // D36 (thay D26): không tự tạo lịch nhận chìa khóa. Lịch chỉ tạo khi khách gửi yêu cầu chủ đề "Nhận chìa khóa"
        // (SupportTicketService, IssueType KEY_PICKUP).
        var changed = contract.Status == "DRAFT";
        contract.Status = contract.Status == "EXPIRING" ? "EXPIRING" : "ACTIVE";
        contract.ActivatedAt ??= now;
        foreach (var kind in new[] { "QR", "PIN" })
        {
            // Replayed payments must not resurrect revoked credentials.
            if (contract.AccessCredentials.Any(c => c.CredentialType == "ACCESS_CODE" &&
                (c.CredentialReference ?? "").StartsWith(kind + "-"))) continue;
            if (!changed && contract.AccessCredentials.Any(c => c.CredentialType == "ACCESS_CODE" &&
                !(c.CredentialReference ?? "").StartsWith("QR-") && !(c.CredentialReference ?? "").StartsWith("PIN-"))) continue;
            contract.AccessCredentials.Add(new AccessCredential { Unit = contract.Unit, IssuedBy = recordedBy,
                CredentialType = "ACCESS_CODE", CredentialReference = $"{kind}-{reservation.ReservationId}",
                IssuedAt = now, Status = "ACTIVE" });
        }
        var unitStatus = reservation.StartDate > DateOnly.FromDateTime(now.AddHours(7)) ? "RESERVED" : "OCCUPIED";
        // D41: ô khách cũ còn giữ (đang thuê / chờ kiểm tra) thì giữ nguyên trạng thái; đến ngày bắt đầu UnitStartActivation đổi.
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
        return true;
    }
}
