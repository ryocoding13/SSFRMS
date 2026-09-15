namespace StorageProject.Core.Entities;

public class RentalContract
{
    public long ContractId { get; set; }
    public long ReservationId { get; set; }
    public long CustomerId { get; set; }
    public long UnitId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal AgreedMonthlyRate { get; set; }
    public decimal DepositAmount { get; set; }
    // DRAFT, ACTIVE, EXPIRING, OVERDUE, RETURN_PENDING, COMPLETED, TERMINATED, CANCELLED
    public string Status { get; set; } = "DRAFT";
    public string? TerminationReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public Reservation Reservation { get; set; } = null!;
    public User Customer { get; set; } = null!;
    public StorageUnit Unit { get; set; } = null!;
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<ContractRenewal> ContractRenewals { get; set; } = [];
    public HandoverRecord? HandoverRecord { get; set; }
    public ICollection<AccessCredential> AccessCredentials { get; set; } = [];
    public ICollection<ReturnInspection> ReturnInspections { get; set; } = [];
    public ICollection<OverdueCase> OverdueCases { get; set; } = [];
    public ICollection<SupportTicket> SupportTickets { get; set; } = [];
}
