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
    decimal Amount
);

public record ReservationPaymentStatusDto(
    long ReservationId,
    string Status,
    bool IsPaid,
    DateTime? PaidAt
);
