namespace StorageProject.Core.Entities;

public class PaymentCheckout
{
    public long CheckoutId { get; set; }
    public long PaymentId { get; set; }
    public long OrderCode { get; set; }
    public string Provider { get; set; } = "PAYOS"; // PAYOS
    public decimal Amount { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, PAID, CANCELLED, EXPIRED
    public string? CheckoutUrl { get; set; }
    public string? QrCode { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Payment Payment { get; set; } = null!;
}
