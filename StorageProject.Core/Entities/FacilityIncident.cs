namespace StorageProject.Core.Entities;

/// <summary>
/// T13 · Sự cố do cơ sở làm khách không sử dụng được ô (D32). Quản lý ghi nhận và đề xuất phương án;
/// khách tự chọn đổi sang ô tương đương (không phụ phí, giữ kỳ thuê/giá/cọc) hoặc kết thúc hợp đồng
/// (hoàn 100% tháng đang thuê + 100% tháng chưa dùng + 100% cọc, không phạt dừng sớm).
/// </summary>
public class FacilityIncident
{
    public long IncidentId { get; set; }
    /// <summary>Mã hồ sơ ổn định từ lúc còn là nháp: "SC-{ContractId:0000}-{n}".</summary>
    public string CaseCode { get; set; } = null!;
    public long ContractId { get; set; }
    public long FacilityId { get; set; }
    public long OldUnitId { get; set; }
    public long? TargetUnitId { get; set; }
    // DRAFT, PROPOSED, TRANSFER_PENDING, TRANSFERRED, TERMINATION_PENDING, TERMINATED
    public string Status { get; set; } = "DRAFT";
    public int Version { get; set; } = 1;
    public string? Description { get; set; }
    public DateTime? AffectedAt { get; set; }
    public bool Confirmed { get; set; }
    public string? Proposal { get; set; } // TRANSFER, TERMINATE
    public string? ChoiceOption { get; set; } // TRANSFER, TERMINATE — khách tự chọn
    public string? ChoiceNote { get; set; }
    public DateTime? ChoiceAt { get; set; }
    public string? RefundBankName { get; set; }
    public string? RefundAccountNumber { get; set; }
    public string? RefundAccountHolder { get; set; }
    public DateTime? MovedAt { get; set; }
    public long? RefundPaymentId { get; set; }
    public decimal? CurrentMonthRent { get; set; } // chốt khi kết thúc
    public decimal? UnusedRent { get; set; }       // chốt khi kết thúc
    public long CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public StorageUnit OldUnit { get; set; } = null!;
    public StorageUnit? TargetUnit { get; set; }
}
