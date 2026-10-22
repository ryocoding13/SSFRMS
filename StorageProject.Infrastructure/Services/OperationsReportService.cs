using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Báo cáo toàn hệ thống cho Quản lý vận hành KD (UC22, UC23).
/// Chỉ tiêu theo SRS mục 10.2; tiền truy qua payment → contract → unit → facility / unit_type.
/// Kỳ báo cáo tính theo ngày giờ Việt Nam (UTC+7); trạng thái kho là ảnh chụp tại SnapshotAt, không phải số liệu lịch sử.
/// </summary>
/// <remarks>
/// Giả định của bản cơ bản: bảng payments chưa có original_payment_id, và quy trình hoàn tiền hiện có là hoàn cọc
/// sau trả kho. Vì vậy mọi khoản REFUND được trừ vào "Cọc còn giữ"; "Doanh thu thuê và phí" không trừ REFUND.
/// </remarks>
public class OperationsReportService(AppDbContext dbContext) : IOperationsReportService
{
    private static readonly CultureInfo Vi = CultureInfo.InvariantCulture; // chỉ dùng định dạng số/ngày cố định, không phụ thuộc ngôn ngữ máy chủ

    // ---------------------------------------------------------------------
    // Dữ liệu nguồn (đọc một lần, tổng hợp trong bộ nhớ — dữ liệu dự án nhỏ)
    // ---------------------------------------------------------------------

    private sealed record PayRow(string Type, decimal Amount, string Status, DateTime? PaidAt, long FacilityId, long UnitTypeId, string ContractStatus);
    private sealed record UnitRow(long FacilityId, long UnitTypeId, string Status);
    private sealed record ContractRow(long ContractId, long FacilityId, long UnitTypeId, string Status);
    private sealed record OverdueRow(long ContractId, long FacilityId, long UnitTypeId);

    private sealed record Source(List<PayRow> Payments, List<UnitRow> Units, List<ContractRow> Contracts, List<OverdueRow> Overdues)
    {
        public Source Where(Func<long, long, bool> keep) => new(
            Payments.Where(p => keep(p.FacilityId, p.UnitTypeId)).ToList(),
            Units.Where(u => keep(u.FacilityId, u.UnitTypeId)).ToList(),
            Contracts.Where(c => keep(c.FacilityId, c.UnitTypeId)).ToList(),
            Overdues.Where(o => keep(o.FacilityId, o.UnitTypeId)).ToList());
    }

    private async Task<Source> LoadAsync(long? facilityId, long? unitTypeId, CancellationToken ct)
    {
        var payments = dbContext.Payments.AsNoTracking().AsQueryable();
        var units = dbContext.StorageUnits.AsNoTracking().AsQueryable();
        var contracts = dbContext.RentalContracts.AsNoTracking().AsQueryable();
        var overdues = dbContext.OverdueCases.AsNoTracking().Where(o => o.Status != "RESOLVED");

        if (facilityId.HasValue)
        {
            payments = payments.Where(p => (p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId) == facilityId);
            units = units.Where(u => u.FacilityId == facilityId);
            contracts = contracts.Where(c => c.Unit.FacilityId == facilityId);
            overdues = overdues.Where(o => o.Contract.Unit.FacilityId == facilityId);
        }
        if (unitTypeId.HasValue)
        {
            payments = payments.Where(p => (p.ContractId != null ? p.Contract.Unit.UnitTypeId : p.Reservation.UnitTypeId) == unitTypeId);
            units = units.Where(u => u.UnitTypeId == unitTypeId);
            contracts = contracts.Where(c => c.Unit.UnitTypeId == unitTypeId);
            overdues = overdues.Where(o => o.Contract.Unit.UnitTypeId == unitTypeId);
        }

        return new Source(
            await payments.Select(p => new PayRow(p.PaymentType, p.Amount, p.Status, p.PaidAt,
                p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId,
                p.ContractId != null ? p.Contract.Unit.UnitTypeId : p.Reservation.UnitTypeId,
                p.ContractId != null ? p.Contract.Status : p.Reservation.Status)).ToListAsync(ct),
            await units.Select(u => new UnitRow(u.FacilityId, u.UnitTypeId, u.Status)).ToListAsync(ct),
            await contracts.Select(c => new ContractRow(c.ContractId, c.Unit.FacilityId, c.Unit.UnitTypeId, c.Status)).ToListAsync(ct),
            await overdues.Select(o => new OverdueRow(o.ContractId, o.Contract.Unit.FacilityId, o.Contract.Unit.UnitTypeId)).ToListAsync(ct));
    }

