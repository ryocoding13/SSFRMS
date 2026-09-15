namespace StorageProject.Core.Entities;

public class Payment
{
    public long PaymentId { get; set; }
    public long ContractId { get; set; }
    public long? RenewalId { get; set; }
    // DEPOSIT, RENT, RENEWAL, EXTRA_FEE, OVERDUE_FEE, DAMAGE_FEE, CLEANING_FEE,
    // LOST_KEY_FEE, ACCESS_CARD_FEE, REFUND
    public string PaymentType { get; set; } = null!;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "VND";
    public string PaymentMethod { get; set; } = null!; // CASH, BANK_TRANSFER, CARD, E_WALLET, PAYMENT_GATEWAY
    public string? TransactionReference { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public ContractRenewal? Renewal { get; set; }
}
