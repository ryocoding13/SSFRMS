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

        return group;
    }
}