    // ---------------------------------------------------------------------
    // Chỉ tiêu (SRS 10.2)
    // ---------------------------------------------------------------------

    private static ReportMetrics Compute(Source s, DateTime fromUtc, DateTime toUtcExclusive)
    {
        bool InPeriod(DateTime? t) => t.HasValue && t.Value >= fromUtc && t.Value < toUtcExclusive;

        var collectedRows = s.Payments.Where(p => p.Type != "REFUND" && OpsRules.CollectedPaymentStatuses.Contains(p.Status)).ToList();
        var refundRows = s.Payments.Where(p => p.Type == "REFUND" && p.Status == "PAID").ToList();

        var collected = collectedRows.Where(p => InPeriod(p.PaidAt)).Sum(p => p.Amount);
        var refunded = refundRows.Where(p => InPeriod(p.PaidAt)).Sum(p => p.Amount);
        var rentalAndFees = collectedRows.Where(p => p.Type != "DEPOSIT" && InPeriod(p.PaidAt)).Sum(p => p.Amount);
        var depositCollected = collectedRows.Where(p => p.Type == "DEPOSIT" && InPeriod(p.PaidAt)).Sum(p => p.Amount);
        var depositHeld = Math.Max(0, collectedRows.Where(p => p.Type == "DEPOSIT").Sum(p => p.Amount) - refundRows.Sum(p => p.Amount));
        var outstanding = s.Payments
            .Where(p => p.Amount > 0 && OpsRules.UnpaidPaymentStatuses.Contains(p.Status) && p.ContractStatus != "CANCELLED")
            .Sum(p => p.Amount);

        var total = s.Units.Count;
        var inUse = s.Units.Count(u => OpsRules.UnitInUseStatuses.Contains(u.Status));
        var available = s.Units.Count(u => u.Status == "AVAILABLE");
        var reserved = s.Units.Count(u => OpsRules.UnitReservedStatuses.Contains(u.Status));
        var unavailable = s.Units.Count(u => OpsRules.UnitUnavailableStatuses.Contains(u.Status));
        var operable = total - unavailable;

        return new ReportMetrics(
            collected,
            refunded,
            collected - refunded,
            rentalAndFees,
            depositCollected,
            depositHeld,
            outstanding,
            total,
            inUse,
            available,
            reserved,
            unavailable,
            operable,
            OpsRules.OccupancyRate(inUse, operable),
            s.Contracts.Count(c => OpsRules.OpenContractStatuses.Contains(c.Status)),
            s.Overdues.Count,
            s.Overdues.Select(o => o.ContractId).Distinct().Count());
    }

    /// <summary>Tổng hệ thống = tổng các dòng trong cùng bộ lọc (điểm nghiệm thu UC22).</summary>
    private static ReportMetrics Sum(IReadOnlyCollection<ReportMetrics> rows)
    {
        var inUse = rows.Sum(r => r.UnitsInUse);
        var operable = rows.Sum(r => r.OperableUnits);
        return new ReportMetrics(
            rows.Sum(r => r.Collected),
            rows.Sum(r => r.Refunded),
            rows.Sum(r => r.NetCollected),
            rows.Sum(r => r.RentalAndFeeRevenue),
            rows.Sum(r => r.DepositCollected),
            rows.Sum(r => r.DepositHeld),
            rows.Sum(r => r.Outstanding),
            rows.Sum(r => r.TotalUnits),
            inUse,
            rows.Sum(r => r.UnitsAvailable),
            rows.Sum(r => r.UnitsReserved),
            rows.Sum(r => r.UnitsUnavailable),
            operable,
            OpsRules.OccupancyRate(inUse, operable),
            rows.Sum(r => r.ActiveContracts),
            rows.Sum(r => r.OverdueCases),
            rows.Sum(r => r.OverdueContracts));
    }

