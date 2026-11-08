namespace StorageProject.Core.Entities;

/// <summary>
/// Đại diện cho một ô kho vật lý tại một cơ sở (ví dụ K01, K02...).
/// Mỗi cơ sở có 12 ô kho: 8 kho thường (4 M + 4 L) và 4 kho lạnh (2 M + 2 L) theo quyết định D17.
/// </summary>
public class StorageUnit
{
    /// <summary>Khóa chính định danh ô kho.</summary>
    public long UnitId { get; set; }

    /// <summary>Mã cơ sở chứa ô kho này.</summary>
    public long FacilityId { get; set; }

    /// <summary>Mã loại kho (diện tích M/L, thường/lạnh).</summary>
    public long UnitTypeId { get; set; }

    /// <summary>Mã số ô kho (ví dụ: A-K01, B-K08...).</summary>
    public string UnitNumber { get; set; } = null!;

    /// <summary>Tầng của ô kho.</summary>
    public string? Floor { get; set; }

    /// <summary>Khu vực trong cơ sở (dãy A hoặc dãy B).</summary>
    public string? Zone { get; set; }

    /// <summary>Mô tả vị trí chi tiết của ô kho.</summary>
    public string? LocationDescription { get; set; }

    /// <summary>
    /// Trạng thái vật lý và vận hành của ô kho:
    /// AVAILABLE (trống, sẵn sàng cho thuê), RESERVED (đang giữ chỗ), ASSIGNED (đã phân bổ cho khách),
    /// OCCUPIED (đang có khách thuê), RETURN_PENDING (đang chờ kiểm tra trả kho),
    /// INSPECTION (đang kiểm kê), MAINTENANCE (bảo trì / dọn dẹp vệ sinh), OUT_OF_SERVICE (ngừng hoạt động).
    /// </summary>
    public string Status { get; set; } = "AVAILABLE";

    /// <summary>Thời điểm tạo ô kho.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật trạng thái ô kho lần gần nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public Facility Facility { get; set; } = null!;
    public UnitType UnitType { get; set; } = null!;
    public ICollection<UnitStatusHistory> StatusHistories { get; set; } = [];
    public ICollection<UnitAssignment> UnitAssignments { get; set; } = [];
    public ICollection<RentalContract> RentalContracts { get; set; } = [];
    public ICollection<AccessCredential> AccessCredentials { get; set; } = [];
    public ICollection<SupportTicket> SupportTickets { get; set; } = [];
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = [];
}
