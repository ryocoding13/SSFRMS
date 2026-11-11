namespace StorageProject.Core.Entities;

/// <summary>
/// Biên bản kiểm tra tình trạng ô kho khi khách hàng làm thủ tục trả kho (S03 / M02 / D39).
/// Ghi nhận hiện trạng vệ sinh, hư hại tài sản, đề xuất chi phí cấn trừ và thông tin tài khoản hoàn cọc.
/// </summary>
public class ReturnInspection
{
    /// <summary>Mã định danh biên bản kiểm tra trả kho.</summary>
    public long InspectionId { get; set; }

    /// <summary>Mã hợp đồng thuê liên quan.</summary>
    public long ContractId { get; set; }

    /// <summary>Mã nhân viên cơ sở thực hiện kiểm tra.</summary>
    public long StaffId { get; set; }

    /// <summary>Lịch hẹn kiểm tra kho.</summary>
    public DateTime? ScheduledAt { get; set; }

    /// <summary>Thời điểm nhân viên hoàn tất kiểm tra và lập biên bản.</summary>
    public DateTime? InspectedAt { get; set; }

    /// <summary>Đánh giá tổng quát: GOOD (đạt), DIRTY (bẩn), DAMAGED (hư hại), MAINTENANCE_REQUIRED (cần bảo trì).</summary>
    public string? ConditionStatus { get; set; } // GOOD, DIRTY, DAMAGED, MAINTENANCE_REQUIRED

    /// <summary>Mô tả chi tiết các hư hỏng được phát hiện.</summary>
    public string? DamageDescription { get; set; }

    /// <summary>Kho có cần nhân viên dọn vệ sinh không (phí cố định 10% cọc theo D32).</summary>
    public bool CleaningRequired { get; set; } = false;

    /// <summary>Ô kho có cần chuyển sang bảo trì kỹ thuật không.</summary>
    public bool MaintenanceRequired { get; set; } = false;

    /// <summary>Số tiền phạt/bồi thường hư hại vật chất (nếu có).</summary>
    public decimal DamageFee { get; set; } = 0;

    /// <summary>Phí vệ sinh kho (mặc định 10% tiền cọc ban đầu).</summary>
    public decimal CleaningFee { get; set; } = 0;

    /// <summary>Ghi chú thêm của nhân viên kiểm tra.</summary>
    public string? Notes { get; set; }

    /// <summary>Hạng mục bị hư hỏng (ví dụ: Bản lề, Khóa, Tường kho theo D32 / T05).</summary>
    public string? DamageItem { get; set; }

    /// <summary>Lý do khấu trừ tiền cọc tương ứng.</summary>
    public string? FeeReason { get; set; }

    /// <summary>Tên ngân hàng chính chủ nhận hoàn cọc do khách khai báo khi gửi yêu cầu trả kho (D32 / T08).</summary>
    public string? RefundBankName { get; set; }

    /// <summary>Số tài khoản ngân hàng chính chủ nhận hoàn cọc (D32 / T08).</summary>
    public string? RefundAccountNumber { get; set; }

    /// <summary>Tên chủ tài khoản nhận hoàn cọc (phải khớp tên khách hàng).</summary>
    public string? RefundAccountHolder { get; set; }

    /// <summary>Trạng thái biên bản: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED.</summary>
    public string Status { get; set; } = "SCHEDULED"; // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

    /// <summary>Thời điểm tạo biên bản.</summary>
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User Staff { get; set; } = null!;
}
