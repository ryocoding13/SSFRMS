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
/// Dịch vụ vận hành cơ sở dành cho Nhân viên cơ sở (S01–S09) và Quản lý cơ sở (M01–M08) — tiền tố route /api/ops/*.
/// Mọi truy vấn và thao tác chỉ trong phạm vi cơ sở đang được phân công cho tài khoản nhân viên/quản lý (SRS A06).
/// Phần dùng chung: xác định cơ sở, mã hiển thị, định dạng giờ Việt Nam, ghi nhật ký hoạt động.
/// </summary>
public partial class FacilityOpsService(AppDbContext dbContext) : IFacilityOpsService
{
    /// <summary>Độ lệch múi giờ Việt Nam (UTC+7).</summary>
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);
    /// <summary>Định dạng văn hoá bất biến dùng cho số và ngày tháng.</summary>
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    /// <summary>Các trạng thái hợp đồng còn gắn với ô kho (ô đang có khách hoặc đã giữ cho khách).</summary>
    private static readonly string[] HeldContractStatuses = ["DRAFT", "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    /// <summary>Khoảng thời gian (ngày) còn hiển thị công việc đã xong trên bảng Kanban/Board.</summary>
    private const int RecentDays = 14;

    /// <summary>Thời điểm hiện tại theo chuẩn UTC.</summary>
    private static DateTime NowUtc => DateTime.UtcNow;
    /// <summary>Ngày hiện tại theo giờ Việt Nam (UTC+7).</summary>
    private static DateOnly VnToday => DateOnly.FromDateTime(DateTime.UtcNow + VnOffset);

    /// <summary>Chuyển đổi DateTime UTC sang chuỗi giờ Việt Nam định dạng chuẩn ISO "yyyy-MM-ddTHH:mm:ss" (D10).</summary>
    private static string? Local(DateTime? utc) =>
        utc.HasValue ? (utc.Value + VnOffset).ToString("yyyy-MM-dd'T'HH:mm:ss", Invariant) : null;

    /// <summary>Chuyển đổi DateTime UTC hoặc ngày dự phòng thành chuỗi giờ địa phương.</summary>
    private static string LocalOrDate(DateTime? utc, DateOnly fallback, int hour = 9) =>
        Local(utc) ?? fallback.ToDateTime(new TimeOnly(hour, 0)).ToString("yyyy-MM-dd'T'HH:mm:ss", Invariant);

    /// <summary>Chuyển đổi ngày và giờ Việt Nam sang chuẩn DateTime UTC.</summary>
    private static DateTime UtcFromLocal(DateOnly date, int hour) =>
        DateTime.SpecifyKind(date.ToDateTime(new TimeOnly(hour, 0)) - VnOffset, DateTimeKind.Utc);

    /// <summary>Định dạng số tiền VND hiển thị thân thiện (ví dụ: "1,500,000 đ").</summary>
    private static string Money(decimal amount) =>
        string.Format(CultureInfo.GetCultureInfo("vi-VN"), "{0:#,0} đ", amount);

    // ------------------------------------------------------------------
    // Mã hiển thị nghiệp vụ — khớp hoàn toàn với giao diện khách hàng (src/api/mappers.js)
    // ------------------------------------------------------------------
    
    /// <summary>Tạo mã đơn đặt chỗ hiển thị: SS-yyyyMMdd-xxxx.</summary>
    internal static string ReservationCode(Reservation r) =>
        $"SS-{(r.CreatedAt + VnOffset):yyyyMMdd}-{r.ReservationId:0000}";
    /// <summary>Tạo mã hợp đồng hiển thị: HĐ-yyyy-xxxx.</summary>
    internal static string ContractCode(RentalContract c) => $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";
    /// <summary>Tạo mã xác minh nhận kho hiển thị: XM-xxxx.</summary>
    internal static string VerificationCode(long handoverId) => $"XM-{handoverId:0000}";
    /// <summary>Tạo mã bàn giao kho hiển thị: BG-xxxx.</summary>
    internal static string HandoverCode(long handoverId) => $"BG-{handoverId:0000}";
    /// <summary>Tạo mã biên bản trả kho hiển thị: TK-xxxx.</summary>
    internal static string ReturnCode(long inspectionId) => $"TK-{inspectionId:0000}";
    /// <summary>Tạo mã phiếu hỗ trợ kỹ thuật hiển thị: HT-xxxx.</summary>
    internal static string TicketCode(long ticketId) => $"HT-{ticketId:0000}";
    /// <summary>Tạo mã yêu cầu gia hạn hiển thị: GH-xxxx.</summary>
    internal static string RenewalCode(long renewalId) => $"GH-{renewalId:0000}";
    /// <summary>Tạo mã nhân viên hiển thị: NV-xx.</summary>
    internal static string StaffCode(long userId) => $"NV-{userId:00}";

    /// <summary>
    /// Trích xuất ID số nguyên từ chuỗi mã hiển thị (ví dụ "SS-20261014-0012" → 12). Ném lỗi KeyNotFoundException nếu sai định dạng.
    /// </summary>
    /// <param name="code">Chuỗi mã cần phân tích.</param>
    /// <param name="prefix">Tiền tố bắt buộc (SS-, HĐ-, TK-,...).</param>
    /// <param name="what">Tên đối tượng mô tả khi ném lỗi.</param>
    /// <returns>ID số nguyên dài (long).</returns>
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

    /// <summary>Tạo nhãn tóm tắt thông số loại kho (ví dụ: "Kho lạnh · Cỡ M · 12 m²").</summary>
    private static string OfferLabel(UnitType type) =>
        $"{(type.ClimateControlled ? "Kho lạnh" : "Kho thường")} · Cỡ {(type.Area <= 20 ? "M" : "L")} · {type.Area.ToString("0.#", Invariant)} m²";

    /// <summary>Phân loại kho: "climate" (lạnh) hoặc "normal" (thường).</summary>
    private static string TypeKey(UnitType type) => type.ClimateControlled ? "climate" : "normal";

    // ------------------------------------------------------------------
    // Cơ sở được phân công + nhân viên của cơ sở
    // ------------------------------------------------------------------

    /// <summary>
    /// Lấy thực thể Facility mà tài khoản hiện tại đang được phân công hoạt động ACTIVE.
    /// </summary>
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

    /// <summary>Kiểm tra quyền bắt buộc phải là Quản lý cơ sở (IsManager).</summary>
    private static void RequireManager(OpsActor actor)
    {
        if (!actor.IsManager)
        {
            throw new UnauthorizedAccessException("Chỉ quản lý cơ sở được thực hiện thao tác này.");
        }
    }

    /// <summary>Lấy danh sách các nhân viên (role STAFF) đang được phân công cùng cơ sở.</summary>
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

    /// <summary>Lấy chuỗi hiển thị ca làm việc theo giờ mở/đóng cửa của cơ sở.</summary>
    private static string Shift(Facility f) =>
        f.OpeningTime.HasValue && f.ClosingTime.HasValue
            ? $"{f.OpeningTime.Value:HH\\:mm}–{f.ClosingTime.Value:HH\\:mm}"
            : "Theo giờ cơ sở";

    // ------------------------------------------------------------------
    // Nhật ký (activity_logs, BR13) — lưu trữ vết kiểm toán và thông tin mở rộng
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

    /// <summary>Ghi một bản ghi nhật ký hoạt động ActivityLog.</summary>
    private void Log(long? userId, string action, string entityType, long entityId, object value) =>
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            NewValue = JsonSerializer.Serialize(value),
            LoggedAt = NowUtc
        });

    /// <summary>Đọc một trường thuộc tính JSON từ NewValue của ActivityLog.</summary>
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

    /// <summary>Tải danh sách ActivityLog của một tập các entityId.</summary>
    private async Task<List<ActivityLog>> LogsAsync(string entityType, ICollection<long> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        return await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.EntityType == entityType && l.EntityId != null && ids.Contains(l.EntityId.Value))
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);
    }

    /// <summary>Cập nhật trạng thái ô kho và ghi lịch sử UnitStatusHistory tương ứng.</summary>
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

    /// <summary>Tính tổng số tiền chưa thanh toán của hợp đồng.</summary>
    private static decimal Unpaid(RentalContract c) =>
        c.Payments.Where(p => (p.Status == "PENDING" || p.Status == "FAILED") && p.PaymentType != "REFUND").Sum(p => p.Amount);

    /// <summary>Cắt ngắn chuỗi văn bản nếu vượt quá độ dài tối đa cho phép.</summary>
    private static string Clip(string? text, int max = 1000)
    {
        var t = (text ?? string.Empty).Trim();
        return t.Length > max ? t[..max] : t;
    }
}
