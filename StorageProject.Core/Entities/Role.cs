namespace StorageProject.Core.Entities;

public class Role
{
    public long RoleId { get; set; }
    public string RoleName { get; set; } = null!;
    public string? Description { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];
    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
