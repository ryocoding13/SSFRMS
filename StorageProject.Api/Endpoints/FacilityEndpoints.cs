using StorageProject.Core.DTOs.Facility;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints tra cứu danh mục cơ sở, loại ô kho, bảng giá và kiểm tra phòng trống (UC01 / F01 / D17).
/// Cho phép khách xem 12 cơ sở SafeSpace, lọc theo khu vực/loại kho, tra cứu giá niêm yết và kiểm tra khả dụng theo ngày.
/// </summary>
public static class FacilityEndpoints
{
    /// <summary>
    /// Đăng ký các route tra cứu cơ sở và mặt bằng kho (/api/facilities, /api/unit-types, /api/rates, /api/availability).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình.</returns>
    public static RouteGroupBuilder MapFacilityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Facilities & Units");

        // GET /api/facilities: Lấy danh sách toàn bộ các cơ sở kho đang hoạt động (D17: 12 cơ sở)
        group.MapGet("/facilities", async (IFacilityService facilityService, CancellationToken ct) =>
        {
            var facilities = await facilityService.GetActiveFacilitiesAsync(ct);
            return Results.Ok(facilities);
        });

        // GET /api/facilities/{id}: Xem thông tin chi tiết một cơ sở cụ thể
        group.MapGet("/facilities/{id:long}", async (long id, IFacilityService facilityService, CancellationToken ct) =>
        {
            var facility = await facilityService.GetFacilityByIdAsync(id, ct);
            return facility is not null ? Results.Ok(facility) : Results.NotFound(new { error = "Không tìm thấy cơ sở kho." });
        });

        // GET /api/unit-types: Danh sách các loại ô kho (Kho thường, Kho lạnh cỡ M 15m² và L 30m² theo D17)
        group.MapGet("/unit-types", async (IFacilityService facilityService, CancellationToken ct) =>
        {
            var unitTypes = await facilityService.GetActiveUnitTypesAsync(ct);
            return Results.Ok(unitTypes);
        });

        // GET /api/unit-types/{id}: Chi tiết một loại ô kho
        group.MapGet("/unit-types/{id:long}", async (long id, IFacilityService facilityService, CancellationToken ct) =>
        {
            var unitType = await facilityService.GetUnitTypeByIdAsync(id, ct);
            return unitType is not null ? Results.Ok(unitType) : Results.NotFound(new { error = "Không tìm thấy loại kho." });
        });

        // GET /api/rates: Bảng giá thuê kho niêm yết theo cơ sở và loại ô (D16: chỉ lấy giá ACTIVE)
        group.MapGet("/rates", async (long? facilityId, long? unitTypeId, IFacilityService facilityService, CancellationToken ct) =>
        {
            var rates = await facilityService.GetActiveRatesAsync(facilityId, unitTypeId, ct);
            return Results.Ok(rates);
        });

        // POST /api/availability/check: Kiểm tra số lượng ô kho còn trống theo ngày và cơ sở (D41)
        group.MapPost("/availability/check", async (AvailabilityQueryRequest request, IFacilityService facilityService, CancellationToken ct) =>
        {
            var result = await facilityService.CheckAvailabilityAsync(request, ct);
            return result is not null ? Results.Ok(result) : Results.NotFound(new { error = "Không tìm thấy thông tin phù hợp để kiểm tra tình trạng kho." });
        });

        // GET /api/facilities/{id}/units: Lấy danh sách ô kho và sơ đồ mặt bằng vật lý của cơ sở (D13/D17/D41/#3)
        group.MapGet("/facilities/{id:long}/units", async (long id, DateOnly? startDate, int? months, IFacilityService facilityService, CancellationToken ct) =>
        {
            var units = await facilityService.GetUnitsByFacilityIdAsync(id, startDate, months, ct);
            return Results.Ok(units);
        });

        return group;
    }
}
