using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Renewal;

namespace StorageProject.Core.DTOs.Contract;

public record ContractSummaryDto(
    long ContractId,
    long ReservationId,
    long UnitId,
    string UnitNumber,
    string FacilityName,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal AgreedMonthlyRate,
    decimal DepositAmount,
    string Status,
    DateTime? ActivatedAt
);

public record ContractDetailDto(
    long ContractId,
    long ReservationId,
    long UnitId,
    string UnitNumber,
    string FacilityName,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal AgreedMonthlyRate,
    decimal DepositAmount,
    string Status,
    string? TerminationReason,
    DateTime CreatedAt,
    DateTime? ActivatedAt,
    DateTime? CompletedAt,
    HandoverSummaryDto? Handover,
    IReadOnlyList<PaymentDto> Payments,
    IReadOnlyList<RenewalDto> Renewals
);

public record HandoverSummaryDto(
    long HandoverId,
    string Status,
    DateTime? ScheduledAt,
    DateTime? HandoverAt,
    bool CustomerConfirmed,
    bool StaffConfirmed
);
