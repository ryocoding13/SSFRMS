namespace StorageProject.Core.Entities;

/// <summary>
/// Bảng giá thuê ô kho theo từng cơ sở và loại kho (B03 / vai trò Vận hành KD).
/// Chỉ các bảng giá có trạng thái ACTIVE và còn hạn hiệu lực mới được áp dụng tính tiền thuê cho khách theo D16.
/// </summary>
public class RentalRate
{
    /// <summary>Mã định danh mức giá thuê.</summary>
    public long RateId { get; set; }

    /// <summary>Mã cơ sở áp dụng mức giá này.</summary>
    public long FacilityId { get; set; }

    /// <summary>Mã loại kho áp dụng mức giá này.</summary>
    public long UnitTypeId { get; set; }

    /// <summary>Mã tài khoản quản lý vận hành KD thiết lập mức giá.</summary>
    public long SetBy { get; set; }

    /// <summary>Đơn giá thuê hàng tháng (VND/tháng).</summary>
    public decimal MonthlyRate { get; set; }

    /// <summary>Ngày bắt đầu áp dụng mức giá này.</summary>
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>Ngày kết thúc áp dụng (null = vô thời hạn cho đến khi có bảng giá mới thay thế).</summary>
    public DateOnly? EffectiveTo { get; set; }

    /// <summary>Trạng thái bảng giá: DRAFT, ACTIVE (đang áp dụng), EXPIRED, INACTIVE (đã bị thay thế).</summary>
    public string Status { get; set; } = "DRAFT"; // DRAFT, ACTIVE, EXPIRED, INACTIVE

    /// <summary>Thời điểm tạo mức giá.</summary>
    public DateTime CreatedAt { get; set; }

    public Facility Facility { get; set; } = null!;
    public UnitType UnitType { get; set; } = null!;
    public User SetByUser { get; set; } = null!;
}
