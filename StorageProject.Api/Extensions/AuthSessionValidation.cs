using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Api.Extensions;

/// <summary>
/// Hỗ trợ kiểm tra tính hợp lệ của phiên đăng nhập (JWT Session Validation) qua cơ sở dữ liệu.
/// Đảm bảo token vẫn còn trong phiên hoạt động (chưa logout) và tài khoản người dùng vẫn ACTIVE.
/// </summary>
public static class AuthSessionValidation
{
    /// <summary>
    /// Xác thực thông tin phiên đăng nhập từ TokenValidatedContext của JwtBearer.
    /// </summary>
    /// <param name="context">Ngữ cảnh token sau khi được giải mã thành công.</param>
    /// <returns>Task đại diện cho thao tác bất đồng bộ.</returns>
    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var value = context.Principal?.FindFirst("loginHistoryId")?.Value;
        if (!long.TryParse(value, out var historyId))
        {
            context.Fail("Phiên đăng nhập không hợp lệ.");
            return;
        }
        var userValue = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userValue, out var userId)) { context.Fail("Phiên đăng nhập không hợp lệ."); return; }
        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        if (!await db.LoginHistories.AsNoTracking().AnyAsync(x => x.LoginHistoryId == historyId &&
            x.UserId == userId && x.LogoutAt == null && x.User.Status == "ACTIVE", context.HttpContext.RequestAborted))
            context.Fail("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
}
