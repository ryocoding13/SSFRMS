namespace StorageProject.Core.Entities;

public class SupportTicket
{
    public long TicketId { get; set; }
    public long CustomerId { get; set; }
    public long? ContractId { get; set; }
    public long? UnitId { get; set; }
    public long? AssignedStaffId { get; set; }
    // UNIT, LOCK, ACCESS_CODE, ACCESS_CARD, PAYMENT, STORED_ITEM, OTHER
    public string IssueType { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Priority { get; set; } = "NORMAL"; // LOW, NORMAL, HIGH, URGENT
    public string Status { get; set; } = "OPEN"; // OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED
    public DateTime CreatedAt { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public User Customer { get; set; } = null!;
    public RentalContract? Contract { get; set; }
    public StorageUnit? Unit { get; set; }
    public User? AssignedStaff { get; set; }
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = [];
}
