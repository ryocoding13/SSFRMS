namespace StorageProject.Core.Entities;

/// <summary>
/// Đơn đặt giữ chỗ kho tự phục vụ của khách hàng.
/// Quản lý chu kỳ từ lúc đặt giữ chỗ tạm thời (PENDING_PAYMENT), thanh toán qua VietQR/PayOS (PENDING_VERIFICATION / CONFIRMED),
/// gán ô kho (UNIT_ASSIGNED), bàn giao (CHECKED_IN), hoặc hủy/hết hạn (CANCELLED, EXPIRED).
/// </summary>
public class Reservation
{
    /// <summary>Mã định danh đơn đặt chỗ.</summary>
    public long ReservationId { get; set; }

    /// <summary>Mã khách hàng thực hiện đặt chỗ.</summary>
    public long CustomerId { get; set; }

    /// <summary>Mã cơ sở kho được chọn.</summary>
    public long FacilityId { get; set; }

    /// <summary>Loại kho (Cỡ M 15m2, Cỡ L 30m2, thường hoặc lạnh theo D17).</summary>
    public long UnitTypeId { get; set; }

    /// <summary>Ngày bắt đầu dự kiến thuê.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Số tháng thuê đã chọn (1, 3, hoặc 6 tháng theo D09).</summary>
    public int RentalPeriodMonths { get; set; }

    /// <summary>Ngày kết thúc dự kiến tính theo kỳ thuê.</summary>
    public DateOnly ExpectedEndDate { get; set; }

    /// <summary>Lịch hẹn đến cơ sở nhận kho (nếu có).</summary>
    public DateTime? CheckInAppointmentAt { get; set; }

    /// <summary>Đơn giá thuê mỗi tháng tại thời điểm đặt (đọc từ bảng giá ACTIVE).</summary>
    public decimal QuotedMonthlyRate { get; set; }

    /// <summary>Ước tính tổng tiền thuê cả kỳ.</summary>
    public decimal EstimatedAmount { get; set; }

    /// <summary>Số tiền cọc yêu cầu (mặc định 1 tháng tiền thuê theo D09/D32).</summary>
    public decimal RequiredDeposit { get; set; }

    /// <summary>Phương thức thanh toán: PAYOS hoặc AT_FACILITY.</summary>
    public string PaymentMethod { get; set; } = "PAYOS"; // PAYOS / AT_FACILITY

    /// <summary>
    /// Trạng thái đơn đặt chỗ:
    /// PENDING_PAYMENT, PENDING_VERIFICATION (khách báo đã chuyển khoản, chờ đối soát),
    /// CONFIRMED, UNIT_ASSIGNED, CHECKED_IN, CANCELLED, EXPIRED, NO_SHOW.
    /// </summary>
    public string Status { get; set; } = "PENDING_PAYMENT";

    /// <summary>Lý do hủy đơn (nếu khách hủy hoặc quản lý hủy).</summary>
    public string? CancellationReason { get; set; }

    /// <summary>Mã đơn hàng giao dịch PayOS (OrderCode).</summary>
    public long? OrderCode { get; set; }

    /// <summary>Đường link ảnh QR thanh toán PayOS VietQR.</summary>
    public string? PaymentQrUrl { get; set; }

    /// <summary>Đường link trang cổng thanh toán PayOS.</summary>
    public string? CheckoutUrl { get; set; }

    /// <summary>Thời điểm khách hoàn tất thanh toán.</summary>
    public DateTime? PaidAt { get; set; }

    /// <summary>Thời điểm tạo đơn đặt chỗ.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm hết hạn giữ chỗ tạm thời (nếu quá hạn sẽ tự huỷ).</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Thời điểm đơn bị hủy (nếu có).</summary>
    public DateTime? CancelledAt { get; set; }

    /// <summary>Tên ngân hàng chính chủ nhận hoàn tiền khi huỷ đơn đã thanh toán (D32 / T08).</summary>
    public string? RefundBankName { get; set; }

    /// <summary>Số tài khoản ngân hàng chính chủ nhận hoàn tiền (D32 / T08).</summary>
    public string? RefundAccountNumber { get; set; }

    /// <summary>Tên chủ tài khoản ngân hàng chính chủ nhận hoàn tiền (D32 / T08).</summary>
    public string? RefundAccountHolder { get; set; }

    public User Customer { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public UnitType UnitType { get; set; } = null!;
    public ICollection<UnitAssignment> UnitAssignments { get; set; } = [];
    public RentalContract? RentalContract { get; set; }
    public ICollection<PolicyConsent> PolicyConsents { get; set; } = [];
}
