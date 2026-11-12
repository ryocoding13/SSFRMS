using System.Security.Claims;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints phục vụ xác thực và thông tin tài khoản người dùng (Authentication - UC01 / D03).
/// Quản lý đăng ký, đăng nhập JWT, đăng xuất, xem/cập nhật hồ sơ cá nhân và đổi mật khẩu.
/// </summary>
public static class AuthEndpoints
{
    /// <summary>
    /// Đăng ký các route xác thực (/api/auth) vào ứng dụng.
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api/auth đã cấu hình.</returns>
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Authentication");

        // POST /api/auth/register: Đăng ký tài khoản khách hàng mới (D03: username = email)
        group.MapPost("/register", async (RegisterRequest request, IAuthService authService, CancellationToken ct) =>
        {
            try
            {
                var result = await authService.RegisterAsync(request, ct);
                return Results.Created($"/api/users/{result.UserId}", result);
            }
            catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/auth/login: Đăng nhập hệ thống cấp JWT token
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
            catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/auth/logout: Đăng xuất và ghi nhận thời gian kết thúc phiên
        group.MapPost("/logout", async (ClaimsPrincipal user, IAuthService authService, CancellationToken ct) =>
        {
            var historyClaim = user.FindFirst("loginHistoryId")?.Value;
            if (long.TryParse(historyClaim, out var historyId))
            {
                await authService.LogoutAsync(historyId, ct);
            }
            return Results.Ok(new { message = "Đăng xuất thành công." });
        }).RequireAuthorization();

        // GET /api/auth/profile: Xem thông tin hồ sơ người dùng hiện tại
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

        // PUT /api/auth/profile: Cập nhật thông tin hồ sơ (họ tên, số điện thoại)
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
            // Trả lỗi tên / email không hợp lệ hoặc trùng lặp để C13 hiển thị ngay trong biểu mẫu.
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        // POST /api/auth/change-password: Đổi mật khẩu tài khoản
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
