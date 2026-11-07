using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Hằng số và quy tắc nghiệp vụ dùng chung cho khu Vận hành Kinh doanh (SRS mục 10.2, BR19–BR23).
/// Quản lý trạng thái, tính tỷ lệ lấp đầy, tìm kiếm chính sách áp dụng, tính toán cọc và phân giải mốc quá hạn.
/// </summary>
public static class OpsRules
{
    /// <summary>Danh sách trạng thái cơ sở lưu trữ hợp lệ.</summary>
    public static readonly string[] FacilityStatuses = ["ACTIVE", "INACTIVE", "TEMPORARILY_CLOSED"];

    /// <summary>Danh sách các loại chính sách hệ thống hỗ trợ (SRS BR19–BR23, D41).</summary>
    public static readonly string[] PolicyTypes =
        ["DEPOSIT", "RENEWAL", "CANCELLATION", "RETURN", "OVERDUE", "EXTRA_FEE", "DISCOUNT", "FEE_WAIVER", "PRICE_RANGE", "RELET_BUFFER"];

    /// <summary>Các phương thức tính toán giá trị chính sách (cố định, phần trăm, bậc thang, theo quy tắc, % cọc mỗi ngày).</summary>
    public static readonly string[] CalculationTypes = ["FIXED", "PERCENTAGE", "RANGE", "RULE", "DEPOSIT_PERCENT_PER_DAY"];

    /// <summary>Kho đang sử dụng: còn tài sản của khách (SRS 10.2).</summary>
    public static readonly string[] UnitInUseStatuses = ["OCCUPIED", "RETURN_PENDING"];

    /// <summary>Không tính vào mẫu số tỷ lệ sử dụng (SRS 10.2: bảo trì, ngừng hoạt động, đang kiểm tra).</summary>
    public static readonly string[] UnitUnavailableStatuses = ["MAINTENANCE", "OUT_OF_SERVICE", "INSPECTION"];

    /// <summary>Trạng thái ô kho đã được giữ chỗ hoặc phân bổ cho khách hàng.</summary>
    public static readonly string[] UnitReservedStatuses = ["RESERVED", "ASSIGNED"];

    /// <summary>Các trạng thái hợp đồng đang hoạt động hoặc chưa kết thúc chu kỳ.</summary>
    public static readonly string[] OpenContractStatuses = ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    /// <summary>Các trạng thái đơn đặt chỗ đang mở cần theo dõi.</summary>
    public static readonly string[] OpenReservationStatuses =
        ["PENDING_PAYMENT", "PENDING_AT_FACILITY", "PENDING_VERIFICATION", "CONFIRMED", "UNIT_ASSIGNED"];

    /// <summary>Payment đã từng thu thành công (bản đã hoàn vẫn giữ lịch sử thu ban đầu).</summary>
    public static readonly string[] CollectedPaymentStatuses = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

    /// <summary>Các trạng thái thanh toán chưa hoàn tất.</summary>
    public static readonly string[] UnpaidPaymentStatuses = ["PENDING", "FAILED"];

    /// <summary>Giờ Việt Nam dùng để cắt kỳ báo cáo; dữ liệu trong DB lưu UTC (UTC+7).</summary>
    public static readonly TimeSpan ReportOffset = TimeSpan.FromHours(7);

    /// <summary>Ngày kinh doanh hiện tại theo giờ Việt Nam (UTC+7).</summary>
    public static DateOnly TodayLocal => DateOnly.FromDateTime(DateTime.UtcNow + ReportOffset);

    /// <summary>Ngày hiện tại theo giờ chuẩn UTC.</summary>
    public static DateOnly TodayUtc => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>Chuyển đổi thời điểm bắt đầu ngày địa phương (00:00 UTC+7) sang chuẩn UTC.</summary>
    public static DateTime LocalDayStartUtc(DateOnly day) => day.ToDateTime(TimeOnly.MinValue) - ReportOffset;

