namespace StorageProject.Core.DTOs.FacilityOps;

// Khu Nhân viên cơ sở (Figma S01–S09) và Quản lý cơ sở (M01–M08) — GET /api/ops/board và các thao tác.
// Hình dạng JSON khớp src/ops/api.js + mẫu trong BACKEND-TODO.md (camelCase, id dạng chuỗi).
// Ngày "yyyy-MM-dd"; ngày giờ là giờ Việt Nam dạng "yyyy-MM-ddTHH:mm:ss" (giao diện hiển thị nguyên giờ).

/// <summary>Người đang gọi API: STAFF hoặc MANAGER (quản lý làm được mọi việc của nhân viên).</summary>
public record OpsActor(long UserId, bool IsManager);

public record OpsFacilityInfoDto(long FacilityId, string Name, string Address);

public record OpsStaffDto(string StaffId, string FullName, string Shift);

public record OpsUnitDto(string Code, string? Tenant, decimal Area, string Floor, string Type, string Status, DateOnly? End);

public record OpsPaymentDto(
    string Id, string Customer, decimal Amount, string Method, string ReportedAt, string Memo, string Offer,
    DateOnly Start, DateOnly End, string Pickup, string Status, string? Note, string? HandledAt);

public record OpsAllocationDto(
    string Id, string Customer, string Type, string Offer, decimal MinArea, decimal MaxArea,
    DateOnly Start, DateOnly End, string Pickup, string Status, string? Unit);

public record OpsVerificationDto(
    string Id, string ReservationId, string Customer, string Unit, string Appointment, string Status,
    string? DocType, string? DocLast4, string? VerifiedAt);

public record OpsHandoverDto(string Id, string VerificationId, string Unit, string Customer, string Status, string? Method, string? DoneAt);

public record OpsReturnReportDto(string Items, string Walls, string Keys, string Proposal);

public record OpsReturnDto(
    string Id, string Contract, string Unit, string Customer, string Appointment, decimal Deposit, decimal Unpaid,
    string Status, OpsReturnReportDto? Report, string? SubmittedAt);

public record OpsNoteDto(string Text, string At, string? Staff);

public record OpsTicketDto(
    string Id, string Unit, string Customer, string Title, string CreatedAt, string Schedule, string Status,
    string? Assignee, IReadOnlyList<OpsNoteDto> Notes);

public record OpsRenewalDto(
    string Id, string Contract, string Customer, string Unit, DateOnly From, DateOnly To, int Months,
    string Requested, string Status, string? Reason, string? DecidedAt);

public record OpsReminderDto(string Text, string At);

public record OpsContractDto(
    string Id, string Customer, string Unit, DateOnly End, string Due, decimal Amount, string State,
    IReadOnlyList<OpsReminderDto> Reminders);

public record OpsAssignmentDto(string Id, string Title, string When, string? Staff, string Status, string Ref);

public record OpsRevenueMonthDto(string Label, int Month, int Year, decimal Value);

public record OpsRevenueTypeDto(string Label, decimal Value);

public record OpsRevenueDto(IReadOnlyList<OpsRevenueMonthDto> Months, IReadOnlyList<OpsRevenueTypeDto> ByType, DateOnly AsOf);

/// <summary>
/// Dữ liệu vận hành của cơ sở được phân công. Nhân viên chỉ nhận phần S01–S09;
/// các phần của quản lý (allocations … revenue) để null và không được trả về.
/// </summary>
public record OpsBoardDto(
    OpsFacilityInfoDto Facility,
    OpsStaffDto? Me,
    IReadOnlyList<OpsStaffDto> Staff,
    IReadOnlyList<OpsUnitDto> Units,
    IReadOnlyList<OpsPaymentDto> Payments,
    IReadOnlyList<OpsVerificationDto> Verifications,
    IReadOnlyList<OpsHandoverDto> Handovers,
    IReadOnlyList<OpsReturnDto> Returns,
    IReadOnlyList<OpsTicketDto> Tickets,
    IReadOnlyList<OpsAllocationDto>? Allocations,
    IReadOnlyList<OpsRenewalDto>? Renewals,
    IReadOnlyList<OpsContractDto>? Contracts,
    IReadOnlyList<OpsAssignmentDto>? Assignments,
    OpsRevenueDto? Revenue);

// ---- Thân request (BACKEND-TODO A2, A3)
public record OpsNoteRequest(string? Note);
public record OpsVerifyRequest(string? DocType, string? DocNumber, bool PhotoMatched, bool InfoMatched);
public record OpsHandoverRequest(string? UnlockMethod);
public record OpsReturnInspectionRequest(string? Items, string? Walls, string? Keys, string? Proposal);
public record OpsTicketResponseRequest(string? Note, string? NextStatus);
public record OpsRejectRequest(string? Reason);
public record OpsAllocateRequest(string? UnitCode);
public record OpsAssignRequest(string? StaffId);
