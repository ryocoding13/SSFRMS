namespace StorageProject.Core.Entities;

/// <summary>
/// Nhật ký lịch sử đăng nhập của người dùng.
/// </summary>
public class LoginHistory
{
    /// <summary>Mã định danh bản ghi đăng nhập.</summary>
    public long LoginHistoryId { get; set; }

    /// <summary>Mã tài khoản người dùng đăng nhập.</summary>
    public long UserId { get; set; }

    /// <summary>Thời điểm đăng nhập thành công hoặc thất bại.</summary>
    public DateTime LoginAt { get; set; }

    /// <summary>Thời điểm đăng xuất phiên làm việc (nếu có).</summary>
    public DateTime? LogoutAt { get; set; }

    /// <summary>Địa chỉ IP của thiết bị đăng nhập.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Thông tin thiết bị, trình duyệt (User-Agent).</summary>
    public string? DeviceInfo { get; set; }

    /// <summary>Trạng thái đăng nhập: SUCCESS, FAILED, BLOCKED.</summary>
    public string LoginStatus { get; set; } = null!; // SUCCESS, FAILED, BLOCKED

    public User User { get; set; } = null!;
}
