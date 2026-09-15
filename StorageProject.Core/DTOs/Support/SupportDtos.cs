namespace StorageProject.Core.DTOs.Support;

public record CreateTicketRequest(
    long ContractId,
    long? UnitId,
    string IssueType,
    string Title,
    string Description,
    string Priority
);

public record SupportTicketDto(
    long TicketId,
    long ContractId,
    long? UnitId,
    string IssueType,
    string Title,
    string Priority,
    string Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt,
    DateTime? ClosedAt
);

public record SupportTicketDetailDto(
    long TicketId,
    long ContractId,
    string ContractUnitNumber,
    long? UnitId,
    string IssueType,
    string Title,
    string Description,
    string Priority,
    string Status,
    DateTime CreatedAt,
    DateTime? AssignedAt,
    DateTime? ResolvedAt,
    DateTime? ClosedAt
);
