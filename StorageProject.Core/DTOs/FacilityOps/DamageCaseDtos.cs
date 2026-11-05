using StorageProject.Core.DTOs.Evidence;

namespace StorageProject.Core.DTOs.FacilityOps;

public record DamageFileDto(string FileName, string? ContentType = null, long? Size = null);

public record DamageResponseDto(
    string Choice,
    string? Note,
    string At,
    IReadOnlyList<DamageFileDto>? Files = null,
    IReadOnlyList<EvidencePhotoDto>? Photos = null);

public record DamageDecisionDto(
    string Decision,
    string? Note,
    string At);

public record DamageRemediationDto(
    string? Note,
    string At,
    IReadOnlyList<DamageFileDto>? Files = null,
    IReadOnlyList<EvidencePhotoDto>? Photos = null);

public record DamageInspectionDto(
    string Result,
    string Note,
    string At);

public record DamageHistoryDto(
    string Action,
    string By,
    string At);

public record DamageCaseDto(
    string Id,
    string ContractId,
    long OwnerId,
    long FacilityId,
    string Unit,
    string Item,
    decimal DamageAmount,
    decimal DamageDeduction,
    decimal Deposit,
    decimal OtherDeductions,
    decimal RefundPreview,
    decimal RefundIfRemedied,
    string Status,
    int Version,
    string SettlementStatus,
    string RecordedBy,
    string RecordedAt,
    IReadOnlyList<EvidencePhotoDto> Photos,
    DamageResponseDto? Response = null,
    DamageDecisionDto? Decision = null,
    string? Deadline = null,
    DamageRemediationDto? Remediation = null,
    DamageInspectionDto? Inspection = null,
    IReadOnlyList<DamageHistoryDto>? History = null);

public record DamageCaseListDto(IReadOnlyList<DamageCaseDto> Items);

public record DamageCaseReceiptDto(DamageCaseDto Case);

public record DamageCaseActionRequest(
    string Action,
    string Id,
    int ExpectedVersion,
    string? Choice = null,
    string? Decision = null,
    string? Result = null,
    string? Note = null,
    string? Deadline = null,
    IReadOnlyList<EvidencePhotoUpload>? Photos = null);
