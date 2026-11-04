using StorageProject.Core.DTOs.Auth;

namespace StorageProject.Core.Interfaces;

public interface IPasswordResetService
{
    Task<PasswordResetRequestedDto> RequestAsync(PasswordResetRequest request, CancellationToken ct = default);
    Task ConfirmAsync(PasswordResetConfirmRequest request, CancellationToken ct = default);
}

public interface IPasswordResetEmailSender
{
    void ValidateConfiguration();
    Task SendAsync(string email, string code, CancellationToken ct = default);
}

public sealed class PasswordResetDeliveryException : Exception
{
    public PasswordResetDeliveryException() : base("Chưa gửi được mã xác nhận. Vui lòng thử lại sau hoặc liên hệ nhân viên hỗ trợ.") { }
}
