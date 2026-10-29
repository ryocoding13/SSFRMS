using StorageProject.Core.DTOs.Evidence;

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

/// <summary>
/// Biên bản kiểm kê S04 (D32 / T05). Vệ sinh = 10% cọc cố định do server tính; ảnh là URL có chữ ký.
/// DamageItem/FeeReason trả "" khi không có để giao diện đối chiếu đúng giá trị đã gửi.
/// </summary>
public record OpsReturnReportDto(
    string Items, string Walls, string Keys, string Proposal,
    decimal DamageFee = 0, decimal CleaningFee = 0, bool CleaningRequired = false,
    string DamageItem = "", string FeeReason = "", decimal OverdueFee = 0,
    IReadOnlyList<EvidencePhotoDto>? Photos = null);

/// <summary>
/// RequestedAt: lúc khách gửi trả kho (ISO UTC) — mốc dừng phí quá hạn (D32). OverdueFee tính tại mốc đó.
/// DamageWorkflowResolved: không còn phản hồi/khắc phục hư hỏng chờ xử lý (backend chưa có luồng phản hồi hư hỏng
/// Batch06 nên không hồ sơ nào có thể đang mở).
/// </summary>
public record OpsReturnDto(
    string Id, string Contract, string Unit, string Customer, string Appointment, decimal Deposit, decimal Unpaid,
    string Status, OpsReturnReportDto? Report, string? SubmittedAt,
    DateTime? RequestedAt = null, decimal OverdueFee = 0, bool DamageWorkflowResolved = true,
    IReadOnlyList<EvidencePhotoDto>? MoveOutPhotos = null);

/// <summary>M08 · Đơn huỷ chờ hoàn / đã hoàn (D27, D32). Tài khoản là tài khoản chính chủ khách khai khi huỷ.</summary>
public record OpsRefundDto(
    string Id, string Customer, string CancelledAt, decimal Rent, decimal Deposit, decimal Paid, decimal Fee, decimal Amount,
    string Status, string? PaidAt, string? TransactionRef, string? BankName, string? AccountNumber, string? AccountHolder);

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
    OpsRevenueDto? Revenue,
    IReadOnlyList<OpsRefundDto>? Refunds = null);

/// <summary>Kết quả M07: khoản hoàn cọc chờ chuyển (PENDING) hoặc không có khoản hoàn (NO_REFUND); chưa bao giờ PAID ở bước này.</summary>
public record OpsSettlementResult(decimal Refund, string RefundStatus);

// ---- Thân request (BACKEND-TODO A2, A3)
public record OpsNoteRequest(string? Note);

/// <summary>
/// S02. Màn mới gửi checklist 4 mục (OriginalDocumentValid, PhotoMatched, InfoMatched, BookingMatched), không gửi số giấy tờ.
/// Thiếu OriginalDocumentValid → luồng cũ (bắt buộc DocNumber) cho client cũ.
/// </summary>
public record OpsVerifyRequest(string? DocType, string? DocNumber, bool PhotoMatched, bool InfoMatched,
    bool? OriginalDocumentValid = null, bool? BookingMatched = null);

/// <summary>Nhận chìa khóa: nếu client gửi checklist thì cả ba mục phải được đánh dấu.</summary>
public record OpsKeyReceiptRequest(bool? IdentityChecked, bool? ConditionChecked, bool? KeyDelivered);

public record OpsHandoverRequest(string? UnlockMethod);

/// <summary>
/// S04 (D32 / T05): 4 mục kiểm kê + phí hư hỏng, có cần vệ sinh không, hạng mục, lý do và ảnh.
/// Phí vệ sinh không nhận từ client: server tính 10% cọc khi CleaningRequired.
/// </summary>
public record OpsReturnInspectionRequest(string? Items, string? Walls, string? Keys, string? Proposal,
    decimal? DamageFee = null, bool? CleaningRequired = null, string? DamageItem = null, string? FeeReason = null,
    IReadOnlyList<EvidencePhotoUpload>? Photos = null);

/// <summary>M08: quản lý ghi bằng chứng đã chuyển khoản hoàn cho đơn huỷ.</summary>
public record OpsReservationRefundRequest(string? Method, string? TransactionRef, DateTime? TransferredAt, bool Confirmed);

/// <summary>Hoàn cọc sau trả kho (T07). Version: 1 khi chờ hoàn, 2 khi đã hoàn (khoản chỉ đổi trạng thái một lần).</summary>
public record DepositRefundDto(
    string Id, long FacilityId, long OwnerId, string ContractId, string Unit, string Customer, int Version,
    decimal Deposit, decimal Overdue, decimal Cleaning, decimal Damage, decimal Amount, string Status,
    DateTime? RequestedAt, DateTime? InspectedAt, DateTime? ApprovedAt, DateTime? PaidAt, DateOnly? RefundDueDate,
    string? TransactionRef, string? BankName, string? AccountNumber, string? AccountHolder,
    string? InspectionNote, IReadOnlyList<EvidencePhotoDto> Photos);

public record DepositRefundActionRequest(string? Action, string? Id, int? ExpectedVersion, string? TransactionRef,
    DateTime? TransferredAt, bool Confirmed);
public record OpsTicketResponseRequest(string? Note, string? NextStatus);
public record OpsRejectRequest(string? Reason);
public record OpsAllocateRequest(string? UnitCode);
public record OpsAssignRequest(string? StaffId);
