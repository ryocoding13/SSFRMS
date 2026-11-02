using StorageProject.Core.DTOs.Payment;

namespace StorageProject.Core.Interfaces;

public interface IPayOSService
{
    Task<CreatePayOSQrResponse> CreatePaymentQrAsync(long customerId, CreatePayOSQrRequest request, CancellationToken ct = default);
    Task PayAtFacilityAsync(long customerId, long reservationId, CancellationToken ct = default);
    Task<bool> ProcessWebhookAsync(string webhookBodyJson, string? signatureHeader, CancellationToken ct = default);
    Task<ReservationPaymentStatusDto?> GetReservationPaymentStatusAsync(long reservationId, CancellationToken ct = default);
    Task<PayosCheckoutDto> CreateRenewalPaymentQrAsync(long customerId, long paymentId, CancellationToken ct = default);
}
