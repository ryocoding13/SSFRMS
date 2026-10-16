using System.Security.Claims;
using System.Text.Json;
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

        // PayOS Webhook endpoints (AllowAnonymous)
        app.MapPost("/api/payments/payos-webhook",
            async (
                HttpRequest httpRequest,
                IPayOSService payOSService,
                ILogger<Program> logger,
                CancellationToken ct) =>
        {
            using var reader = new StreamReader(httpRequest.Body);
            string bodyText = await reader.ReadToEndAsync(ct);

            try
            {
                using var json = JsonDocument.Parse(bodyText);

                string? signature = json.RootElement
                    .GetProperty("signature")
                    .GetString();

                bool success = await payOSService
                    .ProcessWebhookAsync(bodyText, signature, ct);

                logger.LogInformation(
                    "Webhook processing result: {Success}", success);

                return success
                    ? Results.Ok(new { success = true })
                    : Results.BadRequest(new
                    {
                        success = false,
                        message = "Webhook processing failed"
                    });
            }
            catch (JsonException ex)
            {
                logger.LogWarning(ex, "Invalid webhook JSON");
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Invalid webhook JSON"
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Webhook processing error");
                return Results.Problem(
                    "Webhook processing error",
                    statusCode: 500);
            }
        })
        .AllowAnonymous()
        .WithTags("Payments");

        app.MapPost("/api/v1/payments/payos-webhook", async (HttpRequest httpRequest, IPayOSService payOSService, CancellationToken ct) =>
        {
            using var reader = new StreamReader(httpRequest.Body);
            string bodyText = await reader.ReadToEndAsync(ct);
            string? signature = httpRequest.Headers["x-payos-signature"];

            bool success = await payOSService.ProcessWebhookAsync(bodyText, signature, ct);
            return success ? Results.Ok(new { success = true }) : Results.BadRequest(new { success = false, message = "Webhook processing failed" });
        }).AllowAnonymous().WithTags("Payments (v1)");

        return group;
    }
}
