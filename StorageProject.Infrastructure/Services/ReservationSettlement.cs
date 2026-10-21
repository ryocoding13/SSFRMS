using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

// Call inside the reservation transaction. Allocation attaches these rows; it never recreates them.
public static class ReservationSettlement
{
    public static decimal Amount(Reservation r) => r.EstimatedAmount + r.RequiredDeposit;

    public static async Task RecordAsync(AppDbContext db, Reservation r, string method, string reference,
        long? actor, CancellationToken ct)
    {
        var rows = await db.Payments.Where(p => p.ReservationId == r.ReservationId &&
            (p.PaymentType == "RENT" || p.PaymentType == "DEPOSIT")).ToListAsync(ct);
        var now = r.PaidAt ?? DateTime.UtcNow;
        foreach (var (kind, amount) in new[] { ("RENT", r.EstimatedAmount), ("DEPOSIT", r.RequiredDeposit) })
        {
            if (amount == 0) continue;
            var row = rows.SingleOrDefault(p => p.PaymentType == kind);
            if (row != null)
            {
                if (row.Amount != amount || row.Status != "PAID" || row.PaymentMethod != method)
                    throw new InvalidOperationException("Khoản thu đã tồn tại nhưng không khớp. Cần kiểm tra giao dịch.");
                continue;
            }
            db.Payments.Add(new Payment {
                ReservationId = r.ReservationId, ContractId = r.RentalContract?.ContractId,
                PaymentType = kind, Amount = amount, PaymentMethod = method,
                TransactionReference = $"{reference}:{kind}", Status = "PAID", PaidAt = now,
                DueDate = r.StartDate, CreatedAt = now, UpdatedAt = now
            });
        }
        r.PaidAt = now;
        r.Status = r.UnitAssignments.Any(a => a.Status == "ACTIVE") ? "UNIT_ASSIGNED" : "CONFIRMED";
        Audit(db, actor, "PAYMENT_CONFIRMED", r.ReservationId, new { method, reference, amount = Amount(r) });
    }

    public static async Task RequirePaidAsync(AppDbContext db, Reservation r, CancellationToken ct)
    {
        var rows = await db.Payments.Where(p => p.ReservationId == r.ReservationId && p.Status == "PAID" &&
            (p.PaymentType == "RENT" || p.PaymentType == "DEPOSIT")).ToListAsync(ct);
        var paid = rows.Sum(p => p.Amount);
        if (r.PaidAt == null || paid != Amount(r))
            throw new InvalidOperationException("Đơn chưa có đủ khoản thu đã xác nhận. Không được bàn giao kho.");
    }

    public static void Audit(AppDbContext db, long? actor, string action, long id, object detail) =>
        db.ActivityLogs.Add(new ActivityLog { UserId = actor, Action = action, EntityType = "RESERVATION",
            EntityId = id, NewValue = JsonSerializer.Serialize(detail), LoggedAt = DateTime.UtcNow });
}
