namespace StorageProject.Core.Entities;

/// <summary>
/// Bảng liên kết quyền hạn vào vai trò (Role - Permission mapping).
/// </summary>
public class RolePermission
{
    /// <summary>Mã vai trò.</summary>
    public long RoleId { get; set; }

    /// <summary>Mã quyền hạn được trao.</summary>
    public long PermissionId { get; set; }

    public Role Role { get; set; } = null!;
    public Permission Permission { get; set; } = null!;
}
