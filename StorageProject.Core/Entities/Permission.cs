namespace StorageProject.Core.Entities;

/// <summary>
/// Định nghĩa quyền hạn chi tiết trong hệ thống (Granular Permission).
/// </summary>
public class Permission
{
    /// <summary>Mã định danh quyền hạn.</summary>
    public long PermissionId { get; set; }

    /// <summary>Mã code quyền (ví dụ: MANAGE_FACILITIES, APPROVE_RENEWALS...).</summary>
    public string PermissionCode { get; set; } = null!;

    /// <summary>Tên hiển thị của quyền hạn.</summary>
    public string PermissionName { get; set; } = null!;

    /// <summary>Mô tả phạm vi tác động của quyền.</summary>
    public string? Description { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
