namespace StorageProject.Core.Entities;

/// <summary>
/// Định nghĩa danh mục loại ô kho trong hệ thống SafeSpace (D17).
/// Gồm 2 kích cỡ: Cỡ M (15 m²) và Cỡ L (30 m²), phân loại kho thường hoặc kho lạnh (kiểm soát nhiệt độ).
/// </summary>
public class UnitType
{
    /// <summary>Mã định danh loại kho.</summary>
    public long UnitTypeId { get; set; }

    /// <summary>Tên loại kho (ví dụ: Kho thường Cỡ M 15m², Kho lạnh Cỡ L 30m²...).</summary>
    public string TypeName { get; set; } = null!;

    /// <summary>Chiều dài ô kho (mét).</summary>
    public decimal? Length { get; set; }

    /// <summary>Chiều rộng ô kho (mét).</summary>
    public decimal? Width { get; set; }

    /// <summary>Chiều cao trần ô kho (mét).</summary>
    public decimal? Height { get; set; }

    /// <summary>Diện tích ô kho tính bằng mét vuông (m²).</summary>
    public decimal Area { get; set; }

    /// <summary>Có kiểm soát nhiệt độ / kho lạnh hay không (true = Kho lạnh, false = Kho thường theo D17).</summary>
    public bool ClimateControlled { get; set; } = false;

    /// <summary>Mô tả tiện ích và đặc điểm của loại kho.</summary>
    public string? Description { get; set; }

    /// <summary>Trạng thái danh mục: ACTIVE, INACTIVE.</summary>
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, INACTIVE

    /// <summary>Thời điểm tạo loại kho.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật thông tin loại kho lần gần nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public ICollection<StorageUnit> StorageUnits { get; set; } = [];
    public ICollection<RentalRate> RentalRates { get; set; } = [];
    public ICollection<Policy> Policies { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}