    private static (DateTime FromUtc, DateTime ToUtcExclusive) Period(ReportFilter filter)
    {
        if (filter.From > filter.To) throw new ArgumentException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        if (filter.To.DayNumber - filter.From.DayNumber > 366 * 3) throw new ArgumentException("Kỳ báo cáo tối đa 3 năm.");
        return (OpsRules.LocalDayStartUtc(filter.From), OpsRules.LocalDayStartUtc(filter.To.AddDays(1)));
    }

    // ---------------------------------------------------------------------
    // UC22 — Báo cáo theo cơ sở / loại kho
    // ---------------------------------------------------------------------

    public async Task<SystemReportDto> GetSystemReportAsync(ReportFilter filter, CancellationToken ct = default)
    {
        var (fromUtc, toUtc) = Period(filter);
        var snapshotAt = DateTime.UtcNow;

        var facilitiesQuery = dbContext.Facilities.AsNoTracking().AsQueryable();
        if (filter.FacilityId.HasValue) facilitiesQuery = facilitiesQuery.Where(f => f.FacilityId == filter.FacilityId);
        var facilities = await facilitiesQuery.OrderBy(f => f.Name)
            .Select(f => new { f.FacilityId, f.Name, f.Status })
            .ToListAsync(ct);
        if (filter.FacilityId.HasValue && facilities.Count == 0) throw new KeyNotFoundException("Không tìm thấy cơ sở.");

        var source = await LoadAsync(filter.FacilityId, filter.UnitTypeId, ct);

        var rows = facilities
            .Select(f => new FacilityReportRow(f.FacilityId, f.Name, f.Status,
                Compute(source.Where((fid, _) => fid == f.FacilityId), fromUtc, toUtc)))
            .ToList();

        return new SystemReportDto(filter, snapshotAt, Sum(rows.Select(r => r.Metrics).ToList()), rows);
    }

    public async Task<UnitTypeReportDto> GetUnitTypeReportAsync(ReportFilter filter, CancellationToken ct = default)
    {
        var (fromUtc, toUtc) = Period(filter);
        var snapshotAt = DateTime.UtcNow;

        var typesQuery = dbContext.UnitTypes.AsNoTracking().AsQueryable();
        if (filter.UnitTypeId.HasValue) typesQuery = typesQuery.Where(t => t.UnitTypeId == filter.UnitTypeId);
        var types = await typesQuery.OrderBy(t => t.Area)
            .Select(t => new { t.UnitTypeId, t.TypeName })
            .ToListAsync(ct);
        if (filter.UnitTypeId.HasValue && types.Count == 0) throw new KeyNotFoundException("Không tìm thấy loại kho.");

        var source = await LoadAsync(filter.FacilityId, filter.UnitTypeId, ct);

        var rows = types
            .Select(t => new UnitTypeReportRow(t.UnitTypeId, t.TypeName,
                Compute(source.Where((_, tid) => tid == t.UnitTypeId), fromUtc, toUtc)))
            .ToList();

        return new UnitTypeReportDto(filter, snapshotAt, Sum(rows.Select(r => r.Metrics).ToList()), rows);
    }

