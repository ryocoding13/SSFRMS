namespace StorageProject.Core.Entities;

/// <summary>
/// Thử thách xác thực quên mật khẩu qua mã OTP gửi về Email (F43 / D35).
/// Chỉ lưu mã băm HMAC của OTP (không lưu OTP thô), giới hạn số lần thử và thời gian hết hạn (10 phút).
/// </summary>
public class PasswordResetChallenge
{
    /// <summary>Mã tài khoản người dùng yêu cầu đặt lại mật khẩu.</summary>
    public long UserId { get; set; }

    /// <summary>Địa chỉ email nhận mã OTP xác nhận.</summary>
    public string Email { get; set; } = "";

    /// <summary>Chuỗi băm HMAC-SHA256 của mã OTP 6 chữ số.</summary>
    public string CodeHash { get; set; } = "";

    /// <summary>Chuỗi ngẫu nhiên bảo mật dùng một lần (Nonce).</summary>
    public string Nonce { get; set; } = "";

    /// <summary>Dấu vân tay kiểm tra mật khẩu hiện tại để vô hiệu hóa khi mật khẩu đã đổi.</summary>
    public string PasswordFingerprint { get; set; } = "";

    /// <summary>Thời điểm gửi mã OTP vào email.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>Thời điểm hết hạn của mã OTP (mặc định sau 10 phút).</summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>Thời điểm mã OTP được sử dụng thành công.</summary>
    public DateTime? UsedAt { get; set; }

    /// <summary>Số lần nhập sai mã OTP (tối đa 5 lần sai sẽ bị khóa mã).</summary>
    public int FailedAttempts { get; set; }

    /// <summary>Thời điểm bắt đầu khung thời gian giới hạn tần suất gửi email (rate limit window).</summary>
    public DateTime WindowStartedAt { get; set; }

    /// <summary>Số lượt yêu cầu gửi mã trong khung thời gian (tối đa 5 lượt/giờ).</summary>
    public int RequestCount { get; set; }

    public User User { get; set; } = null!;
}
