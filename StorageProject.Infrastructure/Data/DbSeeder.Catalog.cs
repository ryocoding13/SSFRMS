using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// Danh mục kho theo D17 (Figma 14/10):
/// - 4 loại kho: thường / lạnh × cỡ M (15 m²) / cỡ L (30 m²).
/// - 12 cơ sở SafeSpace (khớp src/data/seed.js của giao diện), cơ sở nào cũng có kho lạnh.
/// - Mỗi cơ sở 12 ô: dãy A cỡ M (K01–K04 thường, K05–K06 lạnh), dãy B cỡ L (K07–K10 thường, K11–K12 lạnh).
/// - Giá = giá gốc cơ sở × hệ số cỡ (M 1, L 1,75) × hệ số loại (thường 1, lạnh 1,2), làm tròn 10.000 đ
///   — cùng công thức với src/lib/catalog.js.
/// Dữ liệu cũ (cỡ S/M/L/XL, cơ sở "Quận 7") được ngừng dùng, không xoá để giữ lịch sử.
/// </summary>
public static partial class DbSeeder
{
    public sealed record SeedCatalog(Facility Home, UnitType NormalM, UnitType NormalL, UnitType ColdM, UnitType ColdL);

    private sealed record SeedFacility(string Name, string District, decimal BasePrice, string Street, string Phone, string? OldAddress = null);

    // Thứ tự và giá gốc giống src/data/seed.js. Cơ sở đầu tiên là nơi staff01 / manager01 phụ trách.
    private static readonly SeedFacility[] SafeSpaceFacilities =
    [
        new("SafeSpace Nguyễn Lương Bằng", "Quận 7", 1150000m, "Số 12 Nguyễn Lương Bằng, Tân Phú", "02837001012",
            "12 Nguyễn Lương Bằng, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh"),
        new("SafeSpace Him Lam", "Quận 7", 1050000m, "Khu dân cư Him Lam, Tân Hưng", "02837001013",
            "Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh"),
        new("SafeSpace Phú Xuân", "Quận 7", 890000m, "Đường Nguyễn Hữu Thọ, Phú Xuân", "02837001014",
            "Đường Nguyễn Hữu Thọ, Xã Phú Xuân, Huyện Nhà Bè, TP. Hồ Chí Minh"),
        new("SafeSpace Tân Thuận", "Quận 7", 1100000m, "Đường Huỳnh Tấn Phát, Tân Thuận", "02837001015",
            "Đường Huỳnh Tấn Phát, Phường Tân Thuận Đông, Quận 7, TP. Hồ Chí Minh"),
        new("SafeSpace Phú Mỹ Hưng", "Quận 7", 1250000m, "Đường Nguyễn Lương Bằng, Tân Phong", "02837001016",
            "Đường Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh"),
        new("SafeSpace Bình Thạnh", "Quận Bình Thạnh", 980000m, "Đường Nguyễn Xí, Phường 26", "02837001017",
            "Đường Nguyễn Xí, Phường 26, Quận Bình Thạnh, TP. Hồ Chí Minh"),
        new("SafeSpace Nhà Bè", "Huyện Nhà Bè", 850000m, "Đường Huỳnh Tấn Phát, Thị trấn Nhà Bè", "02837001018",
            "Đường Huỳnh Tấn Phát, Thị trấn Nhà Bè, Huyện Nhà Bè, TP. Hồ Chí Minh"),
        new("SafeSpace Bình Chánh", "Huyện Bình Chánh", 790000m, "Quốc lộ 50, Bình Hưng", "02837001019",
            "Quốc lộ 50, Xã Bình Hưng, Huyện Bình Chánh, TP. Hồ Chí Minh"),
        new("SafeSpace Thủ Đức", "TP. Thủ Đức", 920000m, "Đường Võ Văn Ngân, Linh Chiểu", "02837001020",
            "Đường Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh"),
        new("SafeSpace Gò Vấp", "Quận Gò Vấp", 930000m, "Đường Quang Trung, Phường 10", "02837001021",
            "Đường Quang Trung, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh"),
        new("SafeSpace Tân Bình", "Quận Tân Bình", 1020000m, "Đường Cộng Hòa, Phường 13", "02838112233",
            "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh"),
        new("SafeSpace Bình Tân", "Quận Bình Tân", 820000m, "Đường Kinh Dương Vương, An Lạc", "02837001023"),
    ];

