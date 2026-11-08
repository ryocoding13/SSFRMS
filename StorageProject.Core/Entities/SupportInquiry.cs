namespace StorageProject.Core.Entities;

/// <summary>
/// Yêu cầu tư vấn, hỏi đáp hỗ trợ của khách hàng vãng lai chưa có hợp đồng thuê kho (T19 / C12-0).
/// Khách hàng chọn cơ sở và gửi câu hỏi; nhân viên tại đúng cơ sở đó sẽ trả lời tư vấn.
/// </summary>
public sealed class SupportInquiry
{
    /// <summary>Mã định danh yêu cầu tư vấn (ví dụ TV-0001).</summary>
    public long InquiryId { get; set; }

    /// <summary>Mã khách hàng gửi yêu cầu.</summary>
    public long CustomerId { get; set; }

    /// <summary>Mã cơ sở kho mà khách cần tư vấn.</summary>
    public long FacilityId { get; set; }

    /// <summary>Tiêu đề yêu cầu tư vấn.</summary>
    public string Title { get; set; } = "";

    /// <summary>Nội dung chi tiết câu hỏi của khách hàng.</summary>
    public string Description { get; set; } = "";

    /// <summary>Trạng thái yêu cầu: OPEN (mới tạo), WAITING_CUSTOMER (chờ khách phản hồi), CLOSED.</summary>
    public string Status { get; set; } = "OPEN";

    /// <summary>Phiên bản dữ liệu (kiểm soát concurrency khi hai bên cùng phản hồi).</summary>
    public int Version { get; set; } = 1;

    /// <summary>Khóa UUID client request để đảm bảo tính Idempotent khi gửi lại.</summary>
    public Guid ClientRequestId { get; set; }

    /// <summary>Thời điểm gửi yêu cầu tư vấn.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật phản hồi mới nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public User Customer { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public ICollection<SupportInquiryReply> Replies { get; set; } = [];
}

/// <summary>
/// Câu trả lời phản hồi trong luồng trao đổi tư vấn hỗ trợ.
/// </summary>
public sealed class SupportInquiryReply
{
    /// <summary>Mã định danh câu trả lời.</summary>
    public long ReplyId { get; set; }

    /// <summary>Mã yêu cầu tư vấn tương ứng.</summary>
    public long InquiryId { get; set; }

    /// <summary>Mã người dùng phản hồi (Khách hàng hoặc Nhân viên cơ sở).</summary>
    public long AuthorId { get; set; }

    /// <summary>Khóa UUID idempotency của câu trả lời.</summary>
    public Guid ClientRequestId { get; set; }

    /// <summary>Nội dung văn bản trả lời.</summary>
    public string Note { get; set; } = "";

    /// <summary>Người trả lời có yêu cầu đóng luồng tư vấn hay không.</summary>
    public bool CloseRequested { get; set; }

    /// <summary>Thời điểm gửi phản hồi.</summary>
    public DateTime CreatedAt { get; set; }

    public SupportInquiry Inquiry { get; set; } = null!;
    public User Author { get; set; } = null!;
}
