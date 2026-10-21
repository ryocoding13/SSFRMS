using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public static class CashHoldExpiry
{
    public static async Task ExpireAsync(AppDbContext db, CancellationToken ct = default)
    {
        var ids = await db.Reservations.AsNoTracking().Where(r => r.Status == "PENDING_AT_FACILITY" &&
            r.PaidAt == null && r.ExpiresAt <= DateTime.UtcNow).Select(r => r.ReservationId).Take(100).ToListAsync(ct);
        foreach (var id in ids)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(db, $"reservation:{id}", ct);
            var r = await db.Reservations.Include(r => r.UnitAssignments).ThenInclude(a => a.Unit)
                .Include(r => r.RentalContract).ThenInclude(c => c!.HandoverRecord).SingleAsync(r => r.ReservationId == id, ct);
            await db.Entry(r).ReloadAsync(ct);
            if (r.Status != "PENDING_AT_FACILITY" || r.PaidAt != null || r.ExpiresAt > DateTime.UtcNow) continue;
            await CheckoutTransaction.LockAsync(db, $"inventory:{r.FacilityId}", ct);
            foreach (var a in r.UnitAssignments.Where(a => a.Status == "ACTIVE"))
            {
                a.Status = "CANCELLED";
                if (a.Unit.Status == "RESERVED") a.Unit.Status = "AVAILABLE";
            }
            if (r.RentalContract?.Status == "DRAFT") {
                r.RentalContract.Status = "CANCELLED";
                if (r.RentalContract.HandoverRecord != null) r.RentalContract.HandoverRecord.Status = "CANCELLED";
            }
            r.Status = "EXPIRED";
            ReservationSettlement.Audit(db, null, "CASH_HOLD_EXPIRED", id, new { r.ExpiresAt });
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        }
    }
}
