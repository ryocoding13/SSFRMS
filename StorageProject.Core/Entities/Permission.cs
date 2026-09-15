namespace StorageProject.Core.Entities;

public class Permission
{
    public long PermissionId { get; set; }
    public string PermissionCode { get; set; } = null!;
    public string PermissionName { get; set; } = null!;
    public string? Description { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
