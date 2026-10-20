using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public static class ReservationAllocation
{
    public static async Task AllocateAsync(AppDbContext db, long actor, long facilityId, long reservationId,
        string unitCode, CancellationToken ct)
    {
        await using var tx = await CheckoutTransaction.BeginAsync(db, $"reservation:{reservationId}", ct);
        await CheckoutTransaction.LockAsync(db, $"inventory:{facilityId}", ct);
        var r = await db.Reservations.Include(r => r.UnitAssignments).Include(r => r.RentalContract)
            .SingleOrDefaultAsync(r => r.ReservationId == reservationId && r.FacilityId == facilityId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn tại cơ sở của bạn.");
        var atFacility = r.Status == "PENDING_AT_FACILITY" && r.PaymentMethod == "AT_FACILITY";
        if (!atFacility && (r.Status is not ("CONFIRMED" or "UNIT_ASSIGNED")))
            throw new InvalidOperationException("Chỉ phân bổ đơn đã thanh toán hoặc đơn chờ thu tại kho.");
        if (atFacility && r.ExpiresAt <= DateTime.UtcNow) throw new InvalidOperationException("Đơn chờ thu đã hết hạn giữ chỗ.");
        if (!atFacility) await ReservationSettlement.RequirePaidAsync(db, r, ct);
        var unit = await db.StorageUnits.SingleOrDefaultAsync(u => u.FacilityId == facilityId && u.UnitNumber == unitCode, ct)
            ?? throw new InvalidOperationException("Không tìm thấy ô kho tại cơ sở.");
        if (unit.UnitTypeId != r.UnitTypeId) throw new InvalidOperationException("Ô kho không đúng loại khách đã đặt.");
        var current = r.UnitAssignments.SingleOrDefault(a => a.Status == "ACTIVE");
        if (current != null)
        {
            if (current.UnitId != unit.UnitId) throw new InvalidOperationException("Đơn đã phân bổ ô khác, không được phân bổ thêm.");
            await tx.CommitAsync(ct);
            return;
        }
        if (unit.Status != "AVAILABLE" || await db.RentalContracts.AnyAsync(c => c.UnitId == unit.UnitId &&
            c.Status != "CANCELLED" && c.Status != "COMPLETED" && c.Status != "TERMINATED" &&
            c.StartDate < r.ExpectedEndDate && c.EndDate > r.StartDate, ct))
            throw new InvalidOperationException("Ô kho không còn trống trong kỳ thuê.");
        var contract = r.RentalContract;
        if (contract != null) throw new InvalidOperationException("Đơn đã có hợp đồng, cần kiểm tra phân bổ cũ.");
        var now = DateTime.UtcNow;
        contract = new RentalContract { ReservationId = r.ReservationId, CustomerId = r.CustomerId,
            UnitId = unit.UnitId, StartDate = r.StartDate, EndDate = r.ExpectedEndDate,
            AgreedMonthlyRate = r.QuotedMonthlyRate, DepositAmount = r.RequiredDeposit, Status = "DRAFT", CreatedAt = now,
            HandoverRecord = new HandoverRecord { StaffId = actor, ScheduledAt = r.CheckInAppointmentAt ??
                r.StartDate.ToDateTime(new TimeOnly(9, 0)).AddHours(-7), Status = "SCHEDULED", CreatedAt = now } };
        db.RentalContracts.Add(contract);
        foreach (var payment in await db.Payments.Where(p => p.ReservationId == r.ReservationId).ToListAsync(ct))
            payment.Contract = contract;
        db.UnitAssignments.Add(new UnitAssignment { ReservationId = r.ReservationId, UnitId = unit.UnitId,
            AssignedBy = actor, AssignedAt = now, Status = "ACTIVE", Reason = "Quản lý phân bổ ô" });
        db.UnitStatusHistories.Add(new UnitStatusHistory { UnitId = unit.UnitId, ChangedBy = actor,
            OldStatus = unit.Status, NewStatus = "RESERVED", ChangedAt = now, Reason = $"Phân bổ đơn {r.ReservationId}" });
        unit.Status = "RESERVED";
        unit.UpdatedAt = now;
        if (!atFacility) r.Status = "UNIT_ASSIGNED";
        ReservationSettlement.Audit(db, actor, "UNIT_ALLOCATED", r.ReservationId, new { unit.UnitNumber });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
