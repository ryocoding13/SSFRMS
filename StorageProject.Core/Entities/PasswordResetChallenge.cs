namespace StorageProject.Core.Entities;

public class PasswordResetChallenge
{
    public long UserId { get; set; }
    public string Email { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public string Nonce { get; set; } = "";
    public string PasswordFingerprint { get; set; } = "";
    public DateTime SentAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public int FailedAttempts { get; set; }
    public DateTime WindowStartedAt { get; set; }
    public int RequestCount { get; set; }
    public User User { get; set; } = null!;
}
