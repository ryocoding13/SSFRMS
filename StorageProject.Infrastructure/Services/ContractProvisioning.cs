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
            var unit = await db.StorageUnits.Where(u => u.FacilityId == reservation.FacilityId &&
                u.UnitTypeId == reservation.UnitTypeId && u.Status == "AVAILABLE" &&
                !u.MaintenanceRequests.Any(m => m.Status != "COMPLETED" && m.Status != "CANCELLED") &&
                !u.RentalContracts.Any(c => c.Status != "CANCELLED" && c.Status != "COMPLETED" && c.Status != "TERMINATED" &&
                    c.StartDate < reservation.ExpectedEndDate && c.EndDate > reservation.StartDate))
                .OrderBy(u => u.UnitNumber).ThenBy(u => u.UnitId).FirstOrDefaultAsync(ct);
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
        if (contract.HandoverRecord == null && !await db.HandoverRecords.AnyAsync(h => h.ContractId == contract.ContractId && contract.ContractId != 0, ct))
            contract.HandoverRecord = new HandoverRecord { StaffId = recordedBy, CreatedAt = now,
                ScheduledAt = reservation.CheckInAppointmentAt ?? reservation.StartDate.ToDateTime(new TimeOnly(9, 0)).AddHours(-7),
                Status = "SCHEDULED", Notes = "Chỉ ghi nhận nhận chìa khóa; không kích hoạt hợp đồng" };
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
        if (contract.Unit.Status != unitStatus)
        {
            db.UnitStatusHistories.Add(new UnitStatusHistory { Unit = contract.Unit, ChangedBy = recordedBy,
                OldStatus = contract.Unit.Status, NewStatus = unitStatus, ChangedAt = now, Reason = "Tự cấp hợp đồng sau thanh toán" });
            contract.Unit.Status = unitStatus;
            contract.Unit.UpdatedAt = now;
        }
        foreach (var payment in await db.Payments.Where(p => p.ReservationId == reservation.ReservationId).ToListAsync(ct))
            payment.Contract = contract;
        reservation.Status = "UNIT_ASSIGNED";
        if (changed) ReservationSettlement.Audit(db, actor, "CONTRACT_AUTO_ISSUED", reservation.ReservationId,
            new { unit = contract.Unit.UnitNumber, system = true, access = "QR_PIN6", physicalKey = "AT_COUNTER" });
        await db.SaveChangesAsync(ct);
        return true;
    }
}
