namespace StorageProject.Core.DTOs.Renewal;

public record CounterRenewalDto(
    string Id,
    long RenewalId,
    long PaymentId,
    string ContractId,
    string ContractCode,
    long FacilityId,
    string Unit,
    string Customer,
    decimal Amount,
    int Months,
    DateTime? PaymentDeadlineAt,
    string Status
);

public record CounterRenewalActionRequest(
    string Action,
    string Id
);
