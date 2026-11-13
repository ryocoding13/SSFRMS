using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// #2 · Hệ thống tự bố trí ô kho ngay khi khách tạo đơn (Figma C04a-ô).
/// D48: không thêm bảng/cột — ô đề xuất ghi vào activity_logs (Action = UNIT_PROPOSED, EntityType = RESERVATION).
/// Quy tắc chọn dùng lại <see cref="UnitAvailability.Pick"/> (ô trống thật trước, rồi ô trống sớm nhất, rồi mã ô),
/// không thêm tiêu chí "phù hợp nhất" nào khác. Ô phải khả dụng cả kỳ thuê và không trùng ô đã đề xuất cho
/// một đơn khác còn hiệu lực cùng kỳ. Khi cấp hợp đồng, <see cref="ContractProvisioning"/> dùng đúng ô này nếu còn trống.
/// </summary>
public static class UnitProposal
{
    /// <summary>Tên hành động ghi nhật ký khi hệ thống bố trí ô cho đơn.</summary>
    public const string Action = "UNIT_PROPOSED";

    /// <summary>Ô đã đề xuất cho đơn (đọc từ nhật ký gần nhất).</summary>
    public sealed record Proposed(long UnitId, string UnitNumber, string Mode = "AUTO", long? SelectedUnitId = null);

    /// <summary>Đọc ô hệ thống đã bố trí cho đơn, null nếu đơn chưa có đề xuất.</summary>
    public static async Task<Proposed?> OfAsync(AppDbContext db, long reservationId, CancellationToken ct)
    {
        var raw = await db.ActivityLogs.AsNoTracking()
            .Where(l => l.Action == Action && l.EntityType == "RESERVATION" && l.EntityId == reservationId)
            .OrderByDescending(l => l.LoggedAt).ThenByDescending(l => l.LogId)
            .Select(l => l.NewValue).FirstOrDefaultAsync(ct);
        return Parse(raw);
    }

    /// <summary>Giải mã nội dung nhật ký đề xuất ({"unitId":..,"unit":"..","mode":"..","selectedUnitId":..}).</summary>
    public static Proposed? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("unitId", out var id) || !id.TryGetInt64(out var unitId)) return null;
            var number = root.TryGetProperty("unit", out var u) ? u.GetString() : null;
            if (string.IsNullOrWhiteSpace(number)) return null;
            var mode = root.TryGetProperty("mode", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() ?? "AUTO" : "AUTO";
            long? selectedUnitId = root.TryGetProperty("selectedUnitId", out var su) && su.ValueKind == JsonValueKind.Number && su.TryGetInt64(out var sId) ? sId : null;
            return new Proposed(unitId, number, mode, selectedUnitId);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Các ô đang được đề xuất cho đơn khác còn hiệu lực, chưa phân bổ chính thức, trùng kỳ [start, end)
    /// (tính cả ngày đệm RELET_BUFFER giữa hai lượt thuê như hợp đồng thật).
    /// </summary>
    public static async Task<HashSet<long>> HeldByOthersAsync(AppDbContext db, long facilityId, long? unitTypeId,
        DateOnly start, DateOnly end, long excludeReservationId, CancellationToken ct, int bufferDays = 0)
    {
        var now = DateTime.UtcNow;
        var from = start.AddDays(-bufferDays);
        var to = end.AddDays(bufferDays);
        var live = await db.Reservations.AsNoTracking()
            .Where(r => r.FacilityId == facilityId && (unitTypeId == null || r.UnitTypeId == unitTypeId.Value) && r.ReservationId != excludeReservationId
                && (r.Status == "CONFIRMED" || ((r.Status == "PENDING_PAYMENT" || r.Status == "PENDING_VERIFICATION" || r.Status == "PENDING_AT_FACILITY")
                                                && r.ExpiresAt > now))
                && !r.UnitAssignments.Any(a => a.Status == "ACTIVE")
                && r.StartDate < to && r.ExpectedEndDate > from)
            .Select(r => r.ReservationId).ToListAsync(ct);
        if (live.Count == 0) return [];
        var logs = await db.ActivityLogs.AsNoTracking()
            .Where(l => l.Action == Action && l.EntityType == "RESERVATION" && l.EntityId != null && live.Contains(l.EntityId.Value))
            .Select(l => new { l.EntityId, l.LoggedAt, l.LogId, l.NewValue }).ToListAsync(ct);
        return logs.GroupBy(l => l.EntityId)
            .Select(g => Parse(g.OrderByDescending(l => l.LoggedAt).ThenByDescending(l => l.LogId).First().NewValue))
            .Where(p => p != null).Select(p => p!.UnitId).ToHashSet();
    }

    /// <summary>
    /// Chọn ô cho đơn: ưu tiên ô đã đề xuất nếu còn khả dụng cả kỳ; nếu không, chọn ô khác theo <see cref="UnitAvailability.Pick"/>
    /// và bỏ qua ô đang đề xuất cho đơn khác. Riêng chế độ EXACT chỉ giữ đúng ô đó, không tự đổi ô.
    /// </summary>
    public static async Task<StorageUnit?> ChooseAsync(AppDbContext db, Reservation r, CancellationToken ct)
    {
        var today = OpsRules.TodayLocal;
        var buffer = await UnitAvailability.BufferDaysAsync(db, r.FacilityId, r.UnitTypeId, today, ct);
        var slots = await UnitAvailability.SlotsAsync(db, r.FacilityId, r.UnitTypeId, ct);
        var current = r.ReservationId > 0 ? await OfAsync(db, r.ReservationId, ct) : null;
        var held = await HeldByOthersAsync(db, r.FacilityId, r.UnitTypeId, r.StartDate, r.ExpectedEndDate, r.ReservationId, ct, buffer);

        if (current != null)
        {
            var kept = slots.FirstOrDefault(s => s.Unit.UnitId == current.UnitId);
            if (kept != null && !held.Contains(current.UnitId) && UnitAvailability.Bookable(kept, r.StartDate, r.ExpectedEndDate, buffer, today))
            {
                return kept.Unit;
            }
            if (current.Mode == "EXACT")
            {
                // D56: Chế độ EXACT không tự đổi sang ô khác khi ô đã chọn không còn khả dụng
                return null;
            }
        }
        return UnitAvailability.Pick(slots.Where(s => !held.Contains(s.Unit.UnitId)), r.StartDate, r.ExpectedEndDate, buffer, today)?.Unit;
    }

    /// <summary>Ghi nhật ký ô đã bố trí cho đơn (gọi trong cùng transaction tạo đơn / cấp hợp đồng).</summary>
    public static void Record(AppDbContext db, long? actor, Reservation r, StorageUnit unit, string reason, string mode = "AUTO", long? selectedUnitId = null) =>
        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = actor, Action = Action, EntityType = "RESERVATION", EntityId = r.ReservationId,
            NewValue = JsonSerializer.Serialize(new
            {
                unitId = unit.UnitId,
                unit = unit.UnitNumber,
                mode,
                selectedUnitId = selectedUnitId ?? (mode == "EXACT" ? unit.UnitId : (long?)null),
                reason
            }),
            LoggedAt = DateTime.UtcNow
        });
}