    // (mã ô, dãy, lạnh?, cỡ L?)
    private static readonly (string Code, string Row, bool Cold, bool Large)[] UnitLayout =
    [
        ("K01", "A", false, false), ("K02", "A", false, false), ("K03", "A", false, false), ("K04", "A", false, false),
        ("K05", "A", true, false), ("K06", "A", true, false),
        ("K07", "B", false, true), ("K08", "B", false, true), ("K09", "B", false, true), ("K10", "B", false, true),
        ("K11", "B", true, true), ("K12", "B", true, true),
    ];

    private static readonly string[] LegacyUnitTypeNames =
        ["Kho Mini S (1m x 1m)", "Kho Tiêu Chuẩn M (2m x 2m)", "Kho Lớn L (3m x 3m)", "Kho Doanh Nghiệp XL (4m x 4m)", "Tủ Locker Cá Nhân (0.5m x 0.5m)"];

    private static readonly string[] LegacyFacilityNames = ["SafeSpace Quận 7", "SSFRMS Chi nhánh Quận 7"];

    public static decimal SeedRate(decimal basePrice, bool cold, bool large) =>
        Math.Round(basePrice * (large ? 1.75m : 1m) * (cold ? 1.2m : 1m) / 10000m, MidpointRounding.AwayFromZero) * 10000m;

    private static async Task<SeedCatalog> EnsureCatalogAsync(AppDbContext context, long adminId)
    {
        var now = DateTime.UtcNow;

        // --- 4 loại kho
        async Task<UnitType> TypeAsync(string name, decimal area, decimal length, decimal width, bool cold, string description)
        {
            var type = await context.UnitTypes.FirstOrDefaultAsync(t => t.TypeName == name);
            if (type != null) return type;
            type = new UnitType
            {
                TypeName = name, Area = area, Length = length, Width = width, Height = 3.0m, ClimateControlled = cold,
                Description = description, Status = "ACTIVE", CreatedAt = now, UpdatedAt = now
            };
            context.UnitTypes.Add(type);
            await context.SaveChangesAsync();
            return type;
        }

        var normalM = await TypeAsync("Kho thường M", 15m, 5m, 3m, false, "Đồ đạc một phòng, hàng shop online, hồ sơ giấy tờ.");
        var normalL = await TypeAsync("Kho thường L", 30m, 6m, 5m, false, "Đồ chuyển nhà 2–3 phòng ngủ, hàng tồn kho số lượng lớn.");
        var coldM = await TypeAsync("Kho lạnh M", 15m, 5m, 3m, true, "Thiết bị điện tử, tài liệu, đồ gỗ cần tránh ẩm.");
        var coldL = await TypeAsync("Kho lạnh L", 30m, 6m, 5m, true, "Hàng hoá cần giữ nhiệt độ ổn định, kho hàng cho cửa hàng.");

        await RetireLegacyCatalogAsync(context);

        // --- Đổi tên cơ sở seed đời đầu (chỉ khi còn tên cũ)
        var oldTanBinh = await context.Facilities.FirstOrDefaultAsync(f => f.Name == "SSFRMS Chi nhánh Tân Bình");
        if (oldTanBinh != null && !await context.Facilities.AnyAsync(f => f.Name == "SafeSpace Tân Bình"))
        {
            oldTanBinh.Name = "SafeSpace Tân Bình";
            oldTanBinh.UpdatedAt = now;
            await context.SaveChangesAsync();
        }

        // --- 12 cơ sở, bảng giá, 12 ô mỗi cơ sở
        var effectiveFrom = DateOnly.FromDateTime(now.AddHours(7)).AddDays(-30);
        Facility? home = null;
        foreach (var seed in SafeSpaceFacilities)
        {
            var address = $"{seed.Street}, {seed.District}, TP. Hồ Chí Minh";
            var facility = await context.Facilities.FirstOrDefaultAsync(f => f.Name == seed.Name);
            if (facility == null)
            {
                facility = new Facility
                {
                    Name = seed.Name, Address = address, ContactPhone = seed.Phone,
                    OpeningTime = new TimeOnly(6, 0), ClosingTime = new TimeOnly(22, 0),
                    Status = "ACTIVE", CreatedAt = now, UpdatedAt = now
                };
                context.Facilities.Add(facility);
                await context.SaveChangesAsync();
            }
            else if (seed.OldAddress != null && facility.Address == seed.OldAddress)
            {
                // Địa chỉ seed cũ → địa chỉ theo Figma 14/10 (không đụng địa chỉ Vận hành KD đã tự sửa)
                facility.Address = address;
                facility.UpdatedAt = now;
            }
            home ??= facility;

            foreach (var (type, cold, large) in new[] { (normalM, false, false), (normalL, false, true), (coldM, true, false), (coldL, true, true) })
            {
                var hasRate = await context.RentalRates.AnyAsync(r => r.FacilityId == facility.FacilityId && r.UnitTypeId == type.UnitTypeId);
                if (!hasRate)
                {
                    context.RentalRates.Add(new RentalRate
                    {
                        FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId, SetBy = adminId,
                        MonthlyRate = SeedRate(seed.BasePrice, cold, large), EffectiveFrom = effectiveFrom,
                        Status = "ACTIVE", CreatedAt = now
                    });
                }
            }

            var existingCodes = await context.StorageUnits
                .Where(u => u.FacilityId == facility.FacilityId)
                .Select(u => u.UnitNumber)
                .ToListAsync();
            foreach (var (code, row, cold, large) in UnitLayout)
            {
                if (existingCodes.Contains(code)) continue;
                var type = cold ? (large ? coldL : coldM) : (large ? normalL : normalM);
                context.StorageUnits.Add(new StorageUnit
                {
                    FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId, UnitNumber = code,
                    Floor = "Tầng trệt", Zone = $"Dãy {row}",
                    LocationDescription = $"Tầng trệt · Dãy {row} · {(cold ? "Kho lạnh" : "Kho thường")} cỡ {(large ? "L" : "M")}",
                    Status = "AVAILABLE", CreatedAt = now, UpdatedAt = now
                });
            }
            await context.SaveChangesAsync();
        }

        return new SeedCatalog(home!, normalM, normalL, coldM, coldL);
    }

