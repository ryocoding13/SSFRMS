namespace StorageProject.Core.Entities;

public class ActivityLog
{
    public long LogId { get; set; }
    public long? UserId { get; set; }
    public string Action { get; set; } = null!;
    public string EntityType { get; set; } = null!;
    public long? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? IpAddress { get; set; }
    public DateTime LoggedAt { get; set; }

    public User? User { get; set; }
}
