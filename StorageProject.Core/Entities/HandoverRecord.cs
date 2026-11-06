namespace StorageProject.Core.Entities;

/// <summary>
/// Biên bản bàn giao ô kho và cấp phát phương thức truy cập ban đầu cho khách hàng (S02 / UC07 / UC08).
/// </summary>
public class HandoverRecord
{
    /// <summary>Mã định danh biên bản bàn giao.</summary>
    public long HandoverId { get; set; }

    /// <summary>Mã hợp đồng thuê được bàn giao.</summary>
    public long ContractId { get; set; }

    /// <summary>Mã nhân viên cơ sở thực hiện bàn giao.</summary>
    public long StaffId { get; set; }

    /// <summary>Thời điểm lên lịch hẹn bàn giao.</summary>
    public DateTime? ScheduledAt { get; set; }

    /// <summary>Thời điểm nhân viên hoàn tất xác minh điều kiện nhận kho của khách (checklist 4 mục theo S02).</summary>
    public DateTime? VerifiedAt { get; set; }

    /// <summary>Thời điểm bàn giao kho và cấp mã / chìa khóa thực tế.</summary>
    public DateTime? HandoverAt { get; set; }

    /// <summary>Tình trạng ban đầu của ô kho lúc bàn giao (sạch sẽ, nguyên vẹn).</summary>
    public string? InitialCondition { get; set; }

    /// <summary>Ghi chú của nhân viên bàn giao.</summary>
    public string? Notes { get; set; }

    /// <summary>Khách hàng đã ký / xác nhận nhận kho hay chưa.</summary>
    public bool CustomerConfirmed { get; set; } = false;

    /// <summary>Nhân viên đã xác nhận bàn giao hay chưa.</summary>
    public bool StaffConfirmed { get; set; } = false;

    /// <summary>Trạng thái bàn giao: SCHEDULED, VERIFIED, HANDED_OVER, CANCELLED.</summary>
    public string Status { get; set; } = "SCHEDULED"; // SCHEDULED, VERIFIED, HANDED_OVER, CANCELLED

    /// <summary>Thời điểm tạo biên bản bàn giao.</summary>
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User Staff { get; set; } = null!;
}
