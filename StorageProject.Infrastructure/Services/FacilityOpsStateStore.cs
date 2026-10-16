using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public static class FacilityOpsStateStore
{
    public static long ParseIdNumber(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return 0;
        if (long.TryParse(id, out var num)) return num;
        var matches = System.Text.RegularExpressions.Regex.Matches(id, @"\d+");
        if (matches.Count == 0) return 0;
        var last = matches[^1].Value;
        return long.TryParse(last, out var parsed) ? parsed : 0;
    }

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
        if (res == null)
        {
            res = await q.FirstOrDefaultAsync(r => ids.Contains(r.ReservationId) || (r.OrderCode.HasValue && ids.Contains(r.OrderCode.Value)), ct);
        }
        return res;
    }

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

        var defaultFac = await dbContext.Facilities.FirstOrDefaultAsync(f => f.Name.Contains("Nguyễn Lương Bằng"), ct)
                         ?? await dbContext.Facilities.FirstOrDefaultAsync(ct)
                         ?? throw new InvalidOperationException("Không tìm thấy cơ sở kho.");

        return defaultFac;
    }
}
