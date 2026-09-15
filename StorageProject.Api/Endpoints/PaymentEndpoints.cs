using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class PaymentEndpoints
{
    public static RouteGroupBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Payments")
            .RequireAuthorization();

        group.MapGet("/contracts/{contractId:long}/payments", async (long contractId, ClaimsPrincipal user, IPaymentService paymentService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var payments = await paymentService.GetContractPaymentsAsync(customerId, contractId, ct);
            return Results.Ok(payments);
        });

        group.MapGet("/payments/{id:long}", async (long id, ClaimsPrincipal user, IPaymentService paymentService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var payment = await paymentService.GetPaymentByIdAsync(customerId, id, ct);
            return payment is not null ? Results.Ok(payment) : Results.NotFound(new { error = "Không tìm thấy thông tin thanh toán." });
        });

        return group;
    }
}
