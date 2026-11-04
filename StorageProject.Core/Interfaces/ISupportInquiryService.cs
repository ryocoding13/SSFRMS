using StorageProject.Core.DTOs.Support;
namespace StorageProject.Core.Interfaces;

public interface ISupportInquiryService
{
    Task<IReadOnlyList<InquiryDto>> ListAsync(long userId, CancellationToken ct = default);
    Task<InquiryDto> GetAsync(long userId, string id, CancellationToken ct = default);
    Task<InquiryDto> ActAsync(long userId, InquiryActionRequest request, CancellationToken ct = default);
}
