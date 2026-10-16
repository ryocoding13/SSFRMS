using Microsoft.EntityFrameworkCore;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// Điền toạ độ ghim bản đồ cho 12 cơ sở SafeSpace (khớp src/config/geo.js của giao diện).
/// Chỉ điền cơ sở CHƯA có toạ độ, nên toạ độ Vận hành KD sửa ở màn B05 không bị ghi đè khi chạy lại.
/// Khớp theo một phần tên cơ sở (vd. "SafeSpace Phú Xuân" chứa "Phú Xuân").
/// </summary>
public static class FacilityCoordinateSeeder
{
    private static readonly (string Key, decimal Latitude, decimal Longitude)[] KnownFacilities =
    [
        ("Nguyễn Lương Bằng", 10.729500m, 106.721900m),
        ("Him Lam", 10.745600m, 106.698000m),
        ("Phú Xuân", 10.693500m, 106.722200m),
        ("Tân Thuận", 10.756000m, 106.729000m),
        ("Phú Mỹ Hưng", 10.728500m, 106.706000m),
        ("Bình Thạnh", 10.815000m, 106.709000m),
        ("Nhà Bè", 10.696000m, 106.739000m),
        ("Bình Chánh", 10.697000m, 106.656000m),
        ("Thủ Đức", 10.850000m, 106.770000m),
        ("Gò Vấp", 10.835000m, 106.666000m),
        ("Tân Bình", 10.801000m, 106.642000m),
        ("Bình Tân", 10.739000m, 106.615000m),
    ];

    public static async Task SeedAsync(AppDbContext context, CancellationToken ct = default)
    {
        var missing = await context.Facilities
            .Where(f => f.Latitude == null || f.Longitude == null)
            .ToListAsync(ct);
        if (missing.Count == 0) return;

        var changed = false;
        foreach (var facility in missing)
        {
            var hit = KnownFacilities.FirstOrDefault(k => facility.Name.Contains(k.Key, StringComparison.OrdinalIgnoreCase));
            if (hit.Key is null) continue;
            facility.Latitude = hit.Latitude;
            facility.Longitude = hit.Longitude;
            changed = true;
        }
        if (changed) await context.SaveChangesAsync(ct);
    }
}
