using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D41 · Ô trống theo ngày. Ô đang thuê coi như trống từ ngày hết hạn hợp đồng hiện tại + số ngày đệm
/// (chính sách RELET_BUFFER, mặc định 3 ngày). Không cho đặt trước ô có hợp đồng đang quá hạn (OVERDUE).
/// Gia hạn đang chờ (PENDING/APPROVED) giữ ô tới ngày hết hạn mới.
/// Ô bảo trì / ngừng phục vụ / đang kiểm tra mà không có hợp đồng thì không đặt được.
/// </summary>
public static class UnitAvailability
{
    public const string BufferPolicyType = "RELET_BUFFER";
    public const int DefaultBufferDays = OpsRules.DefaultReletBufferDays;

    /// <summary>Hợp đồng còn giữ ô (khách cũ chưa trả xong hoặc khách mới đã đặt).</summary>
    public static readonly string[] HoldingStatuses = ["DRAFT", "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    private static readonly string[] BlockedUnitStatuses = ["MAINTENANCE", "OUT_OF_SERVICE", "INSPECTION"];

    public sealed record Hold(long ContractId, DateOnly StartDate, DateOnly EndDate, string Status);

    public sealed record UnitSlot(StorageUnit Unit, IReadOnlyList<Hold> Holds)
    {
        /// <summary>Không có hợp đồng giữ ô, ô ở trạng thái AVAILABLE — "trống thật" (ưu tiên khi tự gán).</summary>
        public bool FreeNow => Holds.Count == 0 && Unit.Status == "AVAILABLE";
    }

    public static async Task<int> BufferDaysAsync(AppDbContext db, long facilityId, long unitTypeId, DateOnly onDate, CancellationToken ct)
    {
        var policy = await OpsRules.FindApplicablePolicyAsync(db, BufferPolicyType, facilityId, unitTypeId, onDate, ct);
        return policy?.Value is decimal v && v >= 0 && v <= 60 ? (int)Math.Round(v) : DefaultBufferDays;
    }

    /// <summary>Ô của một loại tại cơ sở kèm các hợp đồng đang giữ ô (đã tính gia hạn đang chờ).</summary>
    public static async Task<List<UnitSlot>> SlotsAsync(AppDbContext db, long facilityId, long? unitTypeId, CancellationToken ct,
        long? excludeContractId = null)
    {
        var units = await db.StorageUnits.Include(u => u.UnitType)
            .Where(u => u.FacilityId == facilityId && (unitTypeId == null || u.UnitTypeId == unitTypeId) && u.Status != "OUT_OF_SERVICE"
                        && !u.MaintenanceRequests.Any(m => m.Status != "COMPLETED" && m.Status != "CANCELLED"))
            .OrderBy(u => u.UnitNumber).ThenBy(u => u.UnitId)
            .ToListAsync(ct);
        var ids = units.Select(u => u.UnitId).ToList();
        var unitChangeRenewals = RenewalUnitMove.UnitChangeRenewalIds(db); // D46: gia hạn sang ô khác không giữ ô cũ thêm kỳ mới
        var holds = await db.RentalContracts.AsNoTracking()
            .Where(c => ids.Contains(c.UnitId) && HoldingStatuses.Contains(c.Status) && c.ContractId != (excludeContractId ?? 0))
            .Select(c => new
            {
                c.ContractId, c.UnitId, c.StartDate, c.EndDate, c.Status,
                Pending = c.ContractRenewals.Where(r => (r.Status == "PENDING" || r.Status == "APPROVED") && !unitChangeRenewals.Contains(r.RenewalId))
                    .Select(r => (DateOnly?)r.NewEndDate).Max()
            })
            .ToListAsync(ct);
        return units.Select(u => new UnitSlot(u, holds.Where(h => h.UnitId == u.UnitId)
                .Select(h => new Hold(h.ContractId, h.StartDate,
                    h.Pending is DateOnly p && p > h.EndDate ? p : h.EndDate, h.Status))
                .OrderBy(h => h.StartDate).ToList()))
            .ToList();
    }

    /// <summary>
    /// Ô đặt được cho kỳ [start, end): mọi hợp đồng giữ ô hoặc kết thúc + đệm ≤ start, hoặc bắt đầu ≥ end + đệm.
    /// Hợp đồng quá hạn (OVERDUE) hoặc khách đã trả nhưng chưa có ngày trống (RETURN_PENDING quá hạn) chặn mọi kỳ chồng sau đó.
    /// </summary>
    public static bool Bookable(UnitSlot slot, DateOnly start, DateOnly end, int bufferDays, DateOnly today)
    {
        // Ô RESERVED không có hợp đồng = đang giữ cho đề xuất đổi kho 48 giờ (D41) → không cho đơn khác lấy.
        if (slot.Holds.Count == 0 && slot.Unit.Status == "RESERVED") return false;
        if (slot.Holds.Count == 0) return !BlockedUnitStatuses.Contains(slot.Unit.Status) || start > today.AddDays(bufferDays);
        foreach (var h in slot.Holds)
        {
            if (h.Status == "OVERDUE") return false; // D41: không cho đặt trước ô đang quá hạn
            var endsAt = h.EndDate < today && h.Status == "RETURN_PENDING" ? today : h.EndDate;
            var freeFrom = endsAt.AddDays(bufferDays);
            var before = freeFrom <= start;
            var after = h.StartDate >= end.AddDays(bufferDays);
            if (!before && !after) return false;
        }
        return true;
    }

    /// <summary>Ngày ô trống lại để hiện "Trống từ dd/mm" (null = đang trống / không xác định được do quá hạn).</summary>
    public static DateOnly? FreeFrom(UnitSlot slot, int bufferDays, DateOnly today)
    {
        if (slot.FreeNow) return null;
        if (slot.Holds.Any(h => h.Status == "OVERDUE")) return null;
        var last = slot.Holds.Count == 0 ? (DateOnly?)null : slot.Holds.Max(h => h.EndDate < today ? today : h.EndDate);
        return last?.AddDays(bufferDays);
    }

    /// <summary>
    /// Ô cho đơn mới: ưu tiên ô trống thật; chỉ dùng ô sắp hết hạn khi hết ô trống (D41), ô trống sớm hơn trước.
    /// </summary>
    public static UnitSlot? Pick(IEnumerable<UnitSlot> slots, DateOnly start, DateOnly end, int bufferDays, DateOnly today) =>
        slots.Where(s => Bookable(s, start, end, bufferDays, today))
            .OrderBy(s => s.FreeNow ? 0 : 1)
            .ThenBy(s => FreeFrom(s, bufferDays, today) ?? DateOnly.MinValue)
            .ThenBy(s => s.Unit.UnitNumber).ThenBy(s => s.Unit.UnitId)
            .FirstOrDefault();

    /// <summary>Số ô đặt được trừ các đơn chưa gán ô đang giữ chỗ cùng kỳ.</summary>
    public static async Task<int> CountBookableAsync(AppDbContext db, long facilityId, long unitTypeId, DateOnly start, DateOnly end,
        CancellationToken ct = default)
    {
        var today = OpsRules.TodayLocal;
        var buffer = await BufferDaysAsync(db, facilityId, unitTypeId, today, ct);
        var slots = await SlotsAsync(db, facilityId, unitTypeId, ct);
        var bookable = slots.Count(s => Bookable(s, start, end, buffer, today));
        var waiting = await db.Reservations.CountAsync(r => r.FacilityId == facilityId && r.UnitTypeId == unitTypeId
            && (r.Status == "CONFIRMED" || ((r.Status == "PENDING_PAYMENT" || r.Status == "PENDING_VERIFICATION" || r.Status == "PENDING_AT_FACILITY")
                                            && r.ExpiresAt > DateTime.UtcNow))
            && !r.UnitAssignments.Any(a => a.Status == "ACTIVE")
            && r.StartDate < end && r.ExpectedEndDate > start, ct);
        return Math.Max(0, bookable - waiting);
    }

    /// <summary>D41: hợp đồng mới đặt cùng ô bắt đầu từ ngày hết hạn của hợp đồng này trở đi — khoá gia hạn.</summary>
    public static async Task<DateOnly?> NextBookingAsync(AppDbContext db, RentalContract contract, CancellationToken ct) =>
        await db.RentalContracts.AsNoTracking()
            .Where(c => c.UnitId == contract.UnitId && c.ContractId != contract.ContractId && HoldingStatuses.Contains(c.Status)
                        && c.StartDate > contract.StartDate)
            .OrderBy(c => c.StartDate)
            .Select(c => (DateOnly?)c.StartDate)
            .FirstOrDefaultAsync(ct);
}
