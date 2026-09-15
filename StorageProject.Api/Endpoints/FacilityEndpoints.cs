using StorageProject.Core.DTOs.Facility;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class FacilityEndpoints
{
    public static RouteGroupBuilder MapFacilityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Facilities & Units");

        group.MapGet("/facilities", async (IFacilityService facilityService, CancellationToken ct) =>
        {
            var facilities = await facilityService.GetActiveFacilitiesAsync(ct);
            return Results.Ok(facilities);
        });

        group.MapGet("/facilities/{id:long}", async (long id, IFacilityService facilityService, CancellationToken ct) =>
        {
            var facility = await facilityService.GetFacilityByIdAsync(id, ct);
            return facility is not null ? Results.Ok(facility) : Results.NotFound(new { error = "Không tìm thấy cơ sở kho." });
        });

        group.MapGet("/unit-types", async (IFacilityService facilityService, CancellationToken ct) =>
        {
            var unitTypes = await facilityService.GetActiveUnitTypesAsync(ct);
            return Results.Ok(unitTypes);
        });

        group.MapGet("/unit-types/{id:long}", async (long id, IFacilityService facilityService, CancellationToken ct) =>
        {
            var unitType = await facilityService.GetUnitTypeByIdAsync(id, ct);
            return unitType is not null ? Results.Ok(unitType) : Results.NotFound(new { error = "Không tìm thấy loại kho." });
        });

        group.MapGet("/rates", async (long? facilityId, long? unitTypeId, IFacilityService facilityService, CancellationToken ct) =>
        {
            var rates = await facilityService.GetActiveRatesAsync(facilityId, unitTypeId, ct);
            return Results.Ok(rates);
        });

        group.MapPost("/availability/check", async (AvailabilityQueryRequest request, IFacilityService facilityService, CancellationToken ct) =>
        {
            var result = await facilityService.CheckAvailabilityAsync(request, ct);
            return result is not null ? Results.Ok(result) : Results.NotFound(new { error = "Không tìm thấy thông tin phù hợp để kiểm tra tình trạng kho." });
        });

        return group;
    }
}
