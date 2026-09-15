namespace StorageProject.Core.Entities;

public class LoginHistory
{
    public long LoginHistoryId { get; set; }
    public long UserId { get; set; }
    public DateTime LoginAt { get; set; }
    public DateTime? LogoutAt { get; set; }
    public string? IpAddress { get; set; }
    public string? DeviceInfo { get; set; }
    public string LoginStatus { get; set; } = null!; // SUCCESS, FAILED, BLOCKED

    public User User { get; set; } = null!;
}
