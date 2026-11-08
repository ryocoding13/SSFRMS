namespace StorageProject.Core.Entities;

/// <summary>
/// Yêu cầu hỗ trợ kỹ thuật hoặc khiếu nại của khách hàng có hợp đồng thuê kho (UC11 / C12).
/// Hỗ trợ đính kèm tối đa 3 ảnh minh chứng (D35) và chủ đề nhận chìa khóa lần đầu (D36).
/// </summary>
public class SupportTicket
{
    /// <summary>Mã định danh yêu cầu hỗ trợ.</summary>
    public long TicketId { get; set; }

    /// <summary>Mã khách hàng gửi yêu cầu.</summary>
    public long CustomerId { get; set; }

    /// <summary>Mã hợp đồng thuê liên quan (nếu có).</summary>
    public long? ContractId { get; set; }

    /// <summary>Mã ô kho liên quan (nếu có).</summary>
    public long? UnitId { get; set; }

    /// <summary>Mã nhân viên cơ sở được phân công xử lý yêu cầu.</summary>
    public long? AssignedStaffId { get; set; }

    /// <summary>
    /// Loại vấn đề:
    /// UNIT (ô kho), LOCK (khóa), ACCESS_CODE (mã truy cập), ACCESS_CARD (thẻ từ),
    /// PAYMENT (thanh toán), STORED_ITEM (đồ đạc), KEY_PICKUP (nhận chìa khóa theo D36), OTHER.
    /// </summary>
    public string IssueType { get; set; } = null!;

    /// <summary>Tiêu đề yêu cầu hỗ trợ.</summary>
    public string Title { get; set; } = null!;

    /// <summary>Nội dung mô tả chi tiết sự việc hoặc yêu cầu của khách.</summary>
    public string Description { get; set; } = null!;

    /// <summary>Mức độ ưu tiên: LOW, NORMAL, HIGH, URGENT.</summary>
    public string Priority { get; set; } = "NORMAL"; // LOW, NORMAL, HIGH, URGENT

    /// <summary>
    /// Trạng thái yêu cầu:
    /// OPEN (mới tạo), ASSIGNED (đã phân công), IN_PROGRESS (đang xử lý), RESOLVED (đã giải quyết), CLOSED, CANCELLED.
    /// </summary>
    public string Status { get; set; } = "OPEN"; // OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED

    /// <summary>Thời điểm khách hàng gửi yêu cầu.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm phân công nhân viên xử lý.</summary>
    public DateTime? AssignedAt { get; set; }

    /// <summary>Thời điểm nhân viên hoàn tất giải quyết.</summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>Thời điểm đóng yêu cầu hỗ trợ.</summary>
    public DateTime? ClosedAt { get; set; }

    public User Customer { get; set; } = null!;
    public RentalContract? Contract { get; set; }
    public StorageUnit? Unit { get; set; }
    public User? AssignedStaff { get; set; }
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = [];
}