    /// <summary>
    /// Tính tỷ lệ lấp đầy kho (%) làm tròn 1 chữ số thập phân (SRS 10.2).
    /// </summary>
    /// <param name="inUse">Số ô kho đang sử dụng.</param>
    /// <param name="operable">Số ô kho khả dụng (tổng trừ các ô bảo trì/ngừng phục vụ).</param>
    /// <returns>Tỷ lệ lấp đầy từ 0 đến 100, hoặc null nếu không có ô khả dụng.</returns>
    public static decimal? OccupancyRate(int inUse, int operable) =>
        operable <= 0 ? null : Math.Round(inUse * 100m / operable, 1, MidpointRounding.AwayFromZero);

    /// <summary>
    /// Kiểm tra xem hai khoảng thời gian có giao nhau (chồng lấn) hay không.
    /// </summary>
    public static bool Overlaps(DateOnly aFrom, DateOnly? aTo, DateOnly bFrom, DateOnly? bTo) =>
        aFrom <= (bTo ?? DateOnly.MaxValue) && bFrom <= (aTo ?? DateOnly.MaxValue);

    // Tham số quá hạn và xử lý đồ theo D32 (BO02)
    /// <summary>Tỷ lệ phạt quá hạn mặc định: 5% cọc ban đầu mỗi ngày (D32).</summary>
    public const decimal DefaultOverdueRatePerDay = 5.0m;
    /// <summary>Mốc bắt đầu chuỗi ngày nhắc nhở khách quá hạn: ngày thứ 10 (D32).</summary>
    public const int DefaultOverdueReminderStartDay = 10;
    /// <summary>Mốc kết thúc chuỗi ngày nhắc nhở: ngày thứ 14 (D32).</summary>
    public const int DefaultOverdueReminderEndDay = 14;
    /// <summary>Mốc xử lý thanh lý đồ quá hạn: ngày thứ 20 (D32).</summary>
    public const int DefaultOverdueDisposalDay = 20;

    /// <summary>
    /// Kiểm tra thứ tự logic các mốc quá hạn và tỷ lệ khấu trừ (D32: 5% / 10-14 ngày nhắc / 20 ngày xử lý đồ).
    /// </summary>
    /// <param name="ratePerDay">Tỷ lệ khấu trừ quá hạn mỗi ngày (% cọc).</param>
    /// <param name="reminderStartDay">Ngày bắt đầu liên hệ nhắc khách.</param>
    /// <param name="reminderEndDay">Ngày kết thúc thời gian nhắc khách.</param>
    /// <param name="disposalDay">Ngày bắt đầu xử lý thanh lý đồ trong kho.</param>
    public static void ValidateOverdueMilestones(decimal ratePerDay, int reminderStartDay, int reminderEndDay, int disposalDay)
    {
        if (ratePerDay <= 0 || ratePerDay > 100)
        {
            throw new ArgumentException("Tỷ lệ khấu trừ quá hạn mỗi ngày phải từ 0% đến 100%.");
        }
        if (reminderStartDay <= 0)
        {
            throw new ArgumentException("Ngày bắt đầu nhắc nhở phải lớn hơn 0.");
        }
        if (reminderStartDay > reminderEndDay)
        {
            throw new ArgumentException("Ngày bắt đầu nhắc nhở không được lớn hơn ngày kết thúc nhắc nhở.");
        }
        if (reminderEndDay >= disposalDay)
        {
            throw new ArgumentException("Ngày kết thúc nhắc nhở phải nhỏ hơn ngày xử lý đồ.");
        }
    }

