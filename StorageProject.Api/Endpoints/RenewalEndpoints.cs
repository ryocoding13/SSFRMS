using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class RenewalEndpoints
{
    public static RouteGroupBuilder MapRenewalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Contract Renewals")
            .RequireAuthorization();

        group.MapGet("/contracts/{contractId:long}/renewals", async (long contractId, ClaimsPrincipal user, IRenewalService renewalService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var renewals = await renewalService.GetContractRenewalsAsync(customerId, contractId, ct);
            return Results.Ok(renewals);
        });

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

        // L5 (D40): một ô chỉ có một yêu cầu đang xử lý; khách huỷ gia hạn chờ duyệt để trả kho.
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
