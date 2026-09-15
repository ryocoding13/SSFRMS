namespace StorageProject.Core.Entities;

public class UnitAssignment
{
    public long AssignmentId { get; set; }
    public long ReservationId { get; set; }
    public long UnitId { get; set; }
    public long AssignedBy { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, REPLACED, CANCELLED
    public DateTime AssignedAt { get; set; }
    public DateTime? UnassignedAt { get; set; }
    public string? Reason { get; set; }

    public Reservation Reservation { get; set; } = null!;
    public StorageUnit Unit { get; set; } = null!;
    public User AssignedByUser { get; set; } = null!;
}
