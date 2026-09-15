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

        return group;
    }
}
