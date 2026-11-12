namespace StorageProject.Core.DTOs.Access;

public record AccessQrDto(
    long ContractId,
    string Code,
    string BackupCode,
    string UnitNumber,
    string? UnitType,
    string? Location,
    string? ValidUntil,
    string? ValidFrom = null,
    // #59: khách xem được mã trước ngày thuê nhưng chỉ mở cửa từ 00:00 ngày bắt đầu (giờ Việt Nam)
    bool UsableNow = true,
    string? UsableFrom = null
);

public record ScanAccessRequest(string? Code, string? UnitNumber = null);

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
