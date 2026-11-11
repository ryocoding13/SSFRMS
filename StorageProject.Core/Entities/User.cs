namespace StorageProject.Core.Entities;

/// <summary>
/// Đại diện cho tài khoản người dùng trong hệ thống SSFRMS (Khách hàng, Nhân viên, Quản lý, Vận hành KD, Admin).
/// Khách hàng dùng email làm username theo quyết định D03.
/// </summary>
public class User
{
    /// <summary>Khóa chính định danh người dùng.</summary>
    public long UserId { get; set; }

    /// <summary>Tên đăng nhập (Khách hàng dùng email theo D03; tài khoản nội bộ có username riêng như staff01, manager01...).</summary>
    public string Username { get; set; } = null!;

    /// <summary>Chuỗi mã hóa mật khẩu.</summary>
    public string PasswordHash { get; set; } = null!;

    /// <summary>Họ và tên đầy đủ của người dùng.</summary>
    public string FullName { get; set; } = null!;

    /// <summary>Địa chỉ email chính thức (dùng để đăng nhập, nhận OTP reset mật khẩu và thông báo).</summary>
    public string Email { get; set; } = null!;

    /// <summary>Số điện thoại liên hệ.</summary>
    public string? Phone { get; set; }

    /// <summary>Trạng thái tài khoản: ACTIVE, INACTIVE, LOCKED, SUSPENDED.</summary>
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, INACTIVE, LOCKED, SUSPENDED

    /// <summary>Thời điểm tạo tài khoản (UTC).</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật thông tin lần gần nhất (UTC).</summary>
    public DateTime UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];
    public ICollection<UserFacility> UserFacilities { get; set; } = [];
    public ICollection<LoginHistory> LoginHistories { get; set; } = [];
    public ICollection<ActivityLog> ActivityLogs { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
    public ICollection<RentalContract> RentalContracts { get; set; } = [];
    public ICollection<SupportTicket> SupportTickets { get; set; } = [];
}
