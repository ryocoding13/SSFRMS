using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// #47 (Lượt 4): trạng thái cửa mô phỏng của từng ô, đọc từ activity_logs (D48 — không thêm cột).
/// Mở: ACCESS_SCANNED với result = OPEN (AccessService). Đóng: DOOR_CLOSED (nút "Đóng cửa", Lượt 6).
/// Không có lần mở nào → coi như đang khoá, chưa có thời điểm cập nhật. Không gọi là thiết bị thật khi chưa kết nối.
/// </summary>
public partial class FacilityOpsService
{
    /// <summary>Hành động ghi khi khách hoặc máy quét đóng cửa (không tự khoá, D51).</summary>
    public const string DoorClosedAction = "DOOR_CLOSED";

    /// <summary>Trạng thái cửa mô phỏng: đang mở hay không, và thời điểm sự kiện gần nhất.</summary>
    public readonly record struct DoorState(bool Open, DateTime? At);

    /// <summary>Đọc trạng thái cửa mới nhất theo mã ô tại cơ sở.</summary>
    private async Task<Dictionary<string, DoorState>> DoorStatesAsync(long facilityId, CancellationToken ct)
    {
        var contractIds = await dbContext.RentalContracts.AsNoTracking()
            .Where(c => c.Unit.FacilityId == facilityId).Select(c => c.ContractId).ToListAsync(ct);
        if (contractIds.Count == 0) return new();
        var logs = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == "CONTRACT" && l.EntityId != null && contractIds.Contains(l.EntityId.Value)
                        && (l.Action == "ACCESS_SCANNED" || l.Action == DoorClosedAction))
            .OrderBy(l => l.LoggedAt).ThenBy(l => l.LogId)
            .Select(l => new { l.Action, l.NewValue, l.LoggedAt })
            .ToListAsync(ct);
        var result = new Dictionary<string, DoorState>(StringComparer.OrdinalIgnoreCase);
        foreach (var l in logs)
        {
            var (unit, outcome) = DoorEvent(l.NewValue);
            if (string.IsNullOrWhiteSpace(unit)) continue;
            if (l.Action == DoorClosedAction) result[unit!] = new DoorState(false, l.LoggedAt);
            else if (outcome == "OPEN") result[unit!] = new DoorState(true, l.LoggedAt);
            // DENIED không đổi trạng thái cửa.
        }
        return result;
    }

    /// <summary>Đọc ô và kết quả từ nội dung nhật ký ({"unit":"..","result":".."}).</summary>
    public static (string? Unit, string? Result) DoorEvent(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (null, null);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            string? Read(string name) => root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            return (Read("unit"), Read("result"));
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }
}
