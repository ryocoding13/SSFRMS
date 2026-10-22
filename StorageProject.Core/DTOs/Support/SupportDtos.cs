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

// Code cũ được giữ để đối chiếu.
// public record SupportTicketDetailDto(
//     long TicketId,
//     long ContractId,
//     string ContractUnitNumber,
//     long? UnitId,
//     string IssueType,
//     string Title,
//     string Description,
//     string Priority,
//     string Status,
//     DateTime CreatedAt,
//     DateTime? AssignedAt,
//     DateTime? ResolvedAt,
//     DateTime? ClosedAt
// );
// C12 nhận nội dung, tên nhân viên và thời gian của các phản hồi được phép hiển thị.
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
    DateTime? ClosedAt,
    IReadOnlyList<TicketResponseDto>? Responses = null
);

// Dữ liệu phản hồi công khai của từng yêu cầu hỗ trợ.
public record TicketResponseDto(string Message, string StaffName, DateTime CreatedAt);
