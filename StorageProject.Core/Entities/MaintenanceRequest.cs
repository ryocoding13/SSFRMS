namespace StorageProject.Core.Entities;

public class MaintenanceRequest
{
    public long MaintenanceId { get; set; }
    public long UnitId { get; set; }
    public long? SupportTicketId { get; set; }
    public long ReportedBy { get; set; }
    public long? AssignedStaffId { get; set; }
    // INSPECTION, REPAIR, CLEANING, LOCK, ACCESS_SYSTEM, OTHER
    public string MaintenanceType { get; set; } = null!;
    public string IssueDescription { get; set; } = null!;
    public string Priority { get; set; } = "NORMAL"; // LOW, NORMAL, HIGH, URGENT
    public DateTime? ScheduledAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public decimal Cost { get; set; } = 0;
    public string Status { get; set; } = "OPEN"; // OPEN, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    public StorageUnit Unit { get; set; } = null!;
    public SupportTicket? SupportTicket { get; set; }
    public User ReportedByUser { get; set; } = null!;
    public User? AssignedStaff { get; set; }
}
