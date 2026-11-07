using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ xử lý tự động hủy các đơn đặt chỗ giữ bằng tiền mặt tại quầy đã hết thời gian chờ thanh toán (Cash Hold Expiry).
/// Tự động giải phóng ô kho và hủy các bản ghi hợp đồng nháp liên quan.
/// </summary>
public static class CashHoldExpiry
{
    /// <summary>
    /// Quét và hết hạn các đơn đặt chỗ PENDING_AT_FACILITY chưa thanh toán và đã quá hạn ExpiresAt.
    /// Khôi phục trạng thái kho AVAILABLE, hủy hợp đồng DRAFT và ghi nhật ký kiểm toán.
    /// </summary>
    /// <param name="db">DbContext kết nối cơ sở dữ liệu.</param>
    /// <param name="ct">Token hủy thao tác không đồng bộ.</param>
    public static async Task ExpireAsync(AppDbContext db, CancellationToken ct = default)
    {
        // Lấy danh sách tối đa 100 đơn đặt chỗ tiền mặt tại quầy đã quá hạn thanh toán
        var ids = await db.Reservations.AsNoTracking().Where(r => r.Status == "PENDING_AT_FACILITY" &&
            r.PaidAt == null && r.ExpiresAt <= DateTime.UtcNow).Select(r => r.ReservationId).Take(100).ToListAsync(ct);
            
        foreach (var id in ids)
        {
            // Khoá độc quyền đơn đặt chỗ để tránh xung đột với nhân viên đang thu tiền tại quầy
            await using var tx = await CheckoutTransaction.BeginAsync(db, $"reservation:{id}", ct);
            var r = await db.Reservations.Include(r => r.UnitAssignments).ThenInclude(a => a.Unit)
                .Include(r => r.RentalContract).ThenInclude(c => c!.HandoverRecord).SingleAsync(r => r.ReservationId == id, ct);
            await db.Entry(r).ReloadAsync(ct);
            
            // Kiểm tra lại sau khi chiếm khoá giao dịch
            if (r.Status != "PENDING_AT_FACILITY" || r.PaidAt != null || r.ExpiresAt > DateTime.UtcNow) continue;
            
            // Khoá tài nguyên kho của cơ sở để cập nhật trạng thái ô an toàn
            await CheckoutTransaction.LockAsync(db, $"inventory:{r.FacilityId}", ct);
            
            // Huỷ phân bổ ô kho và chuyển trạng thái ô về AVAILABLE nếu đang RESERVED
            foreach (var a in r.UnitAssignments.Where(a => a.Status == "ACTIVE"))
            {
                a.Status = "CANCELLED";
                if (a.Unit.Status == "RESERVED") a.Unit.Status = "AVAILABLE";
            }
            
            // Hủy hợp đồng DRAFT và biên bản bàn giao nháp đi kèm nếu có
            if (r.RentalContract?.Status == "DRAFT") {
                r.RentalContract.Status = "CANCELLED";
                if (r.RentalContract.HandoverRecord != null) r.RentalContract.HandoverRecord.Status = "CANCELLED";
            }
            
            r.Status = "EXPIRED";
            ReservationSettlement.Audit(db, null, "CASH_HOLD_EXPIRED", id, new { r.ExpiresAt });
            await db.SaveChangesAsync(ct); 
            await tx.CommitAsync(ct);
        }
    }
}
