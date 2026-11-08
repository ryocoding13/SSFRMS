using System.Globalization;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ cấp và xác thực mã OTP đặt lại mật khẩu (PasswordResetService) thực thi IPasswordResetService.
/// Triển khai theo quy chuẩn bảo mật: mã OTP 6 số ngẫu nhiên, HMACSHA256, hạn 10 phút,
/// giới hạn tối đa 5 lần gửi/giờ và khoá sau 5 lần nhập sai. Đóng toàn bộ phiên cũ sau khi đổi mật khẩu thành công.
/// </summary>
public sealed class PasswordResetService(AppDbContext db, IPasswordResetEmailSender sender,
    IConfiguration configuration, TimeProvider clock) : IPasswordResetService
{
    public const string InvalidCodeMessage = "Mã xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới nếu cần.";
    private const string AcceptedMessage = "Nếu email đã đăng ký và tài khoản được phép khôi phục, bạn sẽ nhận được mã xác nhận. Vui lòng kiểm tra cả thư rác.";

    /// <summary>
    /// Tiếp nhận yêu cầu gửi mã OTP đặt lại mật khẩu qua email.
    /// </summary>
    /// <param name="request">Yêu cầu chứa email người dùng.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thông báo xác nhận đã tiếp nhận yêu cầu.</returns>
    /// <exception cref="EmailNotRegisteredException">Ném ra nếu email chưa từng đăng ký trên hệ thống (L24).</exception>
    public async Task<PasswordResetRequestedDto> RequestAsync(PasswordResetRequest request, CancellationToken ct = default)
    {
        var email = NormalizeEmail(request.Email);
        var key = HashKey();
        sender.ValidateConfiguration();
        var reply = new PasswordResetRequestedDto(AcceptedMessage);
        // L24 (D40, Thắng chốt 04/11): email chưa đăng ký thì báo rõ. Tài khoản bị khoá/ngừng vẫn trả câu chung.
        if (!await db.Users.AsNoTracking().AnyAsync(x => x.Email.ToUpper() == email, ct))
            throw new EmailNotRegisteredException();
        var userId = await UniqueActiveUserIdAsync(email, ct);
        if (userId == null) return reply;

        // Khoá trong DB dùng chung giữa các instance, cả request và confirm cùng một tài khoản.
        await using var tx = await CheckoutTransaction.BeginAsync(db, $"password-reset:{userId}", ct);
        var user = await db.Users.SingleAsync(u => u.UserId == userId, ct);
        if (user.Status != "ACTIVE" || !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase)) return reply;
        var challenge = await db.PasswordResetChallenges.SingleOrDefaultAsync(x => x.UserId == userId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        if (challenge != null && now < challenge.SentAt.AddSeconds(60)) return reply;
        if (challenge != null && now < challenge.WindowStartedAt.AddHours(1) && challenge.RequestCount >= 5) return reply;
        if (challenge == null)
        {
            challenge = new PasswordResetChallenge { UserId = user.UserId, WindowStartedAt = now };
            db.PasswordResetChallenges.Add(challenge);
        }
        if (now >= challenge.WindowStartedAt.AddHours(1))
        {
            challenge.WindowStartedAt = now;
            challenge.RequestCount = 0;
        }
        string code;
        do { code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture); }
        while (HashCode(key, challenge, code) == challenge.CodeHash);
        challenge.Email = email;
        challenge.Nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        challenge.PasswordFingerprint = Fingerprint(user.PasswordHash);
        challenge.CodeHash = HashCode(key, challenge, code);
        challenge.SentAt = now;
        challenge.ExpiresAt = now.AddMinutes(10);
        challenge.FailedAttempts = 0;
        challenge.UsedAt = null;
        challenge.RequestCount++;

        // Nếu SMTP lỗi, rollback giữ nguyên mã cũ; không báo đã gửi hoặc trả mã ra response.
        await sender.SendAsync(user.Email, code, ct);
        // SMTP đã nhận thư. Việc khách rời trang không được làm mất hiệu lực mã vừa gửi.
        await db.SaveChangesAsync(CancellationToken.None);
        await tx.CommitAsync(CancellationToken.None);
        return reply;
    }

    /// <summary>
    /// Xác thực mã OTP và cập nhật mật khẩu mới cho người dùng.
    /// Sau khi đổi thành công, hủy toàn bộ phiên làm việc cũ để đảm bảo an toàn.
    /// </summary>
    /// <param name="request">Yêu cầu xác nhận gồm email, mã OTP và mật khẩu mới.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task ConfirmAsync(PasswordResetConfirmRequest request, CancellationToken ct = default)
    {
        var email = NormalizeEmail(request.Email);
        var password = request.NewPassword ?? "";
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8 || Encoding.UTF8.GetByteCount(password) > 72)
            throw new ArgumentException("Mật khẩu mới cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.");
        var code = request.Code ?? "";
        // Chuỗi sai định dạng cũng tính là một lần thử khi đã có mã đang dùng.
        if (code.Length > 100) code = "";
        var key = HashKey();
        var userId = await UniqueActiveUserIdAsync(email, ct);
        if (userId == null) throw new ArgumentException(InvalidCodeMessage);
        await using var tx = await CheckoutTransaction.BeginAsync(db, $"password-reset:{userId}", ct);
        var user = await db.Users.SingleAsync(u => u.UserId == userId, ct);
        var challenge = await db.PasswordResetChallenges.SingleOrDefaultAsync(x => x.UserId == userId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        if (user.Status != "ACTIVE" || challenge == null || challenge.UsedAt != null ||
            now >= challenge.ExpiresAt || challenge.FailedAttempts >= 5 ||
            challenge.Email != email || !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase) ||
            challenge.PasswordFingerprint != Fingerprint(user.PasswordHash))
            throw new ArgumentException(InvalidCodeMessage);

        var actual = Encoding.ASCII.GetBytes(HashCode(key, challenge, code));
        var expected = Encoding.ASCII.GetBytes(challenge.CodeHash);
        if (code.Length != 6 || code.Any(c => c < '0' || c > '9') || !CryptographicOperations.FixedTimeEquals(actual, expected))
        {
            challenge.FailedAttempts++;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            throw new ArgumentException(InvalidCodeMessage);
        }

        if (BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new ArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        user.UpdatedAt = now;
        challenge.UsedAt = now;
        challenge.CodeHash = "";
        var sessions = await db.LoginHistories.Where(x => x.UserId == userId && x.LogoutAt == null).ToListAsync(ct);
        foreach (var session in sessions) session.LogoutAt = now;
        db.ActivityLogs.Add(new ActivityLog { UserId = user.UserId, Action = "PASSWORD_RESET_COMPLETED",
            EntityType = "USER", EntityId = user.UserId, LoggedAt = now });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private async Task<long?> UniqueActiveUserIdAsync(string email, CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking().Where(x => x.Email.ToUpper() == email)
            .Select(x => new { x.UserId, x.Status }).Take(2).ToListAsync(ct);
        return users.Count == 1 && users[0].Status == "ACTIVE" ? users[0].UserId : null;
    }

    private byte[] HashKey()
    {
        var key = configuration["PasswordReset:HashKey"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new PasswordResetDeliveryException();
        return Encoding.UTF8.GetBytes(key);
    }

    private static string NormalizeEmail(string? value)
    {
        var email = (value ?? "").Trim();
        if (email.Length > 255 || !MailAddress.TryCreate(email, out var address) || address.Address != email || !email.Contains('@'))
            throw new ArgumentException("Nhập email hợp lệ.");
        return email.ToUpperInvariant();
    }

    private static string Fingerprint(string hash) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(hash)));
    private static string HashCode(byte[] key, PasswordResetChallenge c, string code) =>
        Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{c.UserId}:{c.Email}:{c.Nonce}:{code}")));
}
