using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Khu Nhân viên cơ sở (S01–S09) và Quản lý cơ sở (M01–M08) — /api/ops/*.
/// Mọi truy vấn và thao tác chỉ trong cơ sở đang được phân công cho tài khoản (SRS A06).
/// Phần dùng chung: xác định cơ sở, mã hiển thị, giờ Việt Nam, nhật ký. Màn hình: FacilityOpsService.Board.cs;
/// thao tác: FacilityOpsService.Actions.cs. Nghiệp vụ khớp src/ops/reducer.js của giao diện.
/// </summary>
public partial class FacilityOpsService(AppDbContext dbContext) : IFacilityOpsService
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    // Hợp đồng còn gắn với ô kho (ô đang có khách hoặc đã giữ cho khách)
    private static readonly string[] HeldContractStatuses = ["DRAFT", "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    // Khoảng thời gian còn hiện việc đã xong trên bảng (để nhân viên / quản lý thấy kết quả vừa xử lý)
    private const int RecentDays = 14;

    private static DateTime NowUtc => DateTime.UtcNow;
    private static DateOnly VnToday => DateOnly.FromDateTime(DateTime.UtcNow + VnOffset);

    /// <summary>Giờ Việt Nam "yyyy-MM-ddTHH:mm:ss" (DB lưu UTC — D10).</summary>
    private static string? Local(DateTime? utc) =>
        utc.HasValue ? (utc.Value + VnOffset).ToString("yyyy-MM-dd'T'HH:mm:ss", Invariant) : null;

    private static string LocalOrDate(DateTime? utc, DateOnly fallback, int hour = 9) =>
        Local(utc) ?? fallback.ToDateTime(new TimeOnly(hour, 0)).ToString("yyyy-MM-dd'T'HH:mm:ss", Invariant);

    private static DateTime UtcFromLocal(DateOnly date, int hour) =>
        DateTime.SpecifyKind(date.ToDateTime(new TimeOnly(hour, 0)) - VnOffset, DateTimeKind.Utc);

    private static string Money(decimal amount) =>
        string.Format(CultureInfo.GetCultureInfo("vi-VN"), "{0:#,0} đ", amount);

    // ------------------------------------------------------------------
    // Mã hiển thị — giống mã khách hàng thấy (src/api/mappers.js)
    // ------------------------------------------------------------------
    internal static string ReservationCode(Reservation r) =>
        $"SS-{(r.CreatedAt + VnOffset):yyyyMMdd}-{r.ReservationId:0000}";
    internal static string ContractCode(RentalContract c) => $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";
    internal static string VerificationCode(long handoverId) => $"XM-{handoverId:0000}";
    internal static string HandoverCode(long handoverId) => $"BG-{handoverId:0000}";
    internal static string ReturnCode(long inspectionId) => $"TK-{inspectionId:0000}";
    internal static string TicketCode(long ticketId) => $"HT-{ticketId:0000}";
    internal static string RenewalCode(long renewalId) => $"GH-{renewalId:0000}";
    internal static string StaffCode(long userId) => $"NV-{userId:00}";

    /// <summary>Đọc số cuối của mã ("SS-20261014-0012" → 12). Sai tiền tố / không có số → 404.</summary>
    internal static long ParseCode(string? code, string prefix, string what)
    {
        var text = (code ?? string.Empty).Trim();
        if (!text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new KeyNotFoundException($"Không tìm thấy {what}.");
        }
        var m = Regex.Match(text, @"(\d+)$");
        if (!m.Success || !long.TryParse(m.Groups[1].Value, out var id) || id <= 0)
        {
            throw new KeyNotFoundException($"Không tìm thấy {what}.");
        }
        return id;
    }

    private static string OfferLabel(UnitType type) =>
        $"{(type.ClimateControlled ? "Kho lạnh" : "Kho thường")} · Cỡ {(type.Area <= 20 ? "M" : "L")} · {type.Area.ToString("0.#", Invariant)} m²";

    private static string TypeKey(UnitType type) => type.ClimateControlled ? "climate" : "normal";

    // ------------------------------------------------------------------
    // Cơ sở được phân công + nhân viên của cơ sở
    // ------------------------------------------------------------------
    private async Task<Facility> FacilityOfAsync(OpsActor actor, CancellationToken ct)
    {
        var today = VnToday;
        var assignment = await dbContext.UserFacilities
            .AsNoTracking()
            .Include(uf => uf.Facility)
            .Where(uf => uf.UserId == actor.UserId
                         && uf.Status == "ACTIVE"
                         && uf.AssignedFrom <= today
                         && (uf.AssignedTo == null || uf.AssignedTo >= today))
            .OrderByDescending(uf => uf.AssignedFrom)
            .FirstOrDefaultAsync(ct);

        return assignment?.Facility
            ?? throw new UnauthorizedAccessException("Tài khoản chưa được phân công cơ sở. Liên hệ quản trị hệ thống.");
    }

    private static void RequireManager(OpsActor actor)
    {
        if (!actor.IsManager)
        {
            throw new UnauthorizedAccessException("Chỉ quản lý cơ sở được thực hiện thao tác này.");
        }
    }

    /// <summary>Nhân viên (role STAFF) đang được phân công cùng cơ sở.</summary>
    private async Task<List<User>> FacilityStaffAsync(long facilityId, CancellationToken ct)
    {
        var today = VnToday;
        return await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Status == "ACTIVE"
                        && u.UserRoles.Any(ur => ur.Role.RoleName == "STAFF")
                        && u.UserFacilities.Any(uf => uf.FacilityId == facilityId
                                                      && uf.Status == "ACTIVE"
                                                      && uf.AssignedFrom <= today
                                                      && (uf.AssignedTo == null || uf.AssignedTo >= today)))
            .OrderBy(u => u.FullName)
            .ToListAsync(ct);
    }

    private static string Shift(Facility f) =>
        f.OpeningTime.HasValue && f.ClosingTime.HasValue
            ? $"{f.OpeningTime.Value:HH\\:mm}–{f.ClosingTime.Value:HH\\:mm}"
            : "Theo giờ cơ sở";

    // ------------------------------------------------------------------
    // Nhật ký (activity_logs, BR13) — cũng là nơi lưu phần giao diện cần mà bảng chưa có cột
    // (giấy tờ đã xác minh, biên bản trả kho, phản hồi hỗ trợ, lý do từ chối, lần nhắc khách)
    // ------------------------------------------------------------------
    private static class LogAction
    {
        public const string TransferReported = "TRANSFER_REPORTED";
        public const string PaymentConfirmed = "PAYMENT_CONFIRMED";
        public const string PaymentMismatch = "PAYMENT_MISMATCH";
        public const string CustomerVerified = "CUSTOMER_VERIFIED";
        public const string HandoverCompleted = "HANDOVER_COMPLETED";
        public const string ReturnInspected = "RETURN_INSPECTED";
        public const string TicketResponse = "TICKET_RESPONSE";
        public const string UnitAllocated = "UNIT_ALLOCATED";
        public const string TaskAssigned = "TASK_ASSIGNED";
        public const string RenewalApproved = "RENEWAL_APPROVED";
        public const string RenewalRejected = "RENEWAL_REJECTED";
        public const string OverdueReminder = "OVERDUE_REMINDER";
        public const string DepositRefunded = "DEPOSIT_REFUNDED";
    }

    private static class LogEntity
    {
        public const string Reservation = "RESERVATION";
        public const string Handover = "HANDOVER_RECORD";
        public const string Return = "RETURN_INSPECTION";
        public const string Ticket = "SUPPORT_TICKET";
        public const string Renewal = "CONTRACT_RENEWAL";
        public const string Contract = "RENTAL_CONTRACT";
    }

    private void Log(long userId, string action, string entityType, long entityId, object value) =>
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            NewValue = JsonSerializer.Serialize(value),
            LoggedAt = NowUtc
        });

    private static string? Read(ActivityLog log, string field)
    {
        if (string.IsNullOrWhiteSpace(log.NewValue)) return null;
        try
        {
            using var doc = JsonDocument.Parse(log.NewValue);
            return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty(field, out var v)
                ? v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private async Task<List<ActivityLog>> LogsAsync(string entityType, ICollection<long> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        return await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.EntityType == entityType && l.EntityId != null && ids.Contains(l.EntityId.Value))
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);
    }

    private void SetUnitStatus(StorageUnit unit, string status, long userId, string reason)
    {
        if (unit.Status == status) return;
        dbContext.UnitStatusHistories.Add(new UnitStatusHistory
        {
            UnitId = unit.UnitId,
            ChangedBy = userId,
            OldStatus = unit.Status,
            NewStatus = status,
            Reason = reason.Length > 255 ? reason[..255] : reason,
            ChangedAt = NowUtc
        });
        unit.Status = status;
        unit.UpdatedAt = NowUtc;
    }

    private static decimal Unpaid(RentalContract c) =>
        c.Payments.Where(p => (p.Status == "PENDING" || p.Status == "FAILED") && p.PaymentType != "REFUND").Sum(p => p.Amount);

    private static string Clip(string? text, int max = 1000)
    {
        var t = (text ?? string.Empty).Trim();
        return t.Length > max ? t[..max] : t;
    }
}
