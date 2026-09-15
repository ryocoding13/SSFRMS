namespace StorageProject.Core.Entities;

public class Reservation
{
    public long ReservationId { get; set; }
    public long CustomerId { get; set; }
    public long FacilityId { get; set; }
    public long UnitTypeId { get; set; }
    public DateOnly StartDate { get; set; }
    public int RentalPeriodMonths { get; set; }
    public DateOnly ExpectedEndDate { get; set; }
    public DateTime? CheckInAppointmentAt { get; set; }
    public decimal QuotedMonthlyRate { get; set; }
    public decimal EstimatedAmount { get; set; }
    public decimal RequiredDeposit { get; set; }
    // PENDING_PAYMENT, CONFIRMED, UNIT_ASSIGNED, CHECKED_IN, CANCELLED, EXPIRED, NO_SHOW
    public string Status { get; set; } = "PENDING_PAYMENT";
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    public User Customer { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public UnitType UnitType { get; set; } = null!;
    public ICollection<UnitAssignment> UnitAssignments { get; set; } = [];
    public RentalContract? RentalContract { get; set; }
}
