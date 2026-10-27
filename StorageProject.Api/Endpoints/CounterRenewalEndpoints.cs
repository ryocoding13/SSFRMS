using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class CounterRenewalEndpoints
{
    public static RouteGroupBuilder MapCounterRenewalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Counter Renewals")
            .RequireAuthorization();

        // POST /api/renewals/{id:long}/counter-payment — Customer selects counter payment
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

        // GET /api/ops/counter-renewals — Staff / Manager queue
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

        // POST /api/ops/counter-renewals/actions — Staff / Manager confirm cash collection
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
