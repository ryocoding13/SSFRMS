using StorageProject.Core.DTOs.Policy;

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
    string? RefundStatus = null, // PENDING (chờ quản lý chuyển khoản) | COMPLETED
    string? ProposedUnitNumber = null // #2: ô hệ thống bố trí khi tạo đơn (activity_logs UNIT_PROPOSED)
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
    string PaymentMethod = "PAYOS",
    int? PolicyVersion = null,
    DateTime? PolicyAcceptedAt = null,
    PolicyConsentDto? PolicyConsent = null,
    string? ProposedUnitNumber = null // #2: ô hệ thống đã bố trí, hiện cho khách trước khi xác nhận
);
