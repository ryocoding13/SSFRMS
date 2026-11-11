namespace StorageProject.Core.Entities;

/// <summary>
/// Bảng phân công cơ sở trực thuộc cho nhân viên hoặc quản lý (SRS A06: mỗi nhân viên/quản lý phụ trách một cơ sở).
/// </summary>
public class UserFacility
{
    /// <summary>Mã định danh bản ghi phân công cơ sở.</summary>
    public long UserFacilityId { get; set; }

    /// <summary>Mã tài khoản nhân viên / quản lý được phân công.</summary>
    public long UserId { get; set; }

    /// <summary>Mã cơ sở được giao phụ trách.</summary>
    public long FacilityId { get; set; }

    /// <summary>Mã tài khoản người thực hiện phân công (Admin / Operations).</summary>
    public long? AssignedBy { get; set; }

    /// <summary>Ngày bắt đầu nhận nhiệm vụ tại cơ sở.</summary>
    public DateOnly AssignedFrom { get; set; }

    /// <summary>Ngày kết thúc nhiệm vụ tại cơ sở (null = đang công tác).</summary>
    public DateOnly? AssignedTo { get; set; }

    /// <summary>Trạng thái phân công: ACTIVE (đang công tác), ENDED, SUSPENDED.</summary>
    public string Status { get; set; } = null!; // ACTIVE, ENDED, SUSPENDED

    /// <summary>Thời điểm tạo phân công.</summary>
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public User? Assigner { get; set; }
}
