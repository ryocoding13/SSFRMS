namespace StorageProject.Core.Entities;

/// <summary>
/// Bảng liên kết gán vai trò người dùng (User - Role mapping).
/// </summary>
public class UserRole
{
    /// <summary>Mã tài khoản người dùng.</summary>
    public long UserId { get; set; }

    /// <summary>Mã vai trò được gán.</summary>
    public long RoleId { get; set; }

    /// <summary>Mã tài khoản Admin thực hiện gán vai trò.</summary>
    public long? AssignedBy { get; set; }

    /// <summary>Thời điểm gán vai trò.</summary>
    public DateTime AssignedAt { get; set; }

    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
    public User? Assigner { get; set; }
}
