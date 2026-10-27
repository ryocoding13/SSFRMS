namespace StorageProject.Core.Entities;

public class PolicyConsent
{
    public long ConsentId { get; set; }
    public long CustomerId { get; set; }
    public long PolicyVersionId { get; set; }
    public long? ReservationId { get; set; }
    public long? ContractId { get; set; }
    public long? RenewalId { get; set; }
    public DateTime AcceptedAt { get; set; }
    public string Channel { get; set; } = "WEB_CUSTOMER"; // WEB_CUSTOMER, COUNTER_CUSTOMER

    public User Customer { get; set; } = null!;
    public RentalPolicyVersion PolicyVersion { get; set; } = null!;
    public Reservation? Reservation { get; set; }
    public RentalContract? Contract { get; set; }
    public ContractRenewal? Renewal { get; set; }
}
