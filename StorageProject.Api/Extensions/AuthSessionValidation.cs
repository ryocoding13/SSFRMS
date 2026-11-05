using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Api.Extensions;

public static class AuthSessionValidation
{
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
