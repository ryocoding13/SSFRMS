using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.DTOs.Common;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Lượt 6 · #48–#51 (D51): cửa mô phỏng của ô kho.
/// - Mở: AccessService.ScanAsync ghi ACCESS_SCANNED (result OPEN/DENIED, method QR/PIN).
/// - Đóng: DOOR_CLOSED (từ máy quét hoặc nút "Đóng cửa" của khách). Không tự khoá: cửa giữ mở tới khi có người đóng.
/// - Hỗ trợ tại cửa: tạo một yêu cầu hỗ trợ cho nhân viên cơ sở, chống gửi trùng trong 30 phút.
/// D48: không thêm bảng — mọi sự kiện nằm trong activity_logs (EntityType CONTRACT).
/// </summary>
public class DoorService(AppDbContext dbContext) : IDoorService
{
    public const string ScanAction = "ACCESS_SCANNED";
    public const string ClosedAction = FacilityOpsService.DoorClosedAction;
    public const string SupportAction = "DOOR_SUPPORT_REQUESTED";
    public const string SupportTitlePrefix = "Hỗ trợ tại cửa kho ";
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);
    private static readonly string[] RentedNow = ["ACTIVE", "EXPIRING", "OVERDUE"];
    private static readonly string[] OpenTicket = ["OPEN", "ASSIGNED", "IN_PROGRESS"];
    private static readonly TimeSpan SupportWindow = TimeSpan.FromMinutes(30);

    private static string Local(DateTime utc) => (utc + VnOffset).ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);

    /// <summary>Đọc ô và kết quả từ nội dung nhật ký cửa.</summary>
    public static (string? Unit, string? Result, string? Method, string? Reason) Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (null, null, null, null);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            string? Read(string n) => r.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            return (Read("unit"), Read("result"), Read("method"), Read("reason"));
        }
        catch (JsonException) { return (null, null, null, null); }
    }

    /// <summary>Ô theo mã (và cơ sở nếu có). Mã ô trùng giữa các cơ sở mà không chọn cơ sở → báo chọn cơ sở.</summary>
    private async Task<StorageUnit> UnitAsync(string? unitNumber, long? facilityId, CancellationToken ct)
    {
        var code = (unitNumber ?? string.Empty).Trim();
        if (code.Length == 0) throw new ArgumentException("Chọn ô kho trên máy quét.");
        var units = await dbContext.StorageUnits.Include(u => u.Facility)
            .Where(u => u.UnitNumber == code && (facilityId == null || u.FacilityId == facilityId)).ToListAsync(ct);
        if (units.Count == 0) throw new KeyNotFoundException("Không tìm thấy ô kho.");
        if (units.Count > 1) throw new ArgumentException("Mã ô có ở nhiều cơ sở. Chọn cơ sở trên máy quét.");
        return units[0];
    }

    /// <summary>Sự kiện cửa của một ô, cũ trước (chỉ các sự kiện đổi trạng thái: mở thành công / đóng).</summary>
    private async Task<(bool Open, DateTime? At, long? ContractId)> StateAsync(StorageUnit unit, CancellationToken ct)
    {
        // Hợp đồng ở cùng cơ sở (gồm khách đang chuyển sang ô này theo D46 — họ mở bằng mã hợp đồng cũ):
        // lọc theo cơ sở để mã ô trùng giữa các cơ sở không lẫn trạng thái.
        var contractIds = await dbContext.RentalContracts.AsNoTracking().Where(c => c.Unit.FacilityId == unit.FacilityId)
            .Select(c => c.ContractId).ToListAsync(ct);
        var logs = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == "CONTRACT" && (l.Action == ScanAction || l.Action == ClosedAction)
                        && l.EntityId != null && contractIds.Contains(l.EntityId.Value)
                        && l.NewValue != null && l.NewValue.Contains(unit.UnitNumber))
            .OrderBy(l => l.LoggedAt).ThenBy(l => l.LogId)
            .Select(l => new { l.Action, l.NewValue, l.LoggedAt, l.EntityId })
            .ToListAsync(ct);
        (bool, DateTime?, long?) state = (false, null, null);
        foreach (var l in logs)
        {
            var (u, result, _, _) = Parse(l.NewValue);
            if (!string.Equals(u, unit.UnitNumber, StringComparison.OrdinalIgnoreCase)) continue;
            if (l.Action == ClosedAction) state = (false, l.LoggedAt, l.EntityId);
            else if (result == "OPEN") state = (true, l.LoggedAt, l.EntityId);
        }
        return state;
    }

    private static DoorStateDto Dto(StorageUnit unit, (bool Open, DateTime? At, long? _) s, bool changed = false) =>
        new(unit.UnitNumber, s.Open ? "OPEN" : "LOCKED", s.At is DateTime at ? Local(at) : null, changed, unit.Facility?.Name);

    public async Task<DoorStateDto> GetUnitStateAsync(string? unitNumber, long? facilityId, CancellationToken ct = default)
    {
        var unit = await UnitAsync(unitNumber, facilityId, ct);
        return Dto(unit, await StateAsync(unit, ct));
    }

    /// <summary>Đóng cửa: ghi DOOR_CLOSED theo hợp đồng của lần mở gần nhất. Cửa đang đóng thì không ghi trùng.</summary>
    private async Task<DoorStateDto> CloseAsync(StorageUnit unit, long? actor, string method, string? ip, CancellationToken ct)
    {
        var state = await StateAsync(unit, ct);
        if (!state.Open) return Dto(unit, state);
        var now = DateTime.UtcNow;
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = actor, Action = ClosedAction, EntityType = "CONTRACT", EntityId = state.ContractId,
            NewValue = JsonSerializer.Serialize(new { result = "CLOSED", unit = unit.UnitNumber, method }),
            IpAddress = ip, LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);
        return Dto(unit, (false, now, state.ContractId), changed: true);
    }

    public async Task<DoorStateDto> CloseFromDeviceAsync(string? unitNumber, long? facilityId, string? ipAddress, CancellationToken ct = default) =>
        await CloseAsync(await UnitAsync(unitNumber, facilityId, ct), null, "CLOSE_DEVICE", ipAddress, ct);

    private async Task<RentalContract> OwnContractAsync(long customerId, long contractId, CancellationToken ct)
    {
        var c = await dbContext.RentalContracts.Include(x => x.Unit).ThenInclude(u => u.Facility)
            .FirstOrDefaultAsync(x => x.ContractId == contractId, ct);
        if (c == null || c.CustomerId != customerId) throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
        return c;
    }

    public async Task<DoorStateDto> GetContractDoorAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var c = await OwnContractAsync(customerId, contractId, ct);
        return Dto(c.Unit, await StateAsync(c.Unit, ct));
    }

    /// <summary>Khách bấm "Đóng cửa" trong Kho của tôi: chỉ cần xác nhận, không nhập lại QR/PIN (12/11).</summary>
    public async Task<DoorStateDto> CloseByCustomerAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var c = await OwnContractAsync(customerId, contractId, ct);
        if (c.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE" or "RETURN_PENDING"))
            throw new InvalidOperationException("Hợp đồng không còn hiệu lực, không điều khiển được cửa.");
        return await CloseAsync(c.Unit, customerId, "CLOSE_APP", null, ct);
    }

    /// <summary>
    /// #50: gửi hỗ trợ từ máy quét. Tự xác định cơ sở, ô và khách đang thuê ô; không bắt nhập lại hay chụp ảnh.
    /// Đã có yêu cầu đang mở cho ô này trong 30 phút → trả lại yêu cầu đó (bấm liên tục không tạo trùng).
    /// </summary>
    public async Task<DoorSupportResultDto> RequestSupportAsync(DoorSupportRequest request, string? ipAddress, CancellationToken ct = default)
    {
        var unit = await UnitAsync(request.UnitNumber, request.FacilityId, ct);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"door-support:{unit.UnitId}", ct);
        var now = DateTime.UtcNow;
        var since = now - SupportWindow;
        var title = SupportTitlePrefix + unit.UnitNumber;
        var existing = await dbContext.SupportTickets.AsNoTracking()
            .Where(t => t.UnitId == unit.UnitId && t.Title == title && OpenTicket.Contains(t.Status) && t.CreatedAt >= since)
            .OrderByDescending(t => t.CreatedAt).FirstOrDefaultAsync(ct);
        if (existing != null)
            return new DoorSupportResultDto($"HT-{existing.TicketId:0000}", unit.UnitNumber, unit.Facility.Name, existing.Status, Local(existing.CreatedAt), true);

        var today = DateOnly.FromDateTime(now + VnOffset);
        var contract = await dbContext.RentalContracts.AsNoTracking()
                           .Where(c => c.UnitId == unit.UnitId && RentedNow.Contains(c.Status) && c.StartDate <= today)
                           .OrderByDescending(c => c.StartDate).FirstOrDefaultAsync(ct)
                       ?? await dbContext.RentalContracts.AsNoTracking()
                           .Where(c => c.UnitId == unit.UnitId).OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync(ct)
                       ?? throw new InvalidOperationException("Ô này chưa có khách thuê. Liên hệ trực tiếp nhân viên cơ sở.");
        var lastDeny = (await dbContext.ActivityLogs.AsNoTracking()
                .Where(l => l.Action == ScanAction && l.NewValue != null && l.NewValue.Contains(unit.UnitNumber) && l.LoggedAt >= since)
                .OrderByDescending(l => l.LoggedAt).Select(l => l.NewValue).FirstOrDefaultAsync(ct)) is string raw
            ? Parse(raw) : default;
        var reason = (request.Reason ?? string.Empty).Trim();
        if (reason.Length > 500) reason = reason[..500];
        var description = reason.Length > 0 ? reason
            : lastDeny.Result == "DENIED" && lastDeny.Reason != null ? $"Khách cần hỗ trợ tại cửa. Lần quét gần nhất bị từ chối: {lastDeny.Reason}"
            : "Khách cần hỗ trợ tại cửa kho.";
        var ticket = new SupportTicket
        {
            CustomerId = contract.CustomerId, ContractId = contract.ContractId, UnitId = unit.UnitId,
            IssueType = "ACCESS_CODE", Title = title, Description = description, Priority = "HIGH", Status = "OPEN", CreatedAt = now
        };
        dbContext.SupportTickets.Add(ticket);
        await dbContext.SaveChangesAsync(ct);
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = null, Action = SupportAction, EntityType = "CONTRACT", EntityId = contract.ContractId,
            NewValue = JsonSerializer.Serialize(new { unit = unit.UnitNumber, ticketId = ticket.TicketId }), IpAddress = ipAddress, LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new DoorSupportResultDto($"HT-{ticket.TicketId:0000}", unit.UnitNumber, unit.Facility.Name, ticket.Status, Local(now), false);
    }

    /// <summary>#49: nhật ký cửa cho Công cụ demo. Không trả nguyên QR/PIN (nhật ký chỉ lưu cách mở).</summary>
    public async Task<PagedResult<DoorLogRowDto>> GetDoorLogsAsync(DoorLogFilter filter, CancellationToken ct = default)
    {
        var page = Math.Max(1, filter.Page);
        var size = Math.Clamp(filter.PageSize, 1, 100);
        var q = dbContext.ActivityLogs.AsNoTracking().Where(l => l.Action == ScanAction || l.Action == ClosedAction);
        if (filter.From is DateOnly from) { var f = from.ToDateTime(TimeOnly.MinValue) - VnOffset; q = q.Where(l => l.LoggedAt >= f); }
        if (filter.To is DateOnly to) { var t = to.AddDays(1).ToDateTime(TimeOnly.MinValue) - VnOffset; q = q.Where(l => l.LoggedAt < t); }
        if (!string.IsNullOrWhiteSpace(filter.UnitNumber)) { var u = filter.UnitNumber.Trim(); q = q.Where(l => l.NewValue != null && l.NewValue.Contains(u)); }
        var raw = await q.OrderByDescending(l => l.LoggedAt).ThenByDescending(l => l.LogId)
            .Select(l => new { l.LogId, l.Action, l.NewValue, l.LoggedAt, l.EntityId }).Take(2000).ToListAsync(ct);
        var ids = raw.Where(r => r.EntityId != null).Select(r => r.EntityId!.Value).Distinct().ToList();
        var contracts = await dbContext.RentalContracts.AsNoTracking().Where(c => ids.Contains(c.ContractId))
            .Select(c => new { c.ContractId, c.StartDate, Customer = c.Customer.FullName, c.Unit.FacilityId, Facility = c.Unit.Facility.Name })
            .ToDictionaryAsync(c => c.ContractId, ct);
        var rows = raw.Select(r =>
            {
                var (unit, result, method, reason) = Parse(r.NewValue);
                contracts.TryGetValue(r.EntityId ?? 0, out var c);
                var outcome = r.Action == ClosedAction ? "CLOSED" : result ?? "DENIED";
                return new { FacilityId = c?.FacilityId, Row = new DoorLogRowDto(r.LogId, Local(r.LoggedAt), c?.Facility, unit, c?.Customer,
                    c == null ? null : $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}", outcome, method, reason) };
            })
            .Where(x => filter.FacilityId == null || x.FacilityId == filter.FacilityId)
            .Where(x => string.IsNullOrWhiteSpace(filter.UnitNumber) || string.Equals(x.Row.UnitNumber, filter.UnitNumber.Trim(), StringComparison.OrdinalIgnoreCase))
            .Where(x => string.IsNullOrWhiteSpace(filter.Result) || string.Equals(x.Row.Result, filter.Result, StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Row).ToList();
        return new PagedResult<DoorLogRowDto>(rows.Skip((page - 1) * size).Take(size).ToList(), rows.Count, page, size);
    }
}
