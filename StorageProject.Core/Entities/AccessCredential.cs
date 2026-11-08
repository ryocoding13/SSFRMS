namespace StorageProject.Core.Entities;

/// <summary>
/// Phương thức xác thực truy cập mở cửa ô kho (Mã PIN, Mã QR, Thẻ từ, Chìa khóa vật lý).
/// </summary>
public class AccessCredential
{
    /// <summary>Mã định danh phương thức truy cập.</summary>
    public long CredentialId { get; set; }

    /// <summary>Mã hợp đồng thuê được cấp quyền.</summary>
    public long ContractId { get; set; }

    /// <summary>Mã ô kho vật lý được mở.</summary>
    public long UnitId { get; set; }

    /// <summary>Mã người dùng (nhân viên/quản lý) thực hiện cấp phát.</summary>
    public long IssuedBy { get; set; }

    /// <summary>Loại phương thức truy cập: KEY (chìa khóa), LOCK (ổ khóa), ACCESS_CARD (thẻ từ), ACCESS_CODE (mã QR/PIN điện tử).</summary>
    public string CredentialType { get; set; } = null!; // KEY, LOCK, ACCESS_CARD, ACCESS_CODE

    /// <summary>Mã tham chiếu hiển thị công khai (ví dụ: QR-0001, CARD-002...).</summary>
    public string? CredentialReference { get; set; }

    /// <summary>Chuỗi băm bảo mật của mã PIN / mã mở khóa.</summary>
    public string? SecretHash { get; set; }

    /// <summary>Thời điểm cấp phát phương thức truy cập.</summary>
    public DateTime IssuedAt { get; set; }

    /// <summary>Thời điểm thu hồi hoặc khách trả lại phương thức truy cập.</summary>
    public DateTime? ReturnedAt { get; set; }

    /// <summary>Trạng thái hiệu lực: ACTIVE, RETURNED, LOST, REVOKED, REPLACED.</summary>
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, RETURNED, LOST, REVOKED, REPLACED

    public RentalContract Contract { get; set; } = null!;
    public StorageUnit Unit { get; set; } = null!;
    public User IssuedByUser { get; set; } = null!;
}
