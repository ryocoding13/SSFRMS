using System.Security.Claims;
using System.Text.Json;
using StorageProject.Api.Extensions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints xử lý thanh toán, hóa đơn và Webhook từ cổng thanh toán PayOS (D02 / D23 / D33).
/// Quản lý tra cứu lịch sử thanh toán hợp đồng, tạo mã QR PayOS cho gia hạn và xác thực chữ ký Webhook thanh toán.
/// </summary>
public static class PaymentEndpoints
{
    /// <summary>
    /// Đăng ký các route thanh toán và webhook (/api/payments, /api/contracts/.../payments).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình quyền xác thực.</returns>
    public static RouteGroupBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Payments")
            .RequireAuthorization();

        // GET /api/contracts/{contractId}/payments: Xem lịch sử thanh toán của hợp đồng
        group.MapGet("/contracts/{contractId:long}/payments", async (long contractId, ClaimsPrincipal user, IPaymentService paymentService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var payments = await paymentService.GetContractPaymentsAsync(customerId, contractId, ct);
            return Results.Ok(payments);
        });

        // GET /api/payments/{id}: Xem chi tiết một khoản thanh toán cụ thể
        group.MapGet("/payments/{id:long}", async (long id, ClaimsPrincipal user, IPaymentService paymentService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var payment = await paymentService.GetPaymentByIdAsync(customerId, id, ct);
            return payment is not null ? Results.Ok(payment) : Results.NotFound(new { error = "Không tìm thấy thông tin thanh toán." });
        });

        // POST /api/payments/{id}/payos: Tạo phiên và mã QR PayOS thanh toán cho khoản gia hạn hoặc phụ phí
        group.MapPost("/payments/{id:long}/payos", async (long id, ClaimsPrincipal user, IPayOSService payOSService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var checkout = await payOSService.CreateRenewalPaymentQrAsync(customerId, id, ct);
                return Results.Ok(checkout);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/payments/payos-webhook: Webhook tiếp nhận thông báo thanh toán thành công tự động từ PayOS SDK
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

        // POST /api/v1/payments/payos-webhook: Webhook tiếp nhận thanh toán PayOS phiên bản v1
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
