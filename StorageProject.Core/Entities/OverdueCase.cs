namespace StorageProject.Core.Entities;

public class OverdueCase
{
    public long OverdueCaseId { get; set; }
    public long ContractId { get; set; }
    public long? AssignedStaffId { get; set; }
    public DateOnly OverdueFrom { get; set; }
    public DateOnly? GraceDeadline { get; set; }
    public decimal OutstandingAmount { get; set; } = 0;
    // OPEN, CONTACTED, PAYMENT_PENDING, RETURN_PENDING, RESOLVED, ESCALATED
    public string Status { get; set; } = "OPEN";
    public DateTime OpenedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? Notes { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User? AssignedStaff { get; set; }
}
