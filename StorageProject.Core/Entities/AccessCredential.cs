namespace StorageProject.Core.Entities;

public class AccessCredential
{
    public long CredentialId { get; set; }
    public long ContractId { get; set; }
    public long UnitId { get; set; }
    public long IssuedBy { get; set; }
    public string CredentialType { get; set; } = null!; // KEY, LOCK, ACCESS_CARD, ACCESS_CODE
    public string? CredentialReference { get; set; }
    public string? SecretHash { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, RETURNED, LOST, REVOKED, REPLACED

    public RentalContract Contract { get; set; } = null!;
    public StorageUnit Unit { get; set; } = null!;
    public User IssuedByUser { get; set; } = null!;
}