    public async Task<RevenueTrendDto> GetRevenueTrendAsync(int months, long? facilityId, long? unitTypeId, CancellationToken ct = default)
    {
        if (months is < 1 or > 24) throw new ArgumentException("Số tháng phải từ 1 đến 24.");

        var source = await LoadAsync(facilityId, unitTypeId, ct);
        var today = OpsRules.TodayLocal;
        var firstOfThisMonth = new DateOnly(today.Year, today.Month, 1);

        var rows = new List<RevenueMonthRow>();
        for (var i = months - 1; i >= 0; i--)
        {
            var start = firstOfThisMonth.AddMonths(-i);
            var m = Compute(source, OpsRules.LocalDayStartUtc(start), OpsRules.LocalDayStartUtc(start.AddMonths(1)));
            rows.Add(new RevenueMonthRow(start.Year, start.Month, $"Tháng {start.Month}/{start.Year}",
                m.Collected, m.Refunded, m.RentalAndFeeRevenue, m.DepositCollected));
        }

        return new RevenueTrendDto(facilityId, unitTypeId, DateTime.UtcNow, rows);
    }

    public async Task<RentalStatusDto> GetRentalStatusAsync(long? facilityId, long? unitTypeId, CancellationToken ct = default)
    {
        var source = await LoadAsync(facilityId, unitTypeId, ct);

        var reservations = dbContext.Reservations.AsNoTracking().AsQueryable();
        if (facilityId.HasValue) reservations = reservations.Where(r => r.FacilityId == facilityId);
        if (unitTypeId.HasValue) reservations = reservations.Where(r => r.UnitTypeId == unitTypeId);
        var reservationCounts = await reservations
            .GroupBy(r => r.Status)
            .Select(g => new StatusCount(g.Key, g.Count()))
            .ToListAsync(ct);

        return new RentalStatusDto(
            facilityId,
            unitTypeId,
            DateTime.UtcNow,
            source.Contracts.GroupBy(c => c.Status).Select(g => new StatusCount(g.Key, g.Count())).OrderByDescending(s => s.Count).ToList(),
            reservationCounts.OrderByDescending(s => s.Count).ToList(),
            source.Units.GroupBy(u => u.Status).Select(g => new StatusCount(g.Key, g.Count())).OrderByDescending(s => s.Count).ToList());
    }

    /// <summary>Drill-down một cơ sở: hợp đồng và quá hạn liên quan (UC22 bước 5).</summary>
    public async Task<IReadOnlyList<FacilityContractRow>> GetFacilityContractsAsync(long facilityId, string? status, long? unitTypeId, CancellationToken ct = default)
    {
        if (!await dbContext.Facilities.AnyAsync(f => f.FacilityId == facilityId, ct))
        {
            throw new KeyNotFoundException("Không tìm thấy cơ sở.");
        }

        var query = dbContext.RentalContracts.AsNoTracking().Where(c => c.Unit.FacilityId == facilityId);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpperInvariant();
            query = query.Where(c => c.Status == s);
        }
        if (unitTypeId.HasValue) query = query.Where(c => c.Unit.UnitTypeId == unitTypeId);

