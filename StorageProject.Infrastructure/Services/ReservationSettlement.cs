using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Quyết toán và ghi nhận biên lai thanh toán cho đơn đặt chỗ (Reservation Settlement - F03 / D02 / D09).
/// Quản lý việc tạo các khoản thanh toán tiền thuê (RENT) và tiền cọc (DEPOSIT), kiểm tra điều kiện đã thanh toán đủ,
/// và ghi nhật ký hoạt động kiểm toán (Audit Trail) cho đơn đặt chỗ.
/// </summary>
public static class ReservationSettlement
{
    /// <summary>
    /// Tính tổng số tiền cần thanh toán cho đơn đặt chỗ (tiền thuê cả kỳ + tiền cọc 1 tháng theo D09).
    /// </summary>
    /// <param name="r">Đơn đặt chỗ.</param>
    /// <returns>Tổng số tiền VND.</returns>
    public static decimal Amount(Reservation r) => r.EstimatedAmount + r.RequiredDeposit;

    /// <summary>
    /// Ghi nhận các khoản thanh toán RENT và DEPOSIT đã trả thành công vào cơ sở dữ liệu.
    /// Gọi bên trong giao dịch đặt chỗ. Nếu đã tồn tại dòng thanh toán, tiến hành kiểm tra tính khớp nối.
    /// </summary>
    /// <param name="db">EF Core context.</param>
    /// <param name="r">Đơn đặt chỗ.</param>
    /// <param name="method">Phương thức thanh toán (PAYOS, BANK_TRANSFER, CASH...).</param>
    /// <param name="reference">Mã tham chiếu giao dịch.</param>
    /// <param name="actor">ID người dùng hoặc null nếu do hệ thống thực hiện.</param>
    /// <param name="ct">Token hủy bất đồng bộ.</param>
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

    /// <summary>
    /// Kiểm tra bắt buộc đơn đặt chỗ phải có đầy đủ các dòng thanh toán PAID với tổng số tiền khớp chính xác.
    /// </summary>
    /// <param name="db">EF Core context.</param>
    /// <param name="r">Đơn đặt chỗ cần kiểm tra.</param>
    /// <param name="ct">Token hủy bất đồng bộ.</param>
    /// <exception cref="InvalidOperationException">Ném ra khi đơn chưa trả đủ tiền.</exception>
    public static async Task RequirePaidAsync(AppDbContext db, Reservation r, CancellationToken ct)
    {
        var rows = await db.Payments.Where(p => p.ReservationId == r.ReservationId && p.Status == "PAID" &&
            (p.PaymentType == "RENT" || p.PaymentType == "DEPOSIT")).ToListAsync(ct);
        var paid = rows.Sum(p => p.Amount);
        if (r.PaidAt == null || paid != Amount(r))
            throw new InvalidOperationException("Đơn chưa có đủ khoản thu đã xác nhận. Không được bàn giao kho.");
    }

    /// <summary>
    /// Ghi vết kiểm toán (ActivityLog) cho các sự kiện phát sinh trên đơn đặt chỗ.
    /// </summary>
    /// <param name="db">EF Core context.</param>
    /// <param name="actor">ID người dùng thực hiện (null nếu do worker/webhook tự động).</param>
    /// <param name="action">Tên hành động nghiệp vụ (ví dụ: PAYMENT_CONFIRMED, CONTRACT_AUTO_ISSUED...).</param>
    /// <param name="id">ID đơn đặt chỗ.</param>
    /// <param name="detail">Dữ liệu chi tiết bổ sung (sẽ được serialize sang JSON).</param>
    public static void Audit(AppDbContext db, long? actor, string action, long id, object detail) =>
        db.ActivityLogs.Add(new ActivityLog { UserId = actor, Action = action, EntityType = "RESERVATION",
            EntityId = id, NewValue = JsonSerializer.Serialize(detail), LoggedAt = DateTime.UtcNow });
}
