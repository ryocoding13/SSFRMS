namespace StorageProject.Core.Entities;

public class ReturnInspection
{
    public long InspectionId { get; set; }
    public long ContractId { get; set; }
    public long StaffId { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? InspectedAt { get; set; }
    public string? ConditionStatus { get; set; } // GOOD, DIRTY, DAMAGED, MAINTENANCE_REQUIRED
    public string? DamageDescription { get; set; }
    public bool CleaningRequired { get; set; } = false;
    public bool MaintenanceRequired { get; set; } = false;
    public decimal DamageFee { get; set; } = 0;
    public decimal CleaningFee { get; set; } = 0;
    public string? Notes { get; set; }
    // D32 / T05: hạng mục hư hỏng và lý do khấu trừ trên biên bản kiểm kê
    public string? DamageItem { get; set; }
    public string? FeeReason { get; set; }
    // D32 / T08: tài khoản chính chủ nhận hoàn cọc, khách khai khi gửi trả kho
    public string? RefundBankName { get; set; }
    public string? RefundAccountNumber { get; set; }
    public string? RefundAccountHolder { get; set; }
    public string Status { get; set; } = "SCHEDULED"; // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User Staff { get; set; } = null!;
}
