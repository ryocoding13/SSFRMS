namespace StorageProject.Core.DTOs.Payment;

public record PaymentDto(
    long PaymentId,
    long ContractId,
    long? RenewalId,
    string PaymentType,
    decimal Amount,
    string Currency,
    string PaymentMethod,
    string? TransactionReference,
    DateOnly? DueDate,
    DateTime? PaidAt,
    string Status,
    DateTime CreatedAt
);