        return await query
            .OrderByDescending(c => c.Status == "OVERDUE")
            .ThenBy(c => c.EndDate)
            .Take(500)
            .Select(c => new FacilityContractRow(
                c.ContractId,
                c.Customer.FullName,
                c.Unit.UnitNumber,
                c.Unit.UnitType.TypeName,
                c.StartDate,
                c.EndDate,
                c.Status,
                c.Payments.Where(p => p.Amount > 0 && (p.Status == "PENDING" || p.Status == "FAILED")).Sum(p => (decimal?)p.Amount) ?? 0,
                c.OverdueCases.Count(o => o.Status != "RESOLVED")))
            .ToListAsync(ct);
    }

    // ---------------------------------------------------------------------
    // UC23 — Xuất CSV (UTF-8, có tiêu đề, đơn vị, bộ lọc và thời điểm xuất)
    // ---------------------------------------------------------------------

    public async Task<CsvExport> ExportCsvAsync(string view, ReportFilter filter, int months, long userId, CancellationToken ct = default)
    {
        var normalizedView = (view ?? "").Trim().ToLowerInvariant();
        var facilityName = filter.FacilityId.HasValue
            ? await dbContext.Facilities.Where(f => f.FacilityId == filter.FacilityId).Select(f => f.Name).FirstOrDefaultAsync(ct)
              ?? throw new KeyNotFoundException("Không tìm thấy cơ sở.")
            : "Tất cả cơ sở";
        var unitTypeName = filter.UnitTypeId.HasValue
            ? await dbContext.UnitTypes.Where(t => t.UnitTypeId == filter.UnitTypeId).Select(t => t.TypeName).FirstOrDefaultAsync(ct)
              ?? throw new KeyNotFoundException("Không tìm thấy loại kho.")
            : "Tất cả loại kho";

        var csv = new StringBuilder();
        DateTime snapshotAt;
        string title;
        string fileKey;

        switch (normalizedView)
        {
            case "facilities":
            {
                var report = await GetSystemReportAsync(filter, ct);
                snapshotAt = report.SnapshotAt;
                title = "Báo cáo doanh thu và hiệu suất theo cơ sở";
                fileKey = "theo-co-so";
                WriteHeader(csv, title, filter, facilityName, unitTypeName, snapshotAt, withPeriod: true);
                Line(csv, ["Mã cơ sở", "Tên cơ sở", "Trạng thái", .. MetricHeaders]);
                foreach (var r in report.Facilities)
                {
                    Line(csv, [r.FacilityId.ToString(CultureInfo.InvariantCulture), r.FacilityName, r.FacilityStatus, .. MetricCells(r.Metrics)]);
                }
                Line(csv, ["", "Tổng cộng", "", .. MetricCells(report.Totals)]);
                break;
            }
            case "unit-types":
            {
                var report = await GetUnitTypeReportAsync(filter, ct);
                snapshotAt = report.SnapshotAt;
                title = "Báo cáo doanh thu và hiệu suất theo loại kho";
                fileKey = "theo-loai-kho";
                WriteHeader(csv, title, filter, facilityName, unitTypeName, snapshotAt, withPeriod: true);
                Line(csv, ["Mã loại kho", "Loại kho", .. MetricHeaders]);
                foreach (var r in report.UnitTypes)
                {
                    Line(csv, [r.UnitTypeId.ToString(CultureInfo.InvariantCulture), r.UnitTypeName, .. MetricCells(r.Metrics)]);
                }
                Line(csv, ["", "Tổng cộng", .. MetricCells(report.Totals)]);
                break;
            }
            case "revenue-trend":
            {
                var report = await GetRevenueTrendAsync(months, filter.FacilityId, filter.UnitTypeId, ct);
                snapshotAt = report.SnapshotAt;
                title = $"Báo cáo tiền thu {months} tháng gần nhất";
                fileKey = "theo-thang";
                WriteHeader(csv, title, filter, facilityName, unitTypeName, snapshotAt, withPeriod: false);
                Line(csv, ["Tháng", "Tiền thu (VND)", "Tiền hoàn (VND)", "Doanh thu thuê và phí (VND)", "Cọc thu trong kỳ (VND)"]);
                foreach (var r in report.Months)
                {
                    Line(csv, [$"{r.Month:00}/{r.Year}", Num(r.Collected), Num(r.Refunded), Num(r.RentalAndFeeRevenue), Num(r.DepositCollected)]);
                }
                Line(csv, ["Tổng cộng",
                    Num(report.Months.Sum(m => m.Collected)),
                    Num(report.Months.Sum(m => m.Refunded)),
                    Num(report.Months.Sum(m => m.RentalAndFeeRevenue)),
                    Num(report.Months.Sum(m => m.DepositCollected))]);
                break;
            }
            default:
                throw new ArgumentException("Loại báo cáo xuất phải là facilities, unit-types hoặc revenue-trend.");
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var body = Encoding.UTF8.GetBytes(csv.ToString());
        var content = new byte[preamble.Length + body.Length];
        preamble.CopyTo(content, 0);
        body.CopyTo(content, preamble.Length);

        // Audit xuất báo cáo (UC23 bước 6) — chỉ ghi khi tạo tệp thành công
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            Action = "REPORT_EXPORT",
            EntityType = "REPORT",
            NewValue = JsonSerializer.Serialize(new
            {
                View = normalizedView,
                From = filter.From.ToString("yyyy-MM-dd"),
                To = filter.To.ToString("yyyy-MM-dd"),
                filter.FacilityId,
                filter.UnitTypeId,
                Months = normalizedView == "revenue-trend" ? months : (int?)null,
                SnapshotAt = snapshotAt
            }),
            LoggedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync(ct);

        var stamp = (snapshotAt + OpsRules.ReportOffset).ToString("yyyyMMdd-HHmm", CultureInfo.InvariantCulture);
        return new CsvExport($"bao-cao-{fileKey}-{stamp}.csv", content);
    }

    private static readonly string[] MetricHeaders =
    [
        "Tiền thu (VND)", "Tiền hoàn (VND)", "Thu ròng (VND)", "Doanh thu thuê và phí (VND)",
        "Cọc thu trong kỳ (VND)", "Cọc còn giữ (VND)", "Công nợ hiện tại (VND)",
        "Tổng số kho", "Kho đang sử dụng", "Kho trống", "Kho đang giữ/phân bổ", "Kho bảo trì/kiểm tra",
        "Kho khai thác được", "Tỷ lệ sử dụng (%)", "Hợp đồng hiệu lực", "Case quá hạn", "Hợp đồng quá hạn"
    ];

    private static string[] MetricCells(ReportMetrics m) =>
    [
        Num(m.Collected), Num(m.Refunded), Num(m.NetCollected), Num(m.RentalAndFeeRevenue),
        Num(m.DepositCollected), Num(m.DepositHeld), Num(m.Outstanding),
        Int(m.TotalUnits), Int(m.UnitsInUse), Int(m.UnitsAvailable), Int(m.UnitsReserved), Int(m.UnitsUnavailable),
        Int(m.OperableUnits), m.OccupancyRate.HasValue ? Num(m.OccupancyRate.Value) : "Không áp dụng",
        Int(m.ActiveContracts), Int(m.OverdueCases), Int(m.OverdueContracts)
    ];

    private static void WriteHeader(StringBuilder csv, string title, ReportFilter filter, string facilityName,
        string unitTypeName, DateTime snapshotAt, bool withPeriod)
    {
        Line(csv, ["Báo cáo", title]);
        if (withPeriod)
        {
            Line(csv, ["Kỳ tiền thu", $"{filter.From.ToString("dd/MM/yyyy", Vi)} – {filter.To.ToString("dd/MM/yyyy", Vi)} (giờ Việt Nam)"]);
        }
        Line(csv, ["Cơ sở", facilityName]);
        Line(csv, ["Loại kho", unitTypeName]);
        Line(csv, ["Thời điểm chụp dữ liệu", (snapshotAt + OpsRules.ReportOffset).ToString("dd/MM/yyyy HH:mm", Vi) + " (UTC+7)"]);
        Line(csv, ["Ghi chú", "Trạng thái kho là ảnh chụp hiện tại, không phải số liệu lịch sử. Doanh thu thuê và phí không gồm tiền cọc."]);
        csv.Append("\r\n");
    }

    private static void Line(StringBuilder csv, IEnumerable<string> cells)
    {
        csv.Append(string.Join(",", cells.Select(Cell))).Append("\r\n");
    }

    /// <summary>Bọc ô CSV; chặn công thức khi mở bằng Excel (UC23 bước 5).</summary>
    private static string Cell(string? value)
    {
        value ??= "";
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0]) && !decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _))
        {
            value = "'" + value;
        }
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    private static string Num(decimal value) => value.ToString("0.##", CultureInfo.InvariantCulture);

    private static string Int(int value) => value.ToString(CultureInfo.InvariantCulture);
}
