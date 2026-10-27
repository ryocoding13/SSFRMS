using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Hằng số và quy tắc dùng chung cho khu Vận hành KD (SRS mục 10.2, BR19–BR23).
/// </summary>
internal static class OpsRules
{
    public static readonly string[] FacilityStatuses = ["ACTIVE", "INACTIVE", "TEMPORARILY_CLOSED"];

    public static readonly string[] PolicyTypes =
        ["DEPOSIT", "RENEWAL", "CANCELLATION", "RETURN", "OVERDUE", "EXTRA_FEE", "DISCOUNT", "FEE_WAIVER", "PRICE_RANGE"];

    public static readonly string[] CalculationTypes = ["FIXED", "PERCENTAGE", "RANGE", "RULE", "DEPOSIT_PERCENT_PER_DAY"];

    // Kho đang sử dụng: còn tài sản của khách (SRS 10.2)
    public static readonly string[] UnitInUseStatuses = ["OCCUPIED", "RETURN_PENDING"];

    // Không tính vào mẫu số tỷ lệ sử dụng (SRS 10.2)
    public static readonly string[] UnitUnavailableStatuses = ["MAINTENANCE", "OUT_OF_SERVICE", "INSPECTION"];

    public static readonly string[] UnitReservedStatuses = ["RESERVED", "ASSIGNED"];

    public static readonly string[] OpenContractStatuses = ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    public static readonly string[] OpenReservationStatuses =
        ["PENDING_PAYMENT", "PENDING_VERIFICATION", "CONFIRMED", "UNIT_ASSIGNED"];

    // Payment đã từng thu thành công (bản đã hoàn vẫn giữ lịch sử thu ban đầu)
    public static readonly string[] CollectedPaymentStatuses = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

    public static readonly string[] UnpaidPaymentStatuses = ["PENDING", "FAILED"];

    /// <summary>Giờ Việt Nam dùng để cắt kỳ báo cáo; dữ liệu trong DB lưu UTC.</summary>
    public static readonly TimeSpan ReportOffset = TimeSpan.FromHours(7);

    public static DateOnly TodayUtc => DateOnly.FromDateTime(DateTime.UtcNow);

    public static DateOnly TodayLocal => DateOnly.FromDateTime(DateTime.UtcNow + ReportOffset);

    public static DateTime LocalDayStartUtc(DateOnly day) => day.ToDateTime(TimeOnly.MinValue) - ReportOffset;

    public static decimal? OccupancyRate(int inUse, int operable) =>
        operable <= 0 ? null : Math.Round(inUse * 100m / operable, 1, MidpointRounding.AwayFromZero);

    public static bool Overlaps(DateOnly aFrom, DateOnly? aTo, DateOnly bFrom, DateOnly? bTo) =>
        aFrom <= (bTo ?? DateOnly.MaxValue) && bFrom <= (aTo ?? DateOnly.MaxValue);

    /// <summary>
    /// Tìm chính sách đang áp dụng theo thứ tự ưu tiên BR20:
    /// cơ sở + loại kho → cơ sở + mọi loại → toàn hệ thống + loại kho → toàn hệ thống + mọi loại.
    /// </summary>
    public static Task<Policy?> FindApplicablePolicyAsync(
        AppDbContext dbContext, string policyType, long? facilityId, long? unitTypeId, DateOnly onDate, CancellationToken ct)
    {
        return dbContext.Policies
            .AsNoTracking()
            .Where(p => p.PolicyType == policyType
                        && p.Status == "ACTIVE"
                        && p.EffectiveFrom <= onDate
                        && (p.EffectiveTo == null || p.EffectiveTo >= onDate)
                        && (p.FacilityId == null || p.FacilityId == facilityId)
                        && (p.UnitTypeId == null || p.UnitTypeId == unitTypeId))
            .OrderByDescending(p => p.FacilityId != null)
            .ThenByDescending(p => p.UnitTypeId != null)
            .ThenByDescending(p => p.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Tiền cọc theo chính sách DEPOSIT (BR21):
    /// PERCENTAGE = % tiền thuê kỳ đầu trước giảm; FIXED ≥ 1.000 = số tiền VND;
    /// FIXED &lt; 1.000 = số tháng tiền thuê (cách ghi của chính sách seed ban đầu, Value = 1 nghĩa là 1 tháng).
    /// Không có chính sách áp dụng hoặc RULE → mặc định 1 tháng tiền thuê.
    /// </summary>
    public static decimal CalculateDeposit(Policy? policy, decimal monthlyRate, decimal estimatedAmount)
    {
        if (policy?.Value is not decimal value) return monthlyRate;

        return policy.CalculationType switch
        {
            "PERCENTAGE" => Math.Round(estimatedAmount * value / 100m, 0, MidpointRounding.AwayFromZero),
            "FIXED" when value >= 1000m => value,
            "FIXED" => monthlyRate * value,
            _ => monthlyRate
        };
    }
}
