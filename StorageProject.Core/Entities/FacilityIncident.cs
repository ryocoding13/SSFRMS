namespace StorageProject.Core.Entities;

/// <summary>
/// T13 · Sự cố do cơ sở làm khách không sử dụng được ô (D32). Quản lý ghi nhận và đề xuất phương án;
/// khách tự chọn đổi sang ô tương đương (không phụ phí, giữ kỳ thuê/giá/cọc) hoặc kết thúc hợp đồng
/// (hoàn 100% tháng đang thuê + 100% tháng chưa dùng + 100% cọc, không phạt dừng sớm).
/// </summary>
public class FacilityIncident
{
    /// <summary>Mã định danh sự cố cơ sở.</summary>
    public long IncidentId { get; set; }

    /// <summary>Mã hồ sơ ổn định từ lúc còn là nháp: "SC-{ContractId:0000}-{n}".</summary>
    public string CaseCode { get; set; } = null!;

    /// <summary>Mã hợp đồng thuê bị ảnh hưởng bởi sự cố.</summary>
    public long ContractId { get; set; }

    /// <summary>Mã cơ sở xảy ra sự cố.</summary>
    public long FacilityId { get; set; }

    /// <summary>Mã ô kho cũ bị sự cố không thể tiếp tục sử dụng.</summary>
    public long OldUnitId { get; set; }

    /// <summary>Mã ô kho mới được đề xuất đổi cho khách.</summary>
    public long? TargetUnitId { get; set; }

    /// <summary>
    /// Trạng thái hồ sơ sự cố:
    /// DRAFT, PROPOSED, TRANSFER_PENDING, TRANSFERRED, TERMINATION_PENDING, TERMINATED.
    /// </summary>
    public string Status { get; set; } = "DRAFT";

    /// <summary>Phiên bản dữ liệu (hỗ trợ kiểm soát optimistic concurrency).</summary>
    public int Version { get; set; } = 1;

    /// <summary>Mô tả chi tiết nguyên nhân và mức độ sự cố.</summary>
    public string? Description { get; set; }

    /// <summary>Thời điểm bắt đầu xảy ra sự cố.</summary>
    public DateTime? AffectedAt { get; set; }

    /// <summary>Quản lý đã xác nhận chính thức sự cố hay chưa.</summary>
    public bool Confirmed { get; set; }

    /// <summary>Đề xuất ban đầu của Quản lý: TRANSFER (đổi ô) hoặc TERMINATE (kết thúc).</summary>
    public string? Proposal { get; set; } // TRANSFER, TERMINATE

    /// <summary>Lựa chọn chính thức của khách hàng: TRANSFER (đổi ô) hoặc TERMINATE (kết thúc hoàn tiền).</summary>
    public string? ChoiceOption { get; set; } // TRANSFER, TERMINATE — khách tự chọn

    /// <summary>Ghi chú phản hồi của khách hàng.</summary>
    public string? ChoiceNote { get; set; }

    /// <summary>Thời điểm khách hàng gửi lựa chọn xử lý.</summary>
    public DateTime? ChoiceAt { get; set; }

    /// <summary>Tên ngân hàng nhận hoàn tiền khi kết thúc hợp đồng.</summary>
    public string? RefundBankName { get; set; }

    /// <summary>Số tài khoản ngân hàng nhận hoàn tiền khi kết thúc hợp đồng.</summary>
    public string? RefundAccountNumber { get; set; }

    /// <summary>Tên chủ tài khoản nhận hoàn tiền.</summary>
    public string? RefundAccountHolder { get; set; }

    /// <summary>Thời điểm khách hoàn tất việc dọn đồ sang ô kho mới.</summary>
    public DateTime? MovedAt { get; set; }

    /// <summary>Mã giao dịch hoàn tiền tương ứng trong bảng Payment (nếu chọn kết thúc).</summary>
    public long? RefundPaymentId { get; set; }

    /// <summary>Tiền thuê tháng hiện tại được hoàn 100% (chốt khi kết thúc theo D34).</summary>
    public decimal? CurrentMonthRent { get; set; }

    /// <summary>Tiền thuê các tháng chưa dùng được hoàn 100% (chốt khi kết thúc theo D34).</summary>
    public decimal? UnusedRent { get; set; }

    /// <summary>Mã người dùng (Quản lý) khởi tạo hồ sơ sự cố.</summary>
    public long CreatedBy { get; set; }

    /// <summary>Thời điểm tạo hồ sơ sự cố.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật hồ sơ sự cố lần gần nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public StorageUnit OldUnit { get; set; } = null!;
    public StorageUnit? TargetUnit { get; set; }
}
