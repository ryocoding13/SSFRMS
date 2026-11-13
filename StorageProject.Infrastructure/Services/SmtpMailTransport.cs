using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Configuration;

namespace StorageProject.Infrastructure.Services;

public interface ISmtpMailTransport
{
    Task SendAsync(string email, string subject, MimeEntity body, CancellationToken ct);
}

/// <summary>
/// SMTP chắc chắn chưa nhận thư (sai cấu hình, không kết nối/đăng nhập được, máy chủ từ chối lệnh).
/// Khác với lỗi giữa chừng khi đang truyền thư: lúc đó không biết thư đã đi hay chưa nên không tự gửi lại.
/// </summary>
public sealed class SmtpNotSentException(string reason, Exception? inner = null) : Exception(reason, inner)
{
    public string Reason { get; } = reason;
}

public sealed class SmtpMailTransport(IConfiguration configuration) : ISmtpMailTransport
{
    public void ValidateConfiguration() => ReadSettings();

    public async Task SendAsync(string email, string subject, MimeEntity body, CancellationToken ct)
    {
        (string Host, int Port, string From, string? Username, string? Password, SecureSocketOptions Security) settings;
        try { settings = ReadSettings(); }
        catch (InvalidOperationException ex) { throw new SmtpNotSentException("SMTP_CONFIG_INVALID", ex); }
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("SafeSpace", settings.From));
        message.To.Add(MailboxAddress.Parse(email));
        message.Subject = subject;
        message.Body = body;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        using var client = new SmtpClient { Timeout = 15000 };
        try
        {
            await client.ConnectAsync(settings.Host, settings.Port, settings.Security, timeout.Token);
            if (!string.IsNullOrEmpty(settings.Username))
                await client.AuthenticateAsync(settings.Username, settings.Password ?? "", timeout.Token);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) { throw new SmtpNotSentException("SMTP_CONNECT_FAILED", ex); }

        try { await client.SendAsync(message, timeout.Token); }
        catch (SmtpCommandException ex) { throw new SmtpNotSentException("SMTP_REJECTED", ex); }

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
            throw new InvalidOperationException("Cấu hình SMTP không hợp lệ.");
        return (host, port, from, username, password, mode);
    }
}
