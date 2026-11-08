using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints quản lý yêu cầu gia hạn hợp đồng thuê kho (UC06 / D32 / M01 / L5).
/// Cho phép khách xem lịch sử các lần gia hạn, tạo yêu cầu gia hạn mới và hủy yêu cầu gia hạn đang chờ duyệt.
/// </summary>
public static class RenewalEndpoints
{
    /// <summary>
    /// Đăng ký các route gia hạn hợp đồng (/api/contracts/.../renewals, /api/renewals/.../cancel).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình quyền xác thực.</returns>
    public static RouteGroupBuilder MapRenewalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Contract Renewals")
            .RequireAuthorization();

        // GET /api/contracts/{contractId}/renewals: Xem danh sách các lần gia hạn của hợp đồng
        group.MapGet("/contracts/{contractId:long}/renewals", async (long contractId, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var renewals = await renewalService.GetContractRenewalsAsync(customerId, contractId, ct);
            return Results.Ok(renewals);
        });

        // POST /api/contracts/{contractId}/renewals: Khách hàng gửi yêu cầu gia hạn thêm kỳ hạn thuê (D32)
        group.MapPost("/contracts/{contractId:long}/renewals", async (long contractId, CreateRenewalRequest request, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var renewal = await renewalService.RequestRenewalAsync(customerId, contractId, request, ct);
                return Results.Created($"/api/contracts/{contractId}/renewals/{renewal.RenewalId}", renewal);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/renewals/{renewalId}/cancel: Khách hàng huỷ yêu cầu gia hạn đang chờ duyệt (L5 / D40)
        group.MapPost("/renewals/{renewalId:long}/cancel", async (long renewalId, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try
            {
                await renewalService.CancelRenewalAsync(user.GetUserId(), renewalId, ct);
                return Results.NoContent();
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
        }).RequireAuthorization(p => p.RequireRole("CUSTOMER"));

        // D46 · Gia hạn sang ô khác: ô trống chọn được (cùng loại, hoặc về loại đã đặt ban đầu sau nâng cấp miễn phí)
        group.MapGet("/contracts/{contractId:long}/renewal-units", async (long contractId, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try { return Results.Ok(await renewalService.GetRenewalUnitOptionsAsync(user.GetUserId(), contractId, ct)); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        }).RequireAuthorization(p => p.RequireRole("CUSTOMER"));

        // D46 · Trạng thái chuyển ô của hợp đồng (204 khi không có)
        group.MapGet("/contracts/{contractId:long}/unit-move", async (long contractId, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try { return await renewalService.GetUnitMoveAsync(user.GetUserId(), contractId, ct) is { } move ? Results.Ok(move) : Results.NoContent(); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        }).RequireAuthorization(p => p.RequireRole("CUSTOMER"));

        // D46 · Khách bấm "Đã chuyển đồ" trong 3 ngày cuối kỳ cũ: mã ô cũ hết hiệu lực, cấp QR/PIN ô mới
        group.MapPost("/contracts/{contractId:long}/unit-move/done", async (long contractId, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try { return Results.Ok(await renewalService.MarkUnitMovedAsync(user.GetUserId(), contractId, ct)); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
        }).RequireAuthorization(p => p.RequireRole("CUSTOMER"));

        // D46 · Nhân viên / quản lý: việc kiểm tra ô cũ sau khi khách chuyển sang ô mới
        group.MapGet("/ops/unit-moves", async (ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try { return Results.Ok(await renewalService.GetOldUnitInspectionsAsync(user.GetUserId(), ct)); }
            catch (UnauthorizedAccessException ex) { return Results.Json(new { error = ex.Message }, statusCode: 403); }
        }).RequireAuthorization(p => p.RequireRole("STAFF", "MANAGER"));

        group.MapPost("/ops/unit-moves/{renewalId:long}/inspection", async (long renewalId, UnitMoveInspectionRequest request, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try { return Results.Ok(await renewalService.InspectOldUnitAsync(user.GetUserId(), renewalId, request, ct)); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Results.Json(new { error = ex.Message }, statusCode: 403); }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return Results.BadRequest(new { error = ex.Message }); }
        }).RequireAuthorization(p => p.RequireRole("STAFF", "MANAGER"));

        return group;
    }
}
