namespace StorageProject.Core.DTOs.Renewal;

public record CreateRenewalRequest(
    int RenewalPeriodMonths
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
    DateTime? ApprovedAt
);
