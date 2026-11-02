using StorageProject.Core.DTOs.Evidence;

namespace StorageProject.Core.DTOs.FacilityOps;

// T13 · Sự cố cơ sở — hình dạng JSON khớp incidentApi.js (normalizeIncident / validateIncidentReceipt).
// Mốc thời gian là chuỗi ISO UTC có mili giây ("2026-10-28T03:00:00.000Z") để so trùng giá trị giao diện gửi lên.

public record IncidentUnitDto(string Id, string Code, long FacilityId, string Type, int SizeM2, string Status, int Version, string? ReservedFor);

public record IncidentChoiceDto(string Choice, string Note, string At);

public record IncidentBankDto(string BankName, string AccountNumber, string AccountHolder);

public record IncidentAccessDto(string OldUnit, string NewUnit);

public record IncidentRefundDto(string Id, decimal Amount, string Status, string? TransactionRef, string? PaidAt);

public record IncidentFileDto(string FileName, string ContentType, int Size);

public record IncidentCaseDto(
    string Id, string ContractId, long OwnerId, long FacilityId, int Version, string Status, string ContractStatus,
    string OldUnitId, string OldUnit, string CurrentUnit, string UnitType, int SizeM2, string Customer,
    string StartDate, string EndDate, decimal MonthlyRate, decimal Deposit, decimal CurrentMonthRent, decimal UnusedRent,
    string? Description, string? AffectedAt, bool Confirmed, string? Proposal,
    IReadOnlyList<EvidencePhotoDto> Photos, IReadOnlyList<IncidentFileDto> Files,
    IReadOnlyList<IncidentUnitDto> Candidates, IncidentUnitDto? TargetUnit,
    IncidentChoiceDto? Choice, IncidentBankDto? RefundBank, string? MovedAt,
    string OldUnitStatus, IncidentAccessDto Access, decimal Surcharge, IncidentRefundDto? Refund);

public record IncidentListDto(IReadOnlyList<IncidentCaseDto> Items);

public record IncidentReceiptDto(IncidentCaseDto Incident);

/// <summary>
/// Một thân request cho mọi thao tác T13. Server không nhận tiền/owner/cơ sở/giá từ client.
/// AffectedAt, MovedAt: chuỗi ISO có múi giờ (giao diện gửi toISOString).
/// </summary>
public record IncidentActionRequest(
    string? Action, string? Id, int? ExpectedVersion,
    string? Description = null, string? AffectedAt = null, bool? Confirmed = null, string? Proposal = null,
    string? TargetUnitId = null, int? ExpectedTargetVersion = null, IReadOnlyList<EvidencePhotoUpload>? Photos = null,
    string? Choice = null, string? Note = null, RefundBankInput? RefundBank = null, string? MovedAt = null);
