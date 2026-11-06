namespace StorageProject.Core.Entities;

/// <summary>
/// Chính sách và quy định kinh doanh của hệ thống SafeSpace (B02 / vai trò Vận hành KD).
/// Quản lý các tham số: tỷ lệ cọc (DEPOSIT), phí hủy đơn (CANCELLATION 5%), phí quá hạn (OVERDUE 5%/ngày),
/// ngày đệm cho thuê lại (RELET_BUFFER theo D41)...
/// </summary>
public class Policy
{
    /// <summary>Mã định danh chính sách.</summary>
    public long PolicyId { get; set; }

    /// <summary>Mã cơ sở áp dụng (null = áp dụng trên toàn hệ thống).</summary>
    public long? FacilityId { get; set; }

    /// <summary>Mã loại kho áp dụng (null = áp dụng cho mọi loại kho).</summary>
    public long? UnitTypeId { get; set; }

    /// <summary>Mã tài khoản quản lý vận hành KD tạo chính sách.</summary>
    public long CreatedBy { get; set; }

    /// <summary>Tên hiển thị của chính sách.</summary>
    public string PolicyName { get; set; } = null!;

    /// <summary>
    /// Loại chính sách:
    /// DEPOSIT (tiền cọc), RENEWAL (gia hạn), CANCELLATION (hủy đơn), RETURN (trả kho),
    /// OVERDUE (quá hạn), EXTRA_FEE, DISCOUNT, FEE_WAIVER, PRICE_RANGE, RELET_BUFFER (đệm ngày cho thuê lại).
    /// </summary>
    public string PolicyType { get; set; } = null!;

    /// <summary>Kiểu tính toán: FIXED (số tiền cố định), PERCENTAGE (phần trăm), RANGE (khoảng giá trị), RULE.</summary>
    public string? CalculationType { get; set; } // FIXED, PERCENTAGE, RANGE, RULE

    /// <summary>Giá trị áp dụng (ví dụ 1 tháng cọc, 0.05 phí hủy, 5 ngày đệm...).</summary>
    public decimal? Value { get; set; }

    /// <summary>Giá trị tối thiểu cho phép (nếu kiểu RANGE).</summary>
    public decimal? MinValue { get; set; }

    /// <summary>Giá trị tối đa cho phép (nếu kiểu RANGE).</summary>
    public decimal? MaxValue { get; set; }

    /// <summary>Mô tả chi tiết nội dung quy tắc chính sách.</summary>
    public string RuleDescription { get; set; } = null!;

    /// <summary>Ngày bắt đầu có hiệu lực của chính sách.</summary>
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>Ngày hết hiệu lực của chính sách (null = vô thời hạn cho đến khi có chính sách mới thay thế).</summary>
    public DateOnly? EffectiveTo { get; set; }

    /// <summary>Trạng thái chính sách: DRAFT, ACTIVE (đang áp dụng), INACTIVE, EXPIRED.</summary>
    public string Status { get; set; } = "DRAFT"; // DRAFT, ACTIVE, INACTIVE, EXPIRED

    /// <summary>Thời điểm tạo chính sách.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật chính sách lần gần nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public Facility? Facility { get; set; }
    public UnitType? UnitType { get; set; }
    public User CreatedByUser { get; set; } = null!;
}
