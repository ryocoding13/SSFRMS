namespace StorageProject.Core.Entities;

public class UserRole
{
    public long UserId { get; set; }
    public long RoleId { get; set; }
    public long? AssignedBy { get; set; }
    public DateTime AssignedAt { get; set; }

    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
    public User? Assigner { get; set; }
}
