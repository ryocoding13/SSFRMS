namespace StorageProject.Core.DTOs.Renewal;

public record CreateRenewalRequest(
    int RenewalPeriodMonths,
    int? PolicyVersion = null,
    bool? Accepted = null,
    long? TargetUnitId = null // D46: gia hạn sang ô khác (ô trống cùng loại, hoặc về loại đã đặt ban đầu sau nâng cấp D41)
);

// D46 · Ô khách chọn được khi gia hạn sang ô khác. Kind: SWAP (cùng loại) / ORIGINAL_TYPE (về loại đã đặt trước nâng cấp).
public record RenewalUnitOptionDto(
    long UnitId, string UnitNumber, long UnitTypeId, string UnitTypeName, string Kind,
    decimal MonthlyRate, decimal DepositRequired, decimal DepositTopUp);

public record RenewalUnitOptionsDto(
    long ContractId, string CurrentUnit, DateOnly EndDate, DateOnly? BookedFrom, bool Upgraded,
    decimal DepositHeld, IReadOnlyList<RenewalUnitOptionDto> Options);

// D46 · Trạng thái chuyển ô của một yêu cầu gia hạn. Status: REQUESTED, HELD, PAID (chờ chuyển đồ), MOVED (chờ kiểm tra ô cũ), INSPECTED.
public record UnitMoveDto(
    long RenewalId, long ContractId, string CustomerName, string FromUnit, string ToUnit,
    DateOnly OldEndDate, DateOnly MoveFrom, decimal DepositTopUp, string Status,
    DateTime? MovedAt, bool AutoMoved, decimal? Deduction);

public record UnitMoveInspectionRequest(
    bool GoodsRemaining, bool CleaningRequired, decimal? DamageFee, string? Note);

public record RenewalDto(
    long RenewalId,
    long ContractId,
    DateOnly OldEndDate,
    DateOnly NewEndDate,
    int RenewalPeriodMonths,
    decimal OldMonthlyRate,
    decimal NewMonthlyRate,
    decimal RenewalAmount,
    string Status,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    DateTime? PaymentDeadlineAt = null,
    DateTime? AppliedAt = null,
    DateTime? ExpiredAt = null,
    long? PaymentId = null,
    int? PolicyVersion = null,
    DateTime? AcceptedAt = null
);
