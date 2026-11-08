namespace StorageProject.Core.Entities;

/// <summary>
/// Lịch sử thay đổi trạng thái của ô kho vật lý (SRS 8.1 / UC09).
/// </summary>
public class UnitStatusHistory
{
    /// <summary>Mã định danh bản ghi lịch sử trạng thái.</summary>
    public long StatusHistoryId { get; set; }

    /// <summary>Mã ô kho có trạng thái thay đổi.</summary>
    public long UnitId { get; set; }

    /// <summary>Mã người dùng (nhân viên/quản lý) thực hiện thay đổi.</summary>
    public long ChangedBy { get; set; }

    /// <summary>Trạng thái trước khi đổi.</summary>
    public string? OldStatus { get; set; }

    /// <summary>Trạng thái mới sau khi đổi.</summary>
    public string NewStatus { get; set; } = null!;

    /// <summary>Lý do cập nhật trạng thái.</summary>
    public string? Reason { get; set; }

    /// <summary>Thời điểm chuyển đổi trạng thái.</summary>
    public DateTime ChangedAt { get; set; }

    public StorageUnit Unit { get; set; } = null!;
    public User ChangedByUser { get; set; } = null!;
}
