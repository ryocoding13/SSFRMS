namespace StorageProject.Core.Entities;

/// <summary>
/// Yêu cầu gia hạn hợp đồng thuê kho (C09 / M01).
/// Theo D32: Khi Quản lý duyệt gia hạn, hệ thống chỉ tạo khoản thu RENEWAL PENDING và tính hạn thanh toán;
/// tuyệt đối KHÔNG tự động kéo dài EndDate của hợp đồng cho đến khi khách thanh toán thành công (PAID).
/// </summary>
public class ContractRenewal
{
    /// <summary>Mã định danh yêu cầu gia hạn.</summary>
    public long RenewalId { get; set; }

    /// <summary>Mã hợp đồng thuê được gia hạn.</summary>
    public long ContractId { get; set; }

    /// <summary>Mã tài khoản quản lý cơ sở duyệt yêu cầu.</summary>
    public long? ApprovedBy { get; set; }

    /// <summary>Ngày kết thúc hợp đồng trước khi gia hạn.</summary>
    public DateOnly OldEndDate { get; set; }

    /// <summary>Ngày kết thúc mới dự kiến sau khi gia hạn.</summary>
    public DateOnly NewEndDate { get; set; }

    /// <summary>Số tháng gia hạn thêm (1, 3, hoặc 6 tháng).</summary>
    public int RenewalPeriodMonths { get; set; }

    /// <summary>Đơn giá thuê mỗi tháng cũ.</summary>
    public decimal OldMonthlyRate { get; set; }

    /// <summary>Đơn giá thuê mỗi tháng mới (theo bảng giá ACTIVE tại thời điểm gia hạn).</summary>
    public decimal NewMonthlyRate { get; set; }

    /// <summary>Tổng số tiền cần thanh toán cho kỳ gia hạn mới.</summary>
    public decimal RenewalAmount { get; set; }

    /// <summary>
    /// Trạng thái yêu cầu gia hạn:
    /// PENDING (chờ duyệt), APPROVED (đã duyệt, chờ khách thanh toán), REJECTED (từ chối),
    /// PAID (khách đã thanh toán, đã áp dụng ngày mới), CANCELLED (khách hủy yêu cầu), EXPIRED (quá hạn thanh toán).
    /// </summary>
    public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED, PAID, CANCELLED, EXPIRED

    /// <summary>Thời điểm khách hàng gửi yêu cầu gia hạn.</summary>
    public DateTime RequestedAt { get; set; }

    /// <summary>Thời điểm Quản lý cơ sở duyệt yêu cầu gia hạn.</summary>
    public DateTime? ApprovedAt { get; set; }

    /// <summary>Hạn chót thanh toán gia hạn = min(thời điểm duyệt + 24 giờ, 23:59 ngày EndDate giờ VN).</summary>
    public DateTime? PaymentDeadlineAt { get; set; }

    /// <summary>Thời điểm hợp đồng chính thức được áp dụng ngày kết thúc mới (sau khi thanh toán PAID).</summary>
    public DateTime? AppliedAt { get; set; }

    /// <summary>Thời điểm yêu cầu bị hết hạn do khách không thanh toán đúng hạn.</summary>
    public DateTime? ExpiredAt { get; set; }

    /// <summary>Phiên bản điều khoản cho thuê mà khách đã chấp thuận tại thời điểm gia hạn (D32 / T20).</summary>
    public int? PolicyVersion { get; set; }

    /// <summary>Thời điểm khách hàng đồng ý phiên bản điều khoản cho thuê mới.</summary>
    public DateTime? AcceptedAt { get; set; }

    /// <summary>Thời điểm tạo bản ghi.</summary>
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User? ApprovedByUser { get; set; }
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<PolicyConsent> PolicyConsents { get; set; } = [];
}
