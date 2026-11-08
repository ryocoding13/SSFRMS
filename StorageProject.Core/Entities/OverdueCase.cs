namespace StorageProject.Core.Entities;

/// <summary>
/// Hồ sơ theo dõi và xử lý hợp đồng quá hạn (M04 / S05 / T11 / T12).
/// Khách hàng hết hạn hợp đồng nhưng chưa trả kho: tính phí quá hạn theo ngày (5%/ngày trần 100% cọc),
/// nhắc nhở mốc ngày 10-14, và chuyển sang thanh lý/di dời tài sản mốc ngày 20 (ESCALATED).
/// </summary>
public class OverdueCase
{
    /// <summary>Mã định danh hồ sơ quá hạn.</summary>
    public long OverdueCaseId { get; set; }

    /// <summary>Mã hợp đồng thuê bị quá hạn.</summary>
    public long ContractId { get; set; }

    /// <summary>Mã nhân viên cơ sở được phân công xử lý hồ sơ này.</summary>
    public long? AssignedStaffId { get; set; }

    /// <summary>Ngày bắt đầu bị tính là quá hạn (ngày liền sau EndDate).</summary>
    public DateOnly OverdueFrom { get; set; }

    /// <summary>Hạn chót thời gian ân hạn liên hệ.</summary>
    public DateOnly? GraceDeadline { get; set; }

    /// <summary>Tổng số tiền nợ/phí quá hạn lũy kế tính đến thời điểm hiện tại.</summary>
    public decimal OutstandingAmount { get; set; } = 0;

    /// <summary>
    /// Trạng thái xử lý hồ sơ quá hạn:
    /// OPEN (mới mở), CONTACTED (đã liên hệ khách), PAYMENT_PENDING (chờ khách trả nợ),
    /// RETURN_PENDING (khách đã đồng ý trả kho), RESOLVED (đã xử lý xong), ESCALATED (chuyển sang di dời tài sản ngày 20).
    /// </summary>
    public string Status { get; set; } = "OPEN"; // OPEN, CONTACTED, PAYMENT_PENDING, RETURN_PENDING, RESOLVED, ESCALATED

    /// <summary>Thời điểm mở hồ sơ quá hạn.</summary>
    public DateTime OpenedAt { get; set; }

    /// <summary>Thời điểm đóng/giải quyết xong hồ sơ.</summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>Nhật ký ghi chú các cuộc gọi, tin nhắn và phương án xử lý.</summary>
    public string? Notes { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User? AssignedStaff { get; set; }
}
