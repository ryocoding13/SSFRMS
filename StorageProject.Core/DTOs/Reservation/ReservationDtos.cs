namespace StorageProject.Core.DTOs.Reservation;

public record CreateReservationRequest(
    long FacilityId,
    long UnitTypeId,
    DateOnly StartDate,
    int RentalPeriodMonths
);

public record ReservationDto(
    long ReservationId,
    long FacilityId,
    string FacilityName,
    long UnitTypeId,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly ExpectedEndDate,
    int RentalPeriodMonths,
    decimal QuotedMonthlyRate,
    decimal EstimatedAmount,
    decimal RequiredDeposit,
    string Status,
    DateTime? ExpiresAt,
    DateTime? CancelledAt,
    string? CancellationReason,
    DateTime CreatedAt,
    string PaymentMethod = "PAYOS",
    decimal? RefundAmount = null,
    string? RefundStatus = null // PENDING (chờ quản lý chuyển khoản) | COMPLETED
);

/// <summary>C14a · Ước tính khi huỷ đơn đã thanh toán trước ngày bắt đầu (D27).</summary>
public record CancelPreviewDto(
    decimal PaidAmount,
    decimal CancellationFee,
    decimal RefundAmount,
    string PolicyName
);

public record ReservationDetailDto(
    long ReservationId,
    long FacilityId,
    string FacilityName,
    long UnitTypeId,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly ExpectedEndDate,
    int RentalPeriodMonths,
    decimal QuotedMonthlyRate,
    decimal EstimatedAmount,
    decimal RequiredDeposit,
    string Status,
    DateTime? ExpiresAt,
    DateTime? CheckInAppointmentAt,
    string? AssignedUnitNumber,
    long? ContractId,
    string? ContractStatus,
    DateTime CreatedAt,
    string PaymentMethod = "PAYOS"
);
