namespace StorageProject.Core.Entities;

/// <summary>
/// Đại diện cho một cơ sở chi nhánh cho thuê kho SafeSpace (toàn mạng lưới có 12 cơ sở theo D17).
/// </summary>
public class Facility
{
    /// <summary>Mã định danh cơ sở.</summary>
    public long FacilityId { get; set; }

    /// <summary>Tên chi nhánh cơ sở (ví dụ: SafeSpace Nguyễn Lương Bằng).</summary>
    public string Name { get; set; } = null!;

    /// <summary>Địa chỉ thực tế của cơ sở.</summary>
    public string Address { get; set; } = null!;

    /// <summary>Số điện thoại liên hệ của cơ sở.</summary>
    public string? ContactPhone { get; set; }

    /// <summary>Giờ mở cửa đón khách hàng ngày (mặc định 07:00).</summary>
    public TimeOnly? OpeningTime { get; set; }

    /// <summary>Giờ đóng cửa cơ sở hàng ngày (mặc định 22:00).</summary>
    public TimeOnly? ClosingTime { get; set; }

    /// <summary>Tọa độ Vĩ độ (Latitude) ghim bản đồ Leaflet theo D12.</summary>
    public decimal? Latitude { get; set; }

    /// <summary>Tọa độ Kinh độ (Longitude) ghim bản đồ Leaflet theo D12.</summary>
    public decimal? Longitude { get; set; }

    /// <summary>Trạng thái hoạt động: ACTIVE (hoạt động bình thường), INACTIVE, TEMPORARILY_CLOSED (tạm đóng, chặn đặt mới theo D16).</summary>
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, INACTIVE, TEMPORARILY_CLOSED

    /// <summary>Thời điểm tạo cơ sở.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật thông tin cơ sở lần gần nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public ICollection<UserFacility> UserFacilities { get; set; } = [];
    public ICollection<StorageUnit> StorageUnits { get; set; } = [];
    public ICollection<RentalRate> RentalRates { get; set; } = [];
    public ICollection<Policy> Policies { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}
