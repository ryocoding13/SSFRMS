using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Lượt 6 · #48–#51 (D51): cửa mô phỏng — máy quét (không đăng nhập, giới hạn tần suất như /access/scan),
/// nút "Đóng cửa" của khách và nhật ký cửa cho Công cụ demo của admin. Không tự khoá cửa.
/// </summary>
public static class DoorEndpoints
{
    public static void MapDoorEndpoints(this IEndpointRouteBuilder app)
    {
        var device = app.MapGroup("/api/access").WithTags("Access & QR");

        device.MapGet("/door", (string? unitNumber, long? facilityId, IDoorService doors, CancellationToken ct) =>
                Run(async () => Results.Ok(await doors.GetUnitStateAsync(unitNumber, facilityId, ct))))
            .AllowAnonymous().RequireRateLimiting("access-scan")
            .WithSummary("Trạng thái cửa mô phỏng của ô (OPEN / LOCKED) và thời điểm cập nhật");

        device.MapPost("/door/close", (DoorUnitRequest request, HttpContext http, IDoorService doors, CancellationToken ct) =>
                Run(async () => Results.Ok(await doors.CloseFromDeviceAsync(request.UnitNumber, request.FacilityId, http.Connection.RemoteIpAddress?.ToString(), ct))))
            .AllowAnonymous().RequireRateLimiting("access-scan")
            .WithSummary("Nút Đóng cửa trên máy quét — cửa đang đóng thì không ghi trùng (D51: không tự khoá)");

        device.MapPost("/support", (DoorSupportRequest request, HttpContext http, IDoorService doors, CancellationToken ct) =>
                Run(async () => Results.Ok(await doors.RequestSupportAsync(request, http.Connection.RemoteIpAddress?.ToString(), ct))))
            .AllowAnonymous().RequireRateLimiting("access-scan")
            .WithSummary("#50: gửi hỗ trợ từ máy quét tới nhân viên cơ sở; trong 30 phút trả lại yêu cầu đang mở, không tạo trùng");

        var customer = app.MapGroup("/api/contracts").WithTags("Access & QR").RequireAuthorization();

        customer.MapGet("/{id}/door", (string id, ClaimsPrincipal user, IDoorService doors, CancellationToken ct) =>
            Run(async () => ContractId(id) is long cid ? Results.Ok(await doors.GetContractDoorAsync(user.GetUserId(), cid, ct)) : Results.NotFound(new { error = "Không tìm thấy hợp đồng." })));

        customer.MapPost("/{id}/door/close", (string id, ClaimsPrincipal user, IDoorService doors, CancellationToken ct) =>
            Run(async () => ContractId(id) is long cid ? Results.Ok(await doors.CloseByCustomerAsync(user.GetUserId(), cid, ct)) : Results.NotFound(new { error = "Không tìm thấy hợp đồng." })))
            .WithSummary("Khách bấm Đóng cửa trong Kho của tôi — chỉ cần xác nhận, không nhập lại QR/PIN");

        app.MapGet("/api/admin/door-logs", (long? facilityId, string? unitNumber, string? result, DateOnly? from, DateOnly? to, int? page, int? pageSize,
                IDoorService doors, CancellationToken ct) =>
                Run(async () => Results.Ok(await doors.GetDoorLogsAsync(new DoorLogFilter(facilityId, unitNumber, result, from, to, page ?? 1, pageSize ?? 20), ct))))
            .WithTags("Admin Management").RequireAuthorization(p => p.RequireRole("ADMIN"))
            .WithSummary("#49: nhật ký cửa (mở / từ chối / đóng), lọc theo cơ sở, ô, kết quả, ngày; không trả nguyên QR/PIN");
    }

    /// <summary>Nhận "12" hoặc mã hiển thị "HĐ-2026-0012".</summary>
    private static long? ContractId(string id) =>
        long.TryParse(id, out var v) ? v : long.TryParse(id.Split('-').LastOrDefault(), out v) ? v : null;

    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
    }
}
