using System.Security.Claims;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Authentication");

        group.MapPost("/register", async (RegisterRequest request, IAuthService authService, CancellationToken ct) =>
        {
            try
            {
                var result = await authService.RegisterAsync(request, ct);
                return Results.Created($"/api/users/{result.UserId}", result);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/login", async (LoginRequest request, IAuthService authService, HttpContext httpContext, CancellationToken ct) =>
        {
            try
            {
                var ip = httpContext.Connection.RemoteIpAddress?.ToString();
                var userAgent = httpContext.Request.Headers.UserAgent.ToString();
                var result = await authService.LoginAsync(request, ip, userAgent, ct);
                return Results.Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Unauthorized();
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/logout", async (ClaimsPrincipal user, IAuthService authService, CancellationToken ct) =>
        {
            var historyClaim = user.FindFirst("loginHistoryId")?.Value;
            if (long.TryParse(historyClaim, out var historyId))
            {
                await authService.LogoutAsync(historyId, ct);
            }
            return Results.Ok(new { message = "Đăng xuất thành công." });
        }).RequireAuthorization();

        group.MapGet("/profile", async (ClaimsPrincipal user, IAuthService authService, CancellationToken ct) =>
        {
            try
            {
                var userId = StorageProject.Api.Extensions.ClaimsPrincipalExtensions.GetUserId(user);
                var profile = await authService.GetUserProfileAsync(userId, ct);
                return Results.Ok(profile);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        }).RequireAuthorization();

        group.MapPut("/profile", async (UpdateProfileRequest request, ClaimsPrincipal user, IAuthService authService, CancellationToken ct) =>
        {
            try
            {
                var userId = StorageProject.Api.Extensions.ClaimsPrincipalExtensions.GetUserId(user);
                var profile = await authService.UpdateUserProfileAsync(userId, request, ct);
                return Results.Ok(profile);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            // Trả lỗi tên không hợp lệ để C13 hiển thị ngay trong biểu mẫu.
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        group.MapPost("/change-password", async (ChangePasswordRequest request, ClaimsPrincipal user, IAuthService authService, CancellationToken ct) =>
        {
            try
            {
                var userId = StorageProject.Api.Extensions.ClaimsPrincipalExtensions.GetUserId(user);
                await authService.ChangePasswordAsync(userId, request, ct);
                return Results.Ok(new { message = "Đổi mật khẩu thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message, code = "BAD_PASSWORD" });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        }).RequireAuthorization();

        return group;
    }
}
