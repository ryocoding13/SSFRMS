using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class ContractEndpoints
{
    public static RouteGroupBuilder MapContractEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Contracts & Handovers")
            .RequireAuthorization();

        group.MapGet("/contracts", async (ClaimsPrincipal user, IContractService contractService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var contracts = await contractService.GetMyContractsAsync(customerId, ct);
            return Results.Ok(contracts);
        });

        group.MapGet("/contracts/{id:long}", async (long id, ClaimsPrincipal user, IContractService contractService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var detail = await contractService.GetContractDetailAsync(customerId, id, ct);
            return detail is not null ? Results.Ok(detail) : Results.NotFound(new { error = "Không tìm thấy hợp đồng." });
        });

        group.MapPost("/handovers/{id:long}/confirm", async (long id, ClaimsPrincipal user, IHandoverService handoverService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                await handoverService.ConfirmCustomerHandoverAsync(customerId, id, ct);
                return Results.Ok(new { message = "Khách hàng đã xác nhận bàn giao kho thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        return group;
    }
}
