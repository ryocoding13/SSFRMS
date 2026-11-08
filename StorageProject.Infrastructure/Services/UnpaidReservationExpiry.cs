using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Phiên 7 · Đơn chờ thanh toán trực tuyến (PayOS / chuyển khoản) quá hạn giữ chỗ mà khách chưa trả tiền:
/// chuyển EXPIRED để không còn tính là đơn đang mở trong báo cáo và danh sách.
/// Trước đây đơn chỉ chuyển EXPIRED khi khách bấm "Đã chuyển khoản" (ReservationService), khách bỏ đi thì treo mãi.
/// Không đụng đơn đã báo chuyển khoản (PENDING_VERIFICATION): nhân viên đối chiếu tiền về.
/// Tiền PayOS về sau khi đơn hết hạn vẫn đi nhánh PAYMENT_REVIEW_REQUIRED như cũ (PayOSService), không ghi nhận thanh toán.
/// </summary>
public static class UnpaidReservationExpiry
{
    public const string Reason = "Quá thời gian giữ chỗ chưa thanh toán";

    public static async Task<int> ExpireAsync(AppDbContext db, CancellationToken ct = default)
    {
        var ids = await db.Reservations.AsNoTracking()
            .Where(r => r.Status == "PENDING_PAYMENT" && r.PaidAt == null && r.ExpiresAt != null && r.ExpiresAt <= DateTime.UtcNow)
            .OrderBy(r => r.ReservationId).Select(r => r.ReservationId).Take(100).ToListAsync(ct);
        var expired = 0;
        foreach (var id in ids)
        {
            // Cùng khoá với PayOS webhook / tạo mã thanh toán / báo đã chuyển khoản nên không chạy chồng.
            await using var tx = await CheckoutTransaction.BeginAsync(db, $"reservation:{id}", ct);
            var r = await db.Reservations.Include(r => r.UnitAssignments).ThenInclude(a => a.Unit)
                .Include(r => r.RentalContract).ThenInclude(c => c!.HandoverRecord).SingleAsync(r => r.ReservationId == id, ct);
            await db.Entry(r).ReloadAsync(ct);
            var now = DateTime.UtcNow;
            if (r.Status != "PENDING_PAYMENT" || r.PaidAt != null || r.ExpiresAt == null || r.ExpiresAt > now) continue;
            await CheckoutTransaction.LockAsync(db, $"inventory:{r.FacilityId}", ct);
            // Đơn chưa trả tiền thường chưa có ô/hợp đồng; vẫn trả ô và huỷ bản nháp nếu có để không giữ ô sai.
            foreach (var a in r.UnitAssignments.Where(a => a.Status == "ACTIVE"))
            {
                a.Status = "CANCELLED";
                if (a.Unit.Status == "RESERVED") a.Unit.Status = "AVAILABLE";
            }
            if (r.RentalContract?.Status == "DRAFT")
            {
                r.RentalContract.Status = "CANCELLED";
                if (r.RentalContract.HandoverRecord != null) r.RentalContract.HandoverRecord.Status = "CANCELLED";
            }
            r.Status = "EXPIRED";
            r.CancelledAt = now;
            r.CancellationReason = Reason;
            ReservationSettlement.Audit(db, null, "RESERVATION_PAYMENT_EXPIRED", id, new { r.ExpiresAt, r.PaymentMethod });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            expired++;
        }
        return expired;
    }
}