    /// <summary>
    /// Tìm chính sách đang áp dụng theo thứ tự ưu tiên BR20:
    /// cơ sở + loại kho → cơ sở + mọi loại → toàn hệ thống + loại kho → toàn hệ thống + mọi loại.
    /// </summary>
    /// <param name="dbContext">DbContext truy vấn dữ liệu.</param>
    /// <param name="policyType">Mã loại chính sách (DEPOSIT, OVERDUE, RELET_BUFFER,...).</param>
    /// <param name="facilityId">Mã cơ sở (hoặc null nếu tìm toàn hệ thống).</param>
    /// <param name="unitTypeId">Mã loại kho (hoặc null nếu tìm mọi loại).</param>
    /// <param name="onDate">Ngày hiệu lực cần kiểm tra.</param>
    /// <param name="ct">Token hủy thao tác không đồng bộ.</param>
    /// <returns>Chính sách phù hợp nhất đang ACTIVE, hoặc null nếu không tìm thấy.</returns>
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
    /// PERCENTAGE = % của **1 tháng** tiền thuê (L11, D42: không tính trên tổng tiền thuê cả kỳ); FIXED ≥ 1.000 = số tiền VND;
    /// FIXED &lt; 1.000 = số tháng tiền thuê (cách ghi của chính sách seed ban đầu, Value = 1 nghĩa là 1 tháng).
    /// Không có chính sách áp dụng hoặc RULE → mặc định 1 tháng tiền thuê.
    /// </summary>
    /// <param name="policy">Chính sách cọc được áp dụng.</param>
    /// <param name="monthlyRate">Đơn giá thuê 1 tháng của ô kho.</param>
    /// <param name="estimatedAmount">Tổng tiền thuê ước tính (giữ lại cho tương thích chữ ký cũ, không dùng tính cọc theo D42).</param>
    /// <returns>Số tiền đặt cọc quy đổi (VND).</returns>
    public static decimal CalculateDeposit(Policy? policy, decimal monthlyRate, decimal estimatedAmount)
    {
        if (policy?.Value is not decimal value) return monthlyRate;

        return policy.CalculationType switch
        {
            "PERCENTAGE" => Math.Round(monthlyRate * value / 100m, 0, MidpointRounding.AwayFromZero),
            "FIXED" when value >= 1000m => value,
            "FIXED" => monthlyRate * value,
            _ => monthlyRate
        };
    }

    /// <summary>
    /// Tính token phiên bản cho tập giá của một cặp (FacilityId, UnitTypeId) (BO08).
    /// Giúp phát hiện xung đột dữ liệu (optimistic locking) khi cập nhật bảng giá.
    /// </summary>
    /// <param name="rates">Danh sách các bản ghi giá thuê.</param>
    /// <returns>Chuỗi 16 ký tự hex đại diện cho phiên bản bảng giá.</returns>
    public static string ComputeRateRevisionToken(IEnumerable<(long RateId, decimal MonthlyRate, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string Status)> rates)
    {
        var items = rates
            .Where(r => r.Status == "ACTIVE")
            .OrderBy(r => r.EffectiveFrom)
            .ThenBy(r => r.RateId)
            .Select(r => $"{r.RateId}:{r.MonthlyRate:0.##}:{r.EffectiveFrom:yyyyMMdd}:{r.EffectiveTo:yyyyMMdd}");

        var joined = string.Join(";", items);
        if (string.IsNullOrEmpty(joined)) return "EMPTY";

        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(joined));
        return Convert.ToHexString(hash)[..16];
    }

    /// <summary>
    /// Tính SHA-256 hash của thông tin cơ sở để kiểm tra tính duy nhất và idempotency (BO14).
    /// </summary>
    /// <param name="req">Dữ liệu yêu cầu tạo hoặc sửa cơ sở lưu trữ.</param>
    /// <returns>Chuỗi hex mã băm SHA-256 của payload cơ sở.</returns>
    public static string ComputeFacilityRequestHash(UpsertFacilityRequest req)
    {
        var name = req.Name?.Trim() ?? "";
        var addr = req.Address?.Trim() ?? "";
        var phone = req.ContactPhone?.Trim() ?? "";
        var open = req.OpeningTime?.Trim() ?? "";
        var close = req.ClosingTime?.Trim() ?? "";
        var status = req.Status?.Trim().ToUpperInvariant() ?? "ACTIVE";
        var lat = req.Latitude.HasValue ? Math.Round(req.Latitude.Value, 6).ToString("0.######", CultureInfo.InvariantCulture) : "";
        var lng = req.Longitude.HasValue ? Math.Round(req.Longitude.Value, 6).ToString("0.######", CultureInfo.InvariantCulture) : "";

        var payload = $"{name}|{addr}|{phone}|{open}|{close}|{status}|{lat}|{lng}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(bytes);
    }
}
