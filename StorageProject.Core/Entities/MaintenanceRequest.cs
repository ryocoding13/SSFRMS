namespace StorageProject.Core.Entities;

/// <summary>
/// Yêu cầu sửa chữa, bảo trì kỹ thuật hoặc dọn dẹp vệ sinh ô kho.
/// </summary>
public class MaintenanceRequest
{
    /// <summary>Mã định danh yêu cầu bảo trì.</summary>
    public long MaintenanceId { get; set; }

    /// <summary>Mã ô kho cần bảo trì.</summary>
    public long UnitId { get; set; }

    /// <summary>Mã yêu cầu hỗ trợ của khách hàng dẫn đến việc bảo trì này (nếu có).</summary>
    public long? SupportTicketId { get; set; }

    /// <summary>Mã người dùng (nhân viên/quản lý) báo cáo yêu cầu bảo trì.</summary>
    public long ReportedBy { get; set; }

    /// <summary>Mã nhân viên được phân công thực hiện bảo trì.</summary>
    public long? AssignedStaffId { get; set; }

    /// <summary>
    /// Loại hình bảo trì:
    /// INSPECTION (kiểm định), REPAIR (sửa chữa), CLEANING (dọn dẹp),
    /// LOCK (thay khóa), ACCESS_SYSTEM (hệ thống điện tử), OTHER.
    /// </summary>
    public string MaintenanceType { get; set; } = null!;

    /// <summary>Mô tả chi tiết sự cố kỹ thuật cần xử lý.</summary>
    public string IssueDescription { get; set; } = null!;

    /// <summary>Mức độ ưu tiên: LOW, NORMAL, HIGH, URGENT.</summary>
    public string Priority { get; set; } = "NORMAL"; // LOW, NORMAL, HIGH, URGENT

    /// <summary>Lịch dự kiến thực hiện bảo trì.</summary>
    public DateTime? ScheduledAt { get; set; }

    /// <summary>Thời điểm bắt đầu tiến hành xử lý.</summary>
    public DateTime? StartedAt { get; set; }

    /// <summary>Thời điểm hoàn tất việc bảo trì.</summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>Chi phí thực hiện bảo trì (nếu có).</summary>
    public decimal Cost { get; set; } = 0;

    /// <summary>Trạng thái bảo trì: OPEN, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED.</summary>
    public string Status { get; set; } = "OPEN"; // OPEN, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

    /// <summary>Ghi chú kỹ thuật về vật tư thay thế hoặc phương án xử lý.</summary>
    public string? Notes { get; set; }

    /// <summary>Thời điểm tạo yêu cầu bảo trì.</summary>
    public DateTime CreatedAt { get; set; }

    public StorageUnit Unit { get; set; } = null!;
    public SupportTicket? SupportTicket { get; set; }
    public User ReportedByUser { get; set; } = null!;
    public User? AssignedStaff { get; set; }
}
