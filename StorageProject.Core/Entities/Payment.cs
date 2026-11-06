namespace StorageProject.Core.Entities;

/// <summary>
/// Giao dịch tài chính phát sinh trong hệ thống SafeSpace (tiền thuê, cọc, gia hạn, phí hư hại/vệ sinh, hoàn tiền).
/// </summary>
public class Payment
{
    /// <summary>Mã định danh giao dịch thanh toán.</summary>
    public long PaymentId { get; set; }

    /// <summary>Mã hợp đồng liên kết (nếu thanh toán gắn với hợp đồng).</summary>
    public long? ContractId { get; set; }

    /// <summary>Mã đơn đặt chỗ liên kết (nếu thanh toán gắn với đặt chỗ ban đầu).</summary>
    public long? ReservationId { get; set; }

    /// <summary>Mã yêu cầu gia hạn liên kết (nếu thanh toán gia hạn kỳ mới).</summary>
    public long? RenewalId { get; set; }

    /// <summary>
    /// Loại khoản thu/chi:
    /// DEPOSIT (tiền cọc), RENT (tiền thuê), RENEWAL (gia hạn), EXTRA_FEE, OVERDUE_FEE (phí quá hạn),
    /// DAMAGE_FEE (phí hư hại), CLEANING_FEE (phí vệ sinh), LOST_KEY_FEE, ACCESS_CARD_FEE, REFUND (hoàn tiền).
    /// </summary>
    public string PaymentType { get; set; } = null!;

    /// <summary>Số tiền giao dịch (VND).</summary>
    public decimal Amount { get; set; }

    /// <summary>Đơn vị tiền tệ (mặc định VND).</summary>
    public string Currency { get; set; } = "VND";

    /// <summary>Phương thức thanh toán: CASH (tiền mặt), BANK_TRANSFER, CARD, E_WALLET, PAYMENT_GATEWAY (PayOS).</summary>
    public string PaymentMethod { get; set; } = null!; // CASH, BANK_TRANSFER, CARD, E_WALLET, PAYMENT_GATEWAY

    /// <summary>Mã tham chiếu giao dịch ngân hàng / mã giao dịch PayOS / mã biên nhận tiền mặt.</summary>
    public string? TransactionReference { get; set; }

    /// <summary>Hạn thanh toán cuối cùng của khoản tiền.</summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>Thời điểm khách hàng hoặc hệ thống xác nhận đã thanh toán thành công.</summary>
    public DateTime? PaidAt { get; set; }

    /// <summary>
    /// Trạng thái thanh toán:
    /// PENDING (chờ thanh toán / chờ đối soát), PAID (đã thanh toán thành công), FAILED (thất bại),
    /// REFUNDED (đã hoàn lại), PARTIALLY_REFUNDED, CANCELLED (hủy bỏ / miễn phí theo D32).
    /// </summary>
    public string Status { get; set; } = "PENDING"; // PENDING, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED, CANCELLED

    /// <summary>Thời điểm tạo bản ghi thanh toán.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật bản ghi lần cuối.</summary>
    public DateTime UpdatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public Reservation Reservation { get; set; } = null!;
    public ContractRenewal? Renewal { get; set; }
    public ICollection<PaymentCheckout> Checkouts { get; set; } = [];
}
