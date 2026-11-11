using StorageProject.Core.DTOs.Ops;

namespace StorageProject.Core.Interfaces;

/// <summary>
/// Dịch vụ nghiệp vụ dành cho vai trò Nhân viên cơ sở (Facility Staff — UC07–UC12).
/// </summary>
public interface IStaffService
{
    /// <summary>Lấy bảng danh sách công việc hàng ngày của nhân viên tại cơ sở.</summary>
    Task<OpsBoardDto> GetStaffBoardAsync(long userId, CancellationToken ct = default);

    /// <summary>Xác nhận thanh toán tiền mặt tại quầy (S09 / UC07).</summary>
    Task ConfirmPaymentAsync(long userId, string id, CancellationToken ct = default);

    /// <summary>Xác minh giấy tờ và điều kiện nhận kho của khách hàng (S02 / UC07).</summary>
    Task VerifyCustomerAsync(long userId, string id, VerifyCustomerRequest request, CancellationToken ct = default);

    /// <summary>Hoàn tất bàn giao kho và cấp mã / thẻ từ cho khách (S02 / UC08).</summary>
    Task CompleteHandoverAsync(long userId, string id, CompleteHandoverRequest request, CancellationToken ct = default);

    /// <summary>Nộp biên bản kiểm tra tình trạng kho khi khách trả (S03 / UC10 / D38).</summary>
    Task SubmitReturnInspectionAsync(long userId, string id, ReturnInspectionRequest request, CancellationToken ct = default);

    /// <summary>Trả lời phản hồi yêu cầu hỗ trợ của khách hàng (S04 / UC11 / C12).</summary>
    Task AddTicketResponseAsync(long userId, string id, TicketResponseRequest request, CancellationToken ct = default);

    /// <summary>Cập nhật trạng thái vật lý của ô kho (S07 / UC09 / SRS 8.1).</summary>
    Task UpdateUnitStatusAsync(long userId, string id, UpdateUnitStatusRequest request, CancellationToken ct = default);

    /// <summary>Cấp lại mã mở cửa hoặc chìa khóa khi khách báo mất (UC12).</summary>
    Task ReissueCredentialAsync(long userId, ReissueCredentialRequest request, CancellationToken ct = default);
}
