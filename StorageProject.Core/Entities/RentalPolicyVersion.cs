namespace StorageProject.Core.Entities;

/// <summary>
/// Phiên bản điều khoản hợp đồng cho thuê kho công khai (D32 / T20).
/// Lưu trữ nội dung các điều khoản pháp lý, tỷ lệ phí và văn bản hợp đồng mà khách hàng phải đồng ý trước khi thuê/gia hạn.
/// </summary>
public class RentalPolicyVersion
{
    /// <summary>Mã định danh bản ghi phiên bản điều khoản.</summary>
    public long PolicyVersionId { get; set; }

    /// <summary>Số hiệu phiên bản số nguyên (ví dụ: 1, 2, 3...).</summary>
    public int Version { get; set; }

    /// <summary>Chuỗi phiên bản hiển thị cho người dùng (ví dụ: "v2.0-D32").</summary>
    public string DisplayVersion { get; set; } = null!;

    /// <summary>Tỷ lệ giá hoặc hệ số tham chiếu của phiên bản này.</summary>
    public decimal Rate { get; set; }

    /// <summary>Nội dung chi tiết các điều khoản lưu trữ dưới dạng chuỗi JSON.</summary>
    public string SectionsJson { get; set; } = null!;

    /// <summary>Mã người dùng (Quản lý vận hành KD) thực hiện công bố phiên bản này.</summary>
    public long PublishedBy { get; set; }

    /// <summary>Thời điểm công bố phiên bản chính thức.</summary>
    public DateTime PublishedAt { get; set; }

    /// <summary>Có phải là phiên bản hiện hành đang được áp dụng hay không.</summary>
    public bool IsCurrent { get; set; }

    public User PublishedByUser { get; set; } = null!;
    public ICollection<PolicyConsent> Consents { get; set; } = [];
}
