using StorageProject.Core.DTOs.Evidence;

namespace StorageProject.Core.DTOs.FacilityOps;

/// <summary>
/// Biên bản xử lý đồ quá hạn sau mốc ngày 20 (D32 / T12).
/// Gồm nhân viên thực hiện, kiểm kê tài sản, vị trí đưa ra ngoài và ảnh đối chứng trước/sau.
/// </summary>
public record OverdueRemovalRecordDto(
    string Staff,
    string Inventory,
    string Location,
    string PerformedAt,
    string SavedAt,
    string? UnitStatus = null,
    IReadOnlyList<EvidencePhotoDto>? BeforePhotos = null,
    IReadOnlyList<EvidencePhotoDto>? AfterPhotos = null
);

/// <summary>
/// DTO hồ sơ quá hạn trả cho nhân viên và quản lý cơ sở (GET /api/ops/overdue-cases).
/// </summary>
public record OverdueCaseDto(
    string Id,
    long FacilityId,
    string ContractId,
    string Unit,
    string Customer,
    decimal Deposit,
    string EndDate,
    string Status,
    string? Assignee,
    long? AssigneeId,
    int RemovalDay,
    IReadOnlyList<string> Notes,
    OverdueRemovalRecordDto? Record = null
);

/// <summary>
/// Yêu cầu thao tác trên hồ sơ quá hạn (POST /api/ops/overdue-cases/actions).
/// Hỗ trợ ASSIGN_REMOVAL (quản lý phân công) và RECORD_REMOVAL (nhân viên/quản lý lưu biên bản).
/// </summary>
public record OverdueCaseActionRequest(
    string? Action,
    string? Id,
    string? Assignee = null,
    long? AssigneeId = null,
    string? PerformedAt = null,
    string? Inventory = null,
    string? Location = null,
    string? UnitStatus = null,
    bool? Confirmed = null,
    IReadOnlyList<EvidencePhotoUpload>? BeforePhotos = null,
    IReadOnlyList<EvidencePhotoUpload>? AfterPhotos = null
);
