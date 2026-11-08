namespace StorageProject.Core.Entities;

/// <summary>
/// Bản ghi phân bổ ô kho cụ thể cho đơn đặt chỗ (M05 / Quản lý cơ sở phân bổ).
/// </summary>
public class UnitAssignment
{
    /// <summary>Mã định danh bản ghi phân bổ.</summary>
    public long AssignmentId { get; set; }

    /// <summary>Mã đơn đặt chỗ được phân bổ.</summary>
    public long ReservationId { get; set; }

    /// <summary>Mã ô kho vật lý được gán.</summary>
    public long UnitId { get; set; }

    /// <summary>Mã tài khoản quản lý thực hiện phân bổ ô kho.</summary>
    public long? AssignedBy { get; set; }

    /// <summary>Trạng thái phân bổ: ACTIVE (đang gán), REPLACED (đã đổi ô khác), CANCELLED.</summary>
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, REPLACED, CANCELLED

    /// <summary>Thời điểm gán ô kho.</summary>
    public DateTime AssignedAt { get; set; }

    /// <summary>Thời điểm hủy gán ô kho (nếu đổi ô).</summary>
    public DateTime? UnassignedAt { get; set; }

    /// <summary>Lý do gán hoặc đổi ô kho.</summary>
    public string? Reason { get; set; }

    public Reservation Reservation { get; set; } = null!;
    public StorageUnit Unit { get; set; } = null!;
    public User? AssignedByUser { get; set; }
}
