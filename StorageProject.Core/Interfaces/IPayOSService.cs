using StorageProject.Core.DTOs.Payment;

namespace StorageProject.Core.Interfaces;

/// <summary>
/// Dịch vụ tích hợp cổng thanh toán trực tuyến VietQR / PayOS (F02, F07, T03).
/// </summary>
public interface IPayOSService
{
    /// <summary>Tạo mã thanh toán VietQR cho đơn đặt chỗ mới.</summary>
    Task<CreatePayOSQrResponse> CreatePaymentQrAsync(long customerId, CreatePayOSQrRequest request, CancellationToken ct = default);

    /// <summary>Ghi nhận khách chọn thanh toán tiền mặt trực tiếp tại quầy cơ sở.</summary>
    Task PayAtFacilityAsync(long customerId, long reservationId, CancellationToken ct = default);

    /// <summary>Xử lý webhook thông báo giao dịch thành công từ máy chủ PayOS gửi về.</summary>
    Task<bool> ProcessWebhookAsync(string webhookBodyJson, string? signatureHeader, CancellationToken ct = default);

    /// <summary>Tra cứu trạng thái thanh toán của đơn đặt chỗ.</summary>
    Task<ReservationPaymentStatusDto?> GetReservationPaymentStatusAsync(long reservationId, CancellationToken ct = default);

    /// <summary>Tạo mã thanh toán VietQR cho khoản thu gia hạn hợp đồng (T03 / D32).</summary>
    Task<PayosCheckoutDto> CreateRenewalPaymentQrAsync(long customerId, long paymentId, CancellationToken ct = default);

    /// <summary>
    /// Đối soát các đơn PayOS đang chờ (đặt chỗ và gia hạn) bằng cách hỏi thẳng PayOS; ghi nhận giống webhook.
    /// Trả về số đơn vừa được ghi nhận thanh toán.
    /// </summary>
    Task<int> ReconcilePendingAsync(CancellationToken ct = default) => Task.FromResult(0);
}
