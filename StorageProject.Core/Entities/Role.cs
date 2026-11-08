namespace StorageProject.Core.Entities;

/// <summary>
/// Định nghĩa danh mục vai trò người dùng trong hệ thống SafeSpace (ADMIN, MANAGER, STAFF, OPERATIONS, CUSTOMER).
/// </summary>
public class Role
{
    /// <summary>Mã định danh vai trò.</summary>
    public long RoleId { get; set; }

    /// <summary>Tên mã vai trò (ví dụ: ADMIN, MANAGER, STAFF, OPERATIONS, CUSTOMER).</summary>
    public string RoleName { get; set; } = null!;

    /// <summary>Mô tả chi tiết quyền hạn và trách nhiệm của vai trò.</summary>
    public string? Description { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];
    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
