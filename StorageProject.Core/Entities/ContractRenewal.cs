namespace StorageProject.Core.Entities;

public class ContractRenewal
{
    public long RenewalId { get; set; }
    public long ContractId { get; set; }
    public long? ApprovedBy { get; set; }
    public DateOnly OldEndDate { get; set; }
    public DateOnly NewEndDate { get; set; }
    public int RenewalPeriodMonths { get; set; }
    public decimal OldMonthlyRate { get; set; }
    public decimal NewMonthlyRate { get; set; }
    public decimal RenewalAmount { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED, PAID, CANCELLED, EXPIRED
    public DateTime RequestedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? PaymentDeadlineAt { get; set; }
    public DateTime? AppliedAt { get; set; }
    public DateTime? ExpiredAt { get; set; }
    public int? PolicyVersion { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User? ApprovedByUser { get; set; }
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<PolicyConsent> PolicyConsents { get; set; } = [];
}
