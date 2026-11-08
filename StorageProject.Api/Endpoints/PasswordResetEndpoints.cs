using Microsoft.AspNetCore.RateLimiting;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints xử lý quy trình quên mật khẩu và đặt lại mật khẩu qua email (D35 / F43 / L24).
/// Hỗ trợ yêu cầu gửi mã OTP 6 số bảo mật qua SMTP và xác nhận đổi mật khẩu mới kèm Rate Limiting chống brute-force.
/// </summary>
public static class PasswordResetEndpoints
{
    /// <summary>
    /// Đăng ký các route đặt lại mật khẩu (/api/auth/password-reset/request, /api/auth/password-reset/confirm).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    public static void MapPasswordResetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth/password-reset").WithTags("Authentication").AllowAnonymous();

        // POST /api/auth/password-reset/request: Gửi yêu cầu đặt lại mật khẩu và mã OTP tới email
        group.MapPost("/request", async (PasswordResetRequest request, IPasswordResetService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.RequestAsync(request, ct)); }
            catch (EmailNotRegisteredException ex) { return Results.NotFound(new { error = ex.Message, code = "EMAIL_NOT_REGISTERED" }); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (PasswordResetDeliveryException ex) { return Results.Json(new { error = ex.Message }, statusCode: 503); }
        }).RequireRateLimiting("password-reset-request");

        // POST /api/auth/password-reset/confirm: Xác thực mã OTP và thiết lập mật khẩu mới
        group.MapPost("/confirm", async (PasswordResetConfirmRequest request, IPasswordResetService service, CancellationToken ct) =>
        {
            try
            {
                await service.ConfirmAsync(request, ct);
                return Results.Ok(new { message = "Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới." });
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (PasswordResetDeliveryException ex) { return Results.Json(new { error = ex.Message }, statusCode: 503); }
        }).RequireRateLimiting("password-reset-confirm");
    }
}
