using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.Interfaces;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ gửi email chứa mã OTP đặt lại mật khẩu qua giao thức SMTP (MailKit) thực thi IPasswordResetEmailSender.
/// Hỗ trợ bảo mật StartTls / SslOnConnect, cấu hình cổng và timeout an toàn.
/// </summary>
public sealed class SmtpPasswordResetEmailSender(IConfiguration configuration) : IPasswordResetEmailSender
{
    /// <summary>
    /// Kiểm tra tính hợp lệ của các thông số cấu hình SMTP (Host, Port, FromEmail, Username, Password, Security).
    /// </summary>
    /// <exception cref="PasswordResetDeliveryException">Ném ra nếu cấu hình SMTP bị thiếu hoặc không hợp lệ.</exception>
    public void ValidateConfiguration() => ReadSettings();

    /// <summary>
    /// Gửi email chứa mã OTP 6 số tới địa chỉ người dùng qua SMTP client.
    /// </summary>
    /// <param name="email">Địa chỉ email người nhận.</param>
    /// <param name="code">Mã OTP đặt lại mật khẩu.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <exception cref="PasswordResetDeliveryException">Ném ra nếu kết nối hoặc quá trình gửi thư qua SMTP gặp lỗi.</exception>
    public async Task SendAsync(string email, string code, CancellationToken ct = default)
    {
        var settings = ReadSettings();
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("SafeSpace", settings.From));
        message.To.Add(MailboxAddress.Parse(email));
        message.Subject = "SafeSpace — Mã đặt lại mật khẩu";
        message.Body = new TextPart("plain") { Text = $"Mã xác nhận đặt lại mật khẩu SafeSpace của bạn là: {code}\n\nMã có hiệu lực trong 10 phút và chỉ dùng một lần. Không chia sẻ mã này với bất kỳ ai.\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này." };
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        using var client = new SmtpClient { Timeout = 15000 };
        try
        {
            await client.ConnectAsync(settings.Host, settings.Port, settings.Security, timeout.Token);
            if (!string.IsNullOrEmpty(settings.Username))
                await client.AuthenticateAsync(settings.Username, settings.Password ?? "", timeout.Token);
            await client.SendAsync(message, timeout.Token);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception) { throw new PasswordResetDeliveryException(); }

        // SMTP đã nhận thư; lỗi hoặc hủy khi ngắt kết nối không thay đổi kết quả gửi.
        try { await client.DisconnectAsync(true, timeout.Token); }
        catch (Exception) { }
    }

    private (string Host, int Port, string From, string? Username, string? Password, SecureSocketOptions Security) ReadSettings()
    {
        var host = configuration["Smtp:Host"] ?? "";
        var from = configuration["Smtp:FromEmail"] ?? "";
        var username = configuration["Smtp:Username"];
        var password = configuration["Smtp:Password"];
        var security = configuration["Smtp:Security"] ?? "StartTls";
        var loopback = host is "127.0.0.1" or "localhost" or "::1";
        if (string.IsNullOrWhiteSpace(host) || !MailboxAddress.TryParse(from, out _) ||
            !int.TryParse(configuration["Smtp:Port"] ?? "587", out var port) || port is < 1 or > 65535 ||
            (!loopback && (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))) ||
            !Enum.TryParse<SecureSocketOptions>(security, true, out var mode) ||
            (mode != SecureSocketOptions.StartTls && mode != SecureSocketOptions.SslOnConnect && !(loopback && mode == SecureSocketOptions.None)))
            throw new PasswordResetDeliveryException();
        return (host, port, from, username, password, mode);
    }
}
