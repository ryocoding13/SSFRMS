namespace StorageProject.Core.DTOs.Operations;

// =====================================================================
// UC19 — Quản lý danh sách cơ sở toàn hệ thống
// =====================================================================

public record OpsFacilityDto(
    long FacilityId,
    string Name,
    string Address,
    string? ContactPhone,
    string? OpeningTime,
    string? ClosingTime,
    string Status,
    int TotalUnits,
    int UnitsInUse,
    int OperableUnits,
    decimal? OccupancyRate,      // null = "Không áp dụng" (không có kho khai thác)
    int PricedUnitTypes,         // số loại kho đang có giá áp dụng hôm nay
    int AssignedStaff,           // số nhân sự (STAFF/MANAGER) đang được phân công
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record UpsertFacilityRequest(
    string Name,
    string Address,
    string? ContactPhone,
    string? OpeningTime,         // "HH:mm"
    string? ClosingTime,         // "HH:mm"
    string? Status               // chỉ dùng khi tạo mới; đổi trạng thái dùng endpoint /status
);

public record ChangeFacilityStatusRequest(string Status, string? Reason);

public record FacilitySaveResult(OpsFacilityDto Facility, IReadOnlyList<string> Warnings);

// =====================================================================
// UC20 / UC21 — Chính sách thuê, khung giá, phí, giảm giá, miễn phí
// =====================================================================

public record PolicyDto(
    long PolicyId,
    string PolicyName,
    string PolicyType,
    string? CalculationType,
    decimal? Value,
    decimal? MinValue,
    decimal? MaxValue,
    string RuleDescription,
    string Scope,                // GLOBAL, FACILITY, UNIT_TYPE, FACILITY_UNIT_TYPE
    long? FacilityId,
    string? FacilityName,
    long? UnitTypeId,
    string? UnitTypeName,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    long CreatedBy,
    string CreatedByName,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record UpsertPolicyRequest(
    string PolicyName,
    string PolicyType,
    string CalculationType,
    decimal? Value,
    decimal? MinValue,
    decimal? MaxValue,
    string RuleDescription,
    long? FacilityId,            // null = toàn hệ thống
    long? UnitTypeId,            // null = mọi loại kho
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo
);

public record PolicyQuery(string? PolicyType, string? Status, long? FacilityId, long? UnitTypeId);

public record ActivatePolicyResult(PolicyDto Policy, IReadOnlyList<PolicyDto> Superseded);

// =====================================================================
// UC21 — Bảng giá thuê theo cơ sở và loại kho
// =====================================================================

public record OpsRateDto(
    long RateId,
    long FacilityId,
    string FacilityName,
    long UnitTypeId,
    string UnitTypeName,
    decimal MonthlyRate,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    bool IsCurrent
);

public record SetRateRequest(long FacilityId, long UnitTypeId, decimal MonthlyRate, DateOnly? EffectiveFrom);

// =====================================================================
// UC22 / UC23 — Báo cáo toàn hệ thống (định nghĩa chỉ tiêu theo SRS mục 10.2)
// =====================================================================

public record ReportFilter(DateOnly From, DateOnly To, long? FacilityId, long? UnitTypeId);

public record ReportMetrics(
    decimal Collected,             // Tiền thu trong kỳ (mọi loại trừ REFUND, kể cả cọc)
    decimal Refunded,              // Tiền hoàn trong kỳ
    decimal NetCollected,          // Thu tiền ròng = thu − hoàn
    decimal RentalAndFeeRevenue,   // Doanh thu thuê và phí theo tiền thu (không gồm cọc)
    decimal DepositCollected,      // Cọc thu trong kỳ
    decimal DepositHeld,           // Cọc còn giữ đến thời điểm báo cáo
    decimal Outstanding,           // Công nợ hiện tại (PENDING/FAILED, amount > 0)
    int TotalUnits,
    int UnitsInUse,                // OCCUPIED + RETURN_PENDING
    int UnitsAvailable,            // AVAILABLE
    int UnitsReserved,             // RESERVED + ASSIGNED
    int UnitsUnavailable,          // MAINTENANCE + OUT_OF_SERVICE + INSPECTION
    int OperableUnits,             // TotalUnits − UnitsUnavailable
    decimal? OccupancyRate,        // UnitsInUse / OperableUnits × 100; null = Không áp dụng
    int ActiveContracts,
    int OverdueCases,              // overdue_cases chưa RESOLVED
    int OverdueContracts           // DISTINCT contract_id của các case trên
);

public record FacilityReportRow(long FacilityId, string FacilityName, string FacilityStatus, ReportMetrics Metrics);

public record UnitTypeReportRow(long UnitTypeId, string UnitTypeName, ReportMetrics Metrics);

public record SystemReportDto(
    ReportFilter Filter,
    DateTime SnapshotAt,
    ReportMetrics Totals,
    IReadOnlyList<FacilityReportRow> Facilities
);

public record UnitTypeReportDto(
    ReportFilter Filter,
    DateTime SnapshotAt,
    ReportMetrics Totals,
    IReadOnlyList<UnitTypeReportRow> UnitTypes
);

public record RevenueMonthRow(
    int Year,
    int Month,
    string Label,
    decimal Collected,
    decimal Refunded,
    decimal RentalAndFeeRevenue,
    decimal DepositCollected
);

public record RevenueTrendDto(long? FacilityId, long? UnitTypeId, DateTime SnapshotAt, IReadOnlyList<RevenueMonthRow> Months);

public record StatusCount(string Status, int Count);

public record RentalStatusDto(
    long? FacilityId,
    long? UnitTypeId,
    DateTime SnapshotAt,
    IReadOnlyList<StatusCount> Contracts,
    IReadOnlyList<StatusCount> Reservations,
    IReadOnlyList<StatusCount> Units
);

public record FacilityContractRow(
    long ContractId,
    string CustomerName,
    string UnitNumber,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    string Status,
    decimal Outstanding,
    int OpenOverdueCases
);

public record CsvExport(string FileName, byte[] Content);
