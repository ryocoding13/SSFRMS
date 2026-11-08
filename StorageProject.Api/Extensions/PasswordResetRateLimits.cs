using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace StorageProject.Api.Extensions;

/// <summary>
/// Cấu hình chính sách giới hạn tần suất gửi yêu cầu (Rate Limiting) cho tính năng đặt lại mật khẩu.
/// Ngăn chặn tấn công brute-force hoặc spam gửi mã OTP qua email.
/// </summary>
public static class PasswordResetRateLimits
{
    /// <summary>
    /// Đăng ký các chính sách giới hạn tần suất đặt lại mật khẩu vào RateLimiterOptions.
    /// </summary>
    /// <param name="options">Tùy chọn cấu hình Rate Limiter của ASP.NET Core.</param>
    public static void Configure(RateLimiterOptions options)
    {
        options.OnRejected = async (context, ct) =>
        {
            var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry)
                ? Math.Max(1, (int)Math.Ceiling(retry.TotalSeconds)) : 60;
            context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
            await context.HttpContext.Response.WriteAsJsonAsync(new
            {
                error = "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.", retryAfterSeconds = seconds
            }, ct);
        };
        Add("password-reset-request", 10);
        Add("password-reset-confirm", 30);
        void Add(string name, int limit) => options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    }
}
