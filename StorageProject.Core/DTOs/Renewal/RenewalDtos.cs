namespace StorageProject.Core.DTOs.Renewal;

public record CreateRenewalRequest(
    int RenewalPeriodMonths,
    int? PolicyVersion = null,
    bool? Accepted = null
);

public record RenewalDto(
    long RenewalId,
    long ContractId,
    DateOnly OldEndDate,
    DateOnly NewEndDate,
    int RenewalPeriodMonths,
    decimal OldMonthlyRate,
    decimal NewMonthlyRate,
    decimal RenewalAmount,
    string Status,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    DateTime? PaymentDeadlineAt = null,
    DateTime? AppliedAt = null,
    DateTime? ExpiredAt = null,
    long? PaymentId = null,
    int? PolicyVersion = null,
    DateTime? AcceptedAt = null
);
