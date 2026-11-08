using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Các phương thức trợ giúp truy xuất trạng thái và định danh cho khu vận hành cơ sở (Facility Ops).
/// </summary>
public static class FacilityOpsStateStore
{
    /// <summary>
    /// Trích xuất phần số từ chuỗi định danh mã đơn (ví dụ: "ĐH-0012" -> 12).
    /// </summary>
    /// <param name="id">Chuỗi định danh.</param>
    /// <returns>Giá trị số trích xuất được hoặc 0 nếu không tìm thấy.</returns>
    public static long ParseIdNumber(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return 0;
        if (long.TryParse(id, out var num)) return num;
        var matches = System.Text.RegularExpressions.Regex.Matches(id, @"\d+");
        if (matches.Count == 0) return 0;
        var last = matches[^1].Value;
        return long.TryParse(last, out var parsed) ? parsed : 0;
    }

    /// <summary>
    /// Tìm kiếm đơn đặt chỗ theo mã định danh (ReservationId hoặc OrderCode) và giới hạn trong cơ sở chỉ định.
    /// </summary>
    /// <param name="dbContext">Database Context.</param>
    /// <param name="id">Chuỗi mã đơn hoặc ID.</param>
    /// <param name="facilityId">ID cơ sở cần kiểm tra (hoặc &lt;= 0 nếu bỏ qua).</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thực thể Reservation nếu tìm thấy, ngược lại null.</returns>
    public static async Task<Reservation?> FindReservationByIdAsync(AppDbContext dbContext, string id, long facilityId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        var matches = System.Text.RegularExpressions.Regex.Matches(id, @"\d+");
        if (matches.Count == 0) return null;

        var ids = matches.Select(m => long.TryParse(m.Value, out var n) ? n : 0).Where(n => n > 0).ToList();
        if (ids.Count == 0) return null;

        var q = dbContext.Reservations
            .Include(r => r.Customer)
            .Include(r => r.UnitType)
            .Include(r => r.UnitAssignments)
                .ThenInclude(ua => ua.Unit)
            .AsQueryable();

        var res = await q.FirstOrDefaultAsync(r => (ids.Contains(r.ReservationId) || (r.OrderCode.HasValue && ids.Contains(r.OrderCode.Value))) && (facilityId <= 0 || r.FacilityId == facilityId), ct);
        return res;
    }

    /// <summary>
    /// Lấy cơ sở kho đang ACTIVE được phân công cho người dùng (nhân viên hoặc quản lý).
    /// </summary>
    /// <param name="dbContext">Database Context.</param>
    /// <param name="userId">ID người dùng.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thực thể Facility.</returns>
    /// <exception cref="InvalidOperationException">Ném ra nếu người dùng chưa được phân công cơ sở ACTIVE nào.</exception>
    public static async Task<Facility> GetUserFacilityAsync(AppDbContext dbContext, long userId, CancellationToken ct)
    {
        var userFac = await dbContext.UserFacilities
            .AsNoTracking()
            .Include(uf => uf.Facility)
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct);

        if (userFac?.Facility != null)
        {
            return userFac.Facility;
        }

        throw new InvalidOperationException("Tài khoản chưa được phân công cơ sở đang hoạt động.");
    }
}
