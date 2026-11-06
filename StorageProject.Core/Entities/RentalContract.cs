namespace StorageProject.Core.Entities;

/// <summary>
/// Hợp đồng thuê kho chính thức giữa khách hàng và SafeSpace.
/// Quản lý toàn bộ vòng đời hợp đồng: DRAFT (chờ kích hoạt), ACTIVE (đang thuê), EXPIRING (sắp hết hạn),
/// OVERDUE (quá hạn), RETURN_PENDING (chờ trả kho), COMPLETED (hoàn tất trả kho & thanh lý cọc),
/// TERMINATED (chấm dứt do sự cố cơ sở hoặc vi phạm), CANCELLED (hủy trước khi nhận kho).
/// </summary>
public class RentalContract
{
    /// <summary>Mã định danh hợp đồng (ví dụ HĐ-0001).</summary>
    public long ContractId { get; set; }

    /// <summary>Mã đơn đặt chỗ gốc tương ứng.</summary>
    public long ReservationId { get; set; }

    /// <summary>Mã khách hàng đứng tên hợp đồng.</summary>
    public long CustomerId { get; set; }

    /// <summary>Mã ô kho vật lý được gán cho hợp đồng.</summary>
    public long UnitId { get; set; }

    /// <summary>Ngày bắt đầu tính hạn hợp đồng.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Ngày kết thúc hợp đồng hiện tại (chỉ được kéo dài khi gia hạn đã thanh toán xong theo D32).</summary>
    public DateOnly EndDate { get; set; }

    /// <summary>Đơn giá thuê mỗi tháng đã thống nhất.</summary>
    public decimal AgreedMonthlyRate { get; set; }

    /// <summary>Số tiền đặt cọc giữ kho (mặc định 1 tháng tiền thuê theo D09/D32).</summary>
    public decimal DepositAmount { get; set; }

    /// <summary>
    /// Trạng thái hợp đồng:
    /// DRAFT, ACTIVE, EXPIRING, OVERDUE, RETURN_PENDING, COMPLETED, TERMINATED, CANCELLED.
    /// </summary>
    public string Status { get; set; } = "DRAFT";

    /// <summary>Lý do chấm dứt hoặc hủy hợp đồng (nếu có).</summary>
    public string? TerminationReason { get; set; }

    /// <summary>Thời điểm tạo hợp đồng trong hệ thống.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm kích hoạt hợp đồng (bàn giao kho thành công).</summary>
    public DateTime? ActivatedAt { get; set; }

    /// <summary>Thời điểm hợp đồng hoàn tất thủ tục trả kho và thanh lý cọc.</summary>
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
    public ICollection<PolicyConsent> PolicyConsents { get; set; } = [];
}
