using StorageProject.Core.DTOs.Operations;

namespace StorageProject.Core.Interfaces;

/// <summary>Quản lý vận hành kinh doanh (Business Operations Manager) — UC19, UC20, UC21.</summary>
public interface IOperationsService
{
    // UC19 — Cơ sở
    Task<IReadOnlyList<OpsFacilityDto>> GetFacilitiesAsync(string? status, string? search, CancellationToken ct = default);
    Task<OpsFacilityDto?> GetFacilityAsync(long facilityId, CancellationToken ct = default);
    Task<FacilitySaveResult> CreateFacilityAsync(UpsertFacilityRequest request, long userId, CancellationToken ct = default);
    Task<FacilitySaveResult> UpdateFacilityAsync(long facilityId, UpsertFacilityRequest request, long userId, CancellationToken ct = default);
    Task<FacilitySaveResult> ChangeFacilityStatusAsync(long facilityId, ChangeFacilityStatusRequest request, long userId, CancellationToken ct = default);

    // UC20 / UC21 — Chính sách
    Task<IReadOnlyList<PolicyDto>> GetPoliciesAsync(PolicyQuery query, CancellationToken ct = default);
    Task<PolicyDto?> GetPolicyAsync(long policyId, CancellationToken ct = default);
    Task<PolicyDto> CreatePolicyAsync(UpsertPolicyRequest request, long userId, CancellationToken ct = default);
    Task<PolicyDto> UpdatePolicyAsync(long policyId, UpsertPolicyRequest request, long userId, CancellationToken ct = default);
    Task<ActivatePolicyResult> ActivatePolicyAsync(long policyId, bool replaceExisting, long userId, CancellationToken ct = default);
    Task<PolicyDto> DeactivatePolicyAsync(long policyId, long userId, CancellationToken ct = default);
    Task DeleteDraftPolicyAsync(long policyId, long userId, CancellationToken ct = default);

    // UC21 — Bảng giá
    Task<IReadOnlyList<OpsRateDto>> GetRatesAsync(long? facilityId, long? unitTypeId, bool includeHistory, CancellationToken ct = default);
    Task<OpsRateDto> SetRateAsync(SetRateRequest request, long userId, CancellationToken ct = default);
}

/// <summary>Báo cáo toàn hệ thống — UC22, UC23. Định nghĩa chỉ tiêu theo SRS mục 10.2.</summary>
public interface IOperationsReportService
{
    Task<SystemReportDto> GetSystemReportAsync(ReportFilter filter, CancellationToken ct = default);
    Task<UnitTypeReportDto> GetUnitTypeReportAsync(ReportFilter filter, CancellationToken ct = default);
    Task<RevenueTrendDto> GetRevenueTrendAsync(int months, long? facilityId, long? unitTypeId, CancellationToken ct = default);
    Task<RentalStatusDto> GetRentalStatusAsync(long? facilityId, long? unitTypeId, CancellationToken ct = default);
    Task<IReadOnlyList<FacilityContractRow>> GetFacilityContractsAsync(long facilityId, string? status, long? unitTypeId, CancellationToken ct = default);
    Task<CsvExport> ExportCsvAsync(string view, ReportFilter filter, int months, long userId, CancellationToken ct = default);
}
