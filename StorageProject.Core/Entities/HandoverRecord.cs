namespace StorageProject.Core.Entities;

public class HandoverRecord
{
    public long HandoverId { get; set; }
    public long ContractId { get; set; }
    public long StaffId { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime? HandoverAt { get; set; }
    public string? InitialCondition { get; set; }
    public string? Notes { get; set; }
    public bool CustomerConfirmed { get; set; } = false;
    public bool StaffConfirmed { get; set; } = false;
    public string Status { get; set; } = "SCHEDULED"; // SCHEDULED, VERIFIED, HANDED_OVER, CANCELLED
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User Staff { get; set; } = null!;
}
