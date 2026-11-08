using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints phục vụ thu tiền gia hạn hợp đồng trực tiếp tại quầy cơ sở (S02 / D32).
/// Cho phép khách chọn nộp tiền mặt tại quầy, nhân viên xem hàng đợi thu tiền và xác nhận đã thu đủ tiền gia hạn.
/// </summary>
public static class CounterRenewalEndpoints
{
    /// <summary>
    /// Đăng ký các route thu tiền gia hạn tại quầy (/api/renewals/.../counter-payment, /api/ops/counter-renewals).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình quyền xác thực.</returns>
    public static RouteGroupBuilder MapCounterRenewalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Counter Renewals")
            .RequireAuthorization();

        // POST /api/renewals/{id:long}/counter-payment: Khách hàng chọn phương thức thanh toán tiền mặt tại quầy
        group.MapPost("/renewals/{id:long}/counter-payment", async (long id, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                await renewalService.SelectCounterPaymentAsync(customerId, id, ct);
                return Results.Ok(new { message = "Đã chuyển yêu cầu gia hạn sang thanh toán tại quầy cơ sở." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // GET /api/ops/counter-renewals: Danh sách hàng đợi các khoản gia hạn cần thu tiền tại quầy cho Nhân viên / Quản lý cơ sở
        group.MapGet("/ops/counter-renewals", async (ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try
            {
                var role = user.GetUserRole();
                if (role != "STAFF" && role != "MANAGER" && role != "ADMIN")
                {
                    return Results.Json(new { error = "Chỉ nhân viên hoặc quản lý cơ sở mới có quyền xem danh sách thu tại quầy." }, statusCode: StatusCodes.Status403Forbidden);
                }

                var userId = user.GetUserId();
                var items = await renewalService.GetCounterRenewalsAsync(userId, ct);
                return Results.Ok(items);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/ops/counter-renewals/actions: Nhân viên / Quản lý cơ sở xác nhận đã thu tiền gia hạn và kéo dài hợp đồng
        group.MapPost("/ops/counter-renewals/actions", async (CounterRenewalActionRequest request, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            try
            {
                var role = user.GetUserRole();
                if (role != "STAFF" && role != "MANAGER" && role != "ADMIN")
                {
                    return Results.Json(new { error = "Chỉ nhân viên hoặc quản lý cơ sở mới có quyền xác nhận thu tại quầy." }, statusCode: StatusCodes.Status403Forbidden);
                }

                if (request.Action != "COLLECT_RENEWAL")
                {
                    return Results.BadRequest(new { error = $"Hành động '{request.Action}' không hợp lệ. Chỉ chấp nhận 'COLLECT_RENEWAL'." });
                }

                var userId = user.GetUserId();
                await renewalService.CollectCounterRenewalAsync(userId, request.Id, ct);
                return Results.Ok(new { message = "Đã xác nhận thu tiền gia hạn tại quầy thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        return group;
    }
}
