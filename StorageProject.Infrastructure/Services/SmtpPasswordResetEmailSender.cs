using MimeKit;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.Interfaces;

namespace StorageProject.Infrastructure.Services;

public sealed class SmtpPasswordResetEmailSender(IConfiguration configuration) : IPasswordResetEmailSender
{
    private readonly SmtpMailTransport transport = new(configuration);

    public void ValidateConfiguration()
    {
        try { transport.ValidateConfiguration(); }
        catch (InvalidOperationException) { throw new PasswordResetDeliveryException(); }
    }

    public async Task SendAsync(string email, string code, CancellationToken ct = default)
    {
        var body = new TextPart("plain")
        {
            Text = $"Mã xác nhận đặt lại mật khẩu SafeSpace của bạn là: {code}\n\nMã có hiệu lực trong 10 phút và chỉ dùng một lần. Không chia sẻ mã này với bất kỳ ai.\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này."
        };
        try { await transport.SendAsync(email, "SafeSpace — Mã đặt lại mật khẩu", body, ct); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception) { throw new PasswordResetDeliveryException(); }
    }
}
