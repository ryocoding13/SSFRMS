using StorageProject.Core.DTOs.Support;

namespace StorageProject.Core.Interfaces;

/// <summary>
/// Dịch vụ hỏi đáp, tư vấn khách hàng vãng lai chưa có hợp đồng thuê kho (T19 / C12-0).
/// </summary>
public interface ISupportInquiryService
{
    /// <summary>Lấy danh sách các yêu cầu tư vấn của khách hoặc thuộc cơ sở nhân viên phụ trách.</summary>
    Task<IReadOnlyList<InquiryDto>> ListAsync(long userId, CancellationToken ct = default);

    /// <summary>Xem chi tiết nội dung cuộc hội thoại tư vấn.</summary>
    Task<InquiryDto> GetAsync(long userId, string id, CancellationToken ct = default);

    /// <summary>Thực hiện thao tác: gửi câu hỏi mới hoặc phản hồi câu trả lời.</summary>
    Task<InquiryDto> ActAsync(long userId, InquiryActionRequest request, CancellationToken ct = default);
}
