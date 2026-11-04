using Microsoft.AspNetCore.RateLimiting;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class PasswordResetEndpoints
{
    public static void MapPasswordResetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth/password-reset").WithTags("Authentication").AllowAnonymous();
        group.MapPost("/request", async (PasswordResetRequest request, IPasswordResetService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.RequestAsync(request, ct)); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (PasswordResetDeliveryException ex) { return Results.Json(new { error = ex.Message }, statusCode: 503); }
        }).RequireRateLimiting("password-reset-request");
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
