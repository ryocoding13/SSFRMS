using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Demo;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Lượt 6 · #45 #54 · Công cụ demo của admin (Figma A-DEMO-NGÀY).
/// Chỉnh ngày bắt đầu / hết hạn, giá thuê tháng của hợp đồng và ngày / số tiền của giao dịch đã phát sinh để
/// demo các trạng thái chưa tới ngày thuê, đang thuê, sắp hết hạn, quá hạn. Trạng thái hợp đồng, trạng thái ô và
/// ngày của đơn đặt chỗ đi kèm được đồng bộ; số ngày quá hạn tính lại theo ngày hết hạn mới.
/// Mỗi lần chỉnh ghi activity_logs với giá trị trước/sau và admin thực hiện (D48: không thêm cột).
/// </summary>
public class DemoToolsService(AppDbContext dbContext) : IDemoToolsService
{
    public const string ContractEdited = "DEMO_CONTRACT_EDITED";
    public const string PaymentEdited = "DEMO_PAYMENT_EDITED";
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);
    private static readonly string[] Running = ["ACTIVE", "EXPIRING", "OVERDUE"];
    private const int ExpiringDays = 14;
    private const decimal MaxAmount = 10_000_000_000m;

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow + VnOffset);
    private static string Code(RentalContract c) => $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";
    private static string? Local(DateTime? utc) => utc is DateTime d ? (d + VnOffset).ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture) : null;
    private static string Money(decimal v) => v.ToString("#,##0", CultureInfo.GetCultureInfo("vi-VN")) + " đ";

    /// <summary>Trạng thái hợp đồng đang chạy theo ngày mới (các trạng thái khác như trả kho / kết thúc giữ nguyên).</summary>
    public static string RunningStatus(DateOnly end, DateOnly today) =>
        end <= today ? "OVERDUE" : end.DayNumber - today.DayNumber <= ExpiringDays ? "EXPIRING" : "ACTIVE";

    public static int OverdueDays(DateOnly end, DateOnly today) => Math.Max(0, today.DayNumber - end.DayNumber);

    private IQueryable<RentalContract> Query() => dbContext.RentalContracts
        .Include(c => c.Customer).Include(c => c.Unit).ThenInclude(u => u.Facility).Include(c => c.Payments).Include(c => c.Reservation);

    private static DemoContractDto Dto(RentalContract c) => new(c.ContractId, Code(c), c.Customer.FullName, c.Unit.Facility.Name, c.Unit.UnitNumber,
        c.StartDate, c.EndDate, c.AgreedMonthlyRate, c.DepositAmount, c.Status, Running.Contains(c.Status) ? OverdueDays(c.EndDate, Today) : 0,
        c.Payments.OrderBy(p => p.CreatedAt).Select(p => new DemoPaymentDto(p.PaymentId, p.PaymentType, p.Amount, p.Status, Local(p.PaidAt), p.DueDate?.ToString("yyyy-MM-dd"))).ToList());

    public async Task<IReadOnlyList<DemoContractDto>> ListContractsAsync(string? search, CancellationToken ct = default)
    {
        var q = (search ?? string.Empty).Trim();
        var rows = await Query().AsNoTracking().AsSplitQuery()
            .Where(c => c.Status != "CANCELLED")
            .OrderByDescending(c => c.CreatedAt).Take(200).ToListAsync(ct);
        return rows.Where(c => q.Length == 0 || Code(c).Contains(q, StringComparison.OrdinalIgnoreCase)
                               || c.Customer.FullName.Contains(q, StringComparison.OrdinalIgnoreCase)
                               || c.Unit.UnitNumber.Contains(q, StringComparison.OrdinalIgnoreCase))
            .Take(50).Select(Dto).ToList();
    }

    private void Log(long adminId, string action, string entity, long id, object before, object after, string? reason) =>
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = adminId, Action = action, EntityType = entity, EntityId = id,
            OldValue = JsonSerializer.Serialize(before), NewValue = JsonSerializer.Serialize(new { after, reason, demo = true }), LoggedAt = DateTime.UtcNow
        });

    public async Task<DemoEditResultDto> EditContractAsync(long adminId, long contractId, DemoContractEditRequest request, CancellationToken ct = default)
    {
        if (request.EndDate <= request.StartDate) throw new ArgumentException("Ngày hết hạn phải sau ngày bắt đầu.");
        if (request.EndDate.DayNumber - request.StartDate.DayNumber > 3660) throw new ArgumentException("Kỳ thuê tối đa 10 năm.");
        if (request.AgreedMonthlyRate is decimal r && (r <= 0 || r > MaxAmount)) throw new ArgumentException("Giá thuê tháng phải lớn hơn 0.");
        var c = await Query().AsSplitQuery().FirstOrDefaultAsync(x => x.ContractId == contractId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
        var today = Today;
        var before = new { c.StartDate, c.EndDate, c.AgreedMonthlyRate, c.Status, Unit = c.Unit.Status };
        var changes = new List<DemoChangeDto>();
        void Track(string field, string? a, string? b) { if (a != b) changes.Add(new DemoChangeDto(field, a, b)); }

        Track("Ngày bắt đầu", c.StartDate.ToString("dd/MM/yyyy"), request.StartDate.ToString("dd/MM/yyyy"));
        Track("Ngày hết hạn", c.EndDate.ToString("dd/MM/yyyy"), request.EndDate.ToString("dd/MM/yyyy"));
        c.StartDate = request.StartDate;
        c.EndDate = request.EndDate;
        if (request.AgreedMonthlyRate is decimal rate)
        {
            Track("Giá thuê / tháng", Money(c.AgreedMonthlyRate), Money(rate));
            c.AgreedMonthlyRate = rate;
        }
        // Đơn đặt chỗ đi kèm cùng kỳ để màn khách / quản lý thống nhất
        if (c.Reservation != null) { c.Reservation.StartDate = request.StartDate; c.Reservation.ExpectedEndDate = request.EndDate; }
        if (Running.Contains(c.Status))
        {
            var next = RunningStatus(request.EndDate, today);
            Track("Trạng thái hợp đồng", c.Status, next);
            c.Status = next;
            // Ô: chưa tới ngày thuê → đang giữ chỗ; đã tới ngày → đang thuê (không đụng ô bảo trì / ngừng khai thác)
            var unitNext = request.StartDate > today ? "RESERVED" : "OCCUPIED";
            if (c.Unit.Status is "RESERVED" or "OCCUPIED" && c.Unit.Status != unitNext)
            {
                dbContext.UnitStatusHistories.Add(new UnitStatusHistory { UnitId = c.UnitId, ChangedBy = adminId, OldStatus = c.Unit.Status,
                    NewStatus = unitNext, ChangedAt = DateTime.UtcNow, Reason = $"Công cụ demo · chỉnh ngày {Code(c)}" });
                Track("Trạng thái ô", c.Unit.Status, unitNext);
                c.Unit.Status = unitNext;
                c.Unit.UpdatedAt = DateTime.UtcNow;
            }
            Track("Số ngày quá hạn", OverdueDays(before.EndDate, today).ToString(CultureInfo.InvariantCulture), OverdueDays(request.EndDate, today).ToString(CultureInfo.InvariantCulture));
        }
        if (changes.Count == 0) throw new ArgumentException("Chưa có thay đổi nào so với hiện tại.");
        Log(adminId, ContractEdited, "CONTRACT", c.ContractId, before,
            new { c.StartDate, c.EndDate, c.AgreedMonthlyRate, c.Status, Unit = c.Unit.Status }, request.Reason);
        await dbContext.SaveChangesAsync(ct);
        return new DemoEditResultDto(Code(c), changes, Dto(c));
    }

    public async Task<DemoEditResultDto> EditPaymentAsync(long adminId, long paymentId, DemoPaymentEditRequest request, CancellationToken ct = default)
    {
        if (request.PaidAt == null && request.Amount == null) throw new ArgumentException("Nhập ngày thanh toán hoặc số tiền cần chỉnh.");
        if (request.Amount is decimal a && (a <= 0 || a > MaxAmount)) throw new ArgumentException("Số tiền phải lớn hơn 0.");
        var p = await dbContext.Payments.FirstOrDefaultAsync(x => x.PaymentId == paymentId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy giao dịch.");
        var c = p.ContractId is long cid ? await Query().AsSplitQuery().FirstOrDefaultAsync(x => x.ContractId == cid, ct) : null;
        if (c == null) throw new InvalidOperationException("Chỉ chỉnh được giao dịch đã gắn hợp đồng.");
        var before = new { p.PaidAt, p.Amount };
        var changes = new List<DemoChangeDto>();
        if (request.PaidAt is DateTime local)
        {
            // Ô nhập là giờ Việt Nam
            var utc = DateTime.SpecifyKind(local, DateTimeKind.Unspecified) - VnOffset;
            if (utc > DateTime.UtcNow.AddMinutes(1)) throw new ArgumentException("Ngày thanh toán không được ở tương lai.");
            if (p.Status is not ("PAID" or "REFUNDED" or "PARTIALLY_REFUNDED")) throw new InvalidOperationException("Chỉ chỉnh ngày của giao dịch đã thanh toán.");
            changes.Add(new DemoChangeDto("Ngày thanh toán", Local(p.PaidAt), Local(utc)));
            p.PaidAt = utc;
        }
        if (request.Amount is decimal amount && amount != p.Amount)
        {
            changes.Add(new DemoChangeDto("Số tiền", Money(p.Amount), Money(amount)));
            p.Amount = amount;
        }
        if (changes.Count == 0) throw new ArgumentException("Chưa có thay đổi nào so với hiện tại.");
        p.UpdatedAt = DateTime.UtcNow;
        Log(adminId, PaymentEdited, "PAYMENT", p.PaymentId, before, new { p.PaidAt, p.Amount }, request.Reason);
        await dbContext.SaveChangesAsync(ct);
        return new DemoEditResultDto($"TT-{p.PaymentId:0000} · {Code(c)}", changes, Dto(c));
    }
}