    /// <summary>Ngừng dùng loại kho cỡ S/M/L/XL và cơ sở "Quận 7" của bản seed cũ — giữ lại để không mất lịch sử.</summary>
    private static async Task RetireLegacyCatalogAsync(AppDbContext context)
    {
        var now = DateTime.UtcNow;
        var legacyTypes = await context.UnitTypes.Where(t => LegacyUnitTypeNames.Contains(t.TypeName)).ToListAsync();
        if (legacyTypes.Count > 0)
        {
            var ids = legacyTypes.Select(t => t.UnitTypeId).ToList();
            foreach (var t in legacyTypes.Where(t => t.Status == "ACTIVE"))
            {
                t.Status = "INACTIVE";
                t.UpdatedAt = now;
            }
            var rates = await context.RentalRates.Where(r => ids.Contains(r.UnitTypeId) && r.Status == "ACTIVE").ToListAsync();
            foreach (var r in rates) r.Status = "INACTIVE";
            // Ô trống của loại cũ không nhận khách mới; ô đang có khách giữ nguyên tới khi trả kho
            var units = await context.StorageUnits.Where(u => ids.Contains(u.UnitTypeId) && u.Status == "AVAILABLE").ToListAsync();
            foreach (var u in units)
            {
                u.Status = "OUT_OF_SERVICE";
                u.UpdatedAt = now;
            }
        }

        var legacyFacilities = await context.Facilities.Where(f => LegacyFacilityNames.Contains(f.Name) && f.Status == "ACTIVE").ToListAsync();
        foreach (var f in legacyFacilities)
        {
            var busy = await context.RentalContracts.AnyAsync(c => c.Unit.FacilityId == f.FacilityId && (c.Status == "ACTIVE" || c.Status == "EXPIRING" || c.Status == "OVERDUE" || c.Status == "RETURN_PENDING" || c.Status == "DRAFT"))
                       || await context.Reservations.AnyAsync(r => r.FacilityId == f.FacilityId && (r.Status == "PENDING_PAYMENT" || r.Status == "PENDING_VERIFICATION" || r.Status == "CONFIRMED" || r.Status == "UNIT_ASSIGNED"));
            f.Status = busy ? "TEMPORARILY_CLOSED" : "INACTIVE";
            f.UpdatedAt = now;
        }
        await context.SaveChangesAsync();
    }
}
