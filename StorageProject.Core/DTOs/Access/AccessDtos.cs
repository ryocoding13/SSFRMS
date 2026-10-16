namespace StorageProject.Core.DTOs.Access;

public record AccessQrDto(
    long ContractId,
    string Code,
    string BackupCode,
    string UnitNumber,
    string? UnitType,
    string? Location,
    string? ValidUntil
);

public record ScanAccessRequest(string? Code);

public record ScanResultDto(
    string Result, // "OPEN" | "DENIED"
    string? UnitNumber,
    string? CustomerName,
    string? ContractCode,
    DateTime ScannedAt,
    string? Reason
);

public record AccessQrOptions(
    string Secret,
    bool DenyOverdue = true
);
