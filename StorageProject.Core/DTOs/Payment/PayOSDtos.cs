namespace StorageProject.Core.DTOs.Payment;

public record CreatePayOSQrRequest(
    long? StorageUnitId,
    long? FacilityId,
    long? UnitTypeId,
    long? ReservationId,
    int? RentalPeriodMonths,
    DateOnly? StartDate,
    decimal? Amount,
    string? CancelUrl,
    string? ReturnUrl
);

public record CreatePayOSQrResponse(
    long ReservationId,
    long OrderCode,
    string CheckoutUrl,
    string QrCode,
    decimal Amount,
    DateTime? ExpiredAt = null
);

public record ReservationPaymentStatusDto(
    long ReservationId,
    string Status,
    bool IsPaid,
    DateTime? PaidAt
);

public record PayosCheckoutDto(
    long OrderCode,
    decimal Amount,
    string Description,
    string Status,
    string QrCode,
    string CheckoutUrl,
    DateTime ExpiredAt,
    long? PaymentId = null,
    long? RenewalId = null
);
