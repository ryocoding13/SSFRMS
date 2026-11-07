using StorageProject.Core.DTOs.Evidence;

namespace StorageProject.Core.DTOs.FacilityOps;

// Phiên 3 (05/11/2026) — D39/D40 xác nhận khấu trừ trả kho, D42 hoàn tiền mặt tại quầy và báo cáo cuối ngày.
// Ngày giờ trả về là giờ Việt Nam "yyyy-MM-ddTHH:mm:ss" như các DTO ops khác.

/// <summary>D39: khoản trừ vào cọc nhân viên gửi cho khách sau kiểm tra trả kho.</summary>
public record ReturnDeductionDto(
    string ReturnId, string ContractId, decimal Deposit, decimal CleaningFee, decimal DamageFee,
    string DamageItem, string FeeReason, IReadOnlyList<EvidencePhotoDto> Photos,
    string? SentAt, string? DeadlineAt, bool NeedsConfirmation,
    string Status, string? Decision, string? DecisionNote, string? DecidedAt, string? RecheckNote,
    decimal OverdueFee = 0, int OverdueDays = 0, string? StaffName = null,
    IReadOnlyList<EvidencePhotoDto>? CustomerPhotos = null);

/// <summary>D39: khách chọn AGREE · SELF_CLEAN · SELF_REPLACE · DISPUTE.</summary>
public record ReturnDeductionDecisionRequest(string? Decision, string? Note, IReadOnlyList<EvidencePhotoUpload>? Photos = null);

/// <summary>D39: cơ sở kiểm tra lại phương án khách tự làm / khiếu nại; đạt thì không trừ khoản tương ứng.</summary>
public record ReturnRecheckRequest(bool? CleaningPassed, bool? ReplacementPassed, string? Note);

/// <summary>D42: việc chi tiền hoàn mặt tại quầy cho nhân viên (S10, S10b).</summary>
public record CashRefundDto(
    string Id, string Source, string Reference, string Customer, string? Phone, decimal Amount,
    string Status, string? ApprovedAt, string? DeadlineDate, int DaysSinceApproved,
    int? ReminderDay, string? AppointmentDate, string? LastCall, string? PaidAt, string? PaidBy,
    string? StaffId = null, string? StaffName = null);

public record CashRefundCallRequest(string? Result, DateOnly? AppointmentDate, string? Note);

public record CashRefundPayRequest(bool IdentityChecked, bool CodeChecked, bool AmountCounted, bool Signed);

/// <summary>D42: báo cáo cuối ngày cho quản lý — tên nhân viên và số việc chưa xong; bấm để xem chi tiết.</summary>
public record DailyStaffReportDto(string Date, string GeneratedAt, IReadOnlyList<DailyStaffRowDto> Staff);

public record DailyStaffRowDto(
    string StaffId, string FullName, int Done, int Pending, string? OldestPendingSince,
    IReadOnlyList<DailyTaskDto> PendingTasks, IReadOnlyList<DailyTaskDto> History);

public record DailyTaskDto(string Kind, string Reference, string Label, string At, bool Late = false);

// ---------------------------------------------------------------------------------------------
// Phiên 4 · D41 — xung đột ô do khách cũ chưa trả / chưa kiểm tra đạt trước ngày nhận kho của khách mới
// ---------------------------------------------------------------------------------------------

/// <summary>
/// Đề xuất đổi kho (mốc 5 ngày trước ngày nhận kho). Option: SWAP (đổi ngang cùng loại) · UPGRADE (nâng cấp miễn phí,
/// giữ giá và cọc) · NONE (không còn ô phù hợp → dời ngày hoặc huỷ hoàn 100%). Status: OPEN · RESOLVED.
/// Resolution: SWAP · UPGRADE · AUTO_SWAP · AUTO_UPGRADE (quá 48 giờ) · RESCHEDULE · CANCEL.
/// </summary>
public record UnitConflictDto(
    string Id, string ContractId, string Customer, string? Phone, string StartDate, string EndDate,
    string OldUnit, string? ProposedUnit, string? ProposedUnitType, decimal? ProposedArea, string Option, string Reason,
    string? BlockingContractId, string DetectedAt, string? ExpiresAt, string Status, string? Resolution, string? ResolvedAt,
    string? NewUnit, string? NewStartDate, string? EarliestFreeDate);

/// <summary>Choice: ACCEPT (nhận ô đề xuất) · RESCHEDULE (kèm newStartDate) · CANCEL (kèm refundBank; method "CASH" = tiền mặt).</summary>
public record UnitConflictChoiceRequest(string? Choice, DateOnly? NewStartDate = null,
    StorageProject.Core.DTOs.Evidence.RefundBankInput? RefundBank = null);
