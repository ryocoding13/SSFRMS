using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D41 · Tính toán tình trạng ô kho trống theo ngày và lập lịch đặt trước.
/// Ô đang thuê coi như trống từ ngày hết hạn hợp đồng hiện tại + số ngày đệm (chính sách RELET_BUFFER, mặc định 3 ngày).
/// Không cho đặt trước ô có hợp đồng đang quá hạn (OVERDUE).
/// Gia hạn đang chờ (PENDING/APPROVED) giữ ô tới ngày hết hạn mới.
/// Ô bảo trì / ngừng phục vụ / đang kiểm tra mà không có hợp đồng thì không đặt được.
/// </summary>
public static class UnitAvailability
{
    /// <summary>Tên loại chính sách quy định số ngày đệm cho thuê lại giữa hai chu kỳ hợp đồng (D41).</summary>
    public const string BufferPolicyType = "RELET_BUFFER";
    /// <summary>Số ngày đệm mặc định (3 ngày) để dọn dẹp, kiểm tra kho trước khi giao khách mới (D41).</summary>
    public const int DefaultBufferDays = OpsRules.DefaultReletBufferDays;

    /// <summary>Các trạng thái hợp đồng còn giữ ô (khách cũ chưa trả xong hoặc khách mới đã đặt).</summary>
    public static readonly string[] HoldingStatuses = ["DRAFT", "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    /// <summary>Các trạng thái ô kho bị khoá kỹ thuật, không thể cho thuê.</summary>
    private static readonly string[] BlockedUnitStatuses = ["MAINTENANCE", "OUT_OF_SERVICE", "INSPECTION"];

    /// <summary>Thông tin một chu kỳ giữ ô kho của hợp đồng.</summary>
    /// <param name="ContractId">ID hợp đồng thuê đang giữ ô.</param>
    /// <param name="StartDate">Ngày bắt đầu hiệu lực.</param>
    /// <param name="EndDate">Ngày kết thúc hiệu lực (đã tính thời gian gia hạn đang chờ nếu có).</param>
    /// <param name="Status">Trạng thái hợp đồng giữ ô.</param>
    public sealed record Hold(long ContractId, DateOnly StartDate, DateOnly EndDate, string Status);

    /// <summary>Đại diện cho một ô kho kèm theo toàn bộ lịch trình các hợp đồng đang giữ ô.</summary>
    /// <param name="Unit">Đối tượng ô kho lưu trữ.</param>
    /// <param name="Holds">Danh sách các khoảng thời gian bị chiếm dụng.</param>
    public sealed record UnitSlot(StorageUnit Unit, IReadOnlyList<Hold> Holds)
    {
        /// <summary>Không có hợp đồng giữ ô, ô ở trạng thái AVAILABLE — "trống thật" (ưu tiên khi tự gán).</summary>
        public bool FreeNow => Holds.Count == 0 && Unit.Status == "AVAILABLE";
    }

    /// <summary>
    /// Lấy số ngày đệm áp dụng cho cơ sở và loại kho tại ngày chỉ định theo chính sách RELET_BUFFER (D41).
    /// </summary>
    /// <param name="db">DbContext truy vấn.</param>
    /// <param name="facilityId">ID cơ sở.</param>
    /// <param name="unitTypeId">ID loại kho.</param>
    /// <param name="onDate">Ngày kiểm tra hiệu lực chính sách.</param>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <returns>Số ngày đệm (0 đến 60 ngày), mặc định 3 ngày.</returns>
    public static async Task<int> BufferDaysAsync(AppDbContext db, long facilityId, long unitTypeId, DateOnly onDate, CancellationToken ct)
    {
        var policy = await OpsRules.FindApplicablePolicyAsync(db, BufferPolicyType, facilityId, unitTypeId, onDate, ct);
        return policy?.Value is decimal v && v >= 0 && v <= 60 ? (int)Math.Round(v) : DefaultBufferDays;
    }

    /// <summary>
    /// Lấy danh sách ô kho của một loại tại cơ sở kèm các hợp đồng đang giữ ô (đã tính gia hạn đang chờ).
    /// </summary>
    /// <param name="db">DbContext truy vấn.</param>
    /// <param name="facilityId">ID cơ sở lưu trữ.</param>
    /// <param name="unitTypeId">ID loại kho (hoặc null nếu lấy toàn bộ cơ sở).</param>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <param name="excludeContractId">ID hợp đồng cần loại trừ khỏi tính toán (ví dụ khi đang kiểm tra chính hợp đồng đó).</param>
    /// <returns>Danh sách các UnitSlot tương ứng.</returns>
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
    /// Kiểm tra ô kho có đặt được cho kỳ [start, end) hay không:
    /// Mọi hợp đồng giữ ô hoặc kết thúc + đệm ≤ start, hoặc bắt đầu ≥ end + đệm.
    /// Hợp đồng quá hạn (OVERDUE) hoặc khách đã trả nhưng chưa có ngày trống (RETURN_PENDING quá hạn) chặn mọi kỳ chồng sau đó.
    /// </summary>
    /// <param name="slot">Thông tin ô kho và lịch giữ ô.</param>
    /// <param name="start">Ngày bắt đầu dự kiến thuê.</param>
    /// <param name="end">Ngày kết thúc dự kiến thuê.</param>
    /// <param name="bufferDays">Số ngày đệm cần duy trì giữa hai lượt thuê.</param>
    /// <param name="today">Ngày hiện tại theo giờ địa phương.</param>
    /// <returns>True nếu ô kho khả dụng trong toàn bộ khoảng thời gian, ngược lại False.</returns>
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

    /// <summary>
    /// Ngày dự kiến hết hạn của hợp đồng đang thuê/giữ ô ở hiện tại (nếu có).
    /// </summary>
    public static DateOnly? CurrentContractEndDate(UnitSlot slot, DateOnly today)
    {
        if (slot.Holds.Count == 0) return null;
        var current = slot.Holds
            .Where(h => h.StartDate <= today)
            .OrderByDescending(h => h.EndDate)
            .FirstOrDefault();
        if (current != null) return current.EndDate;
        return slot.Unit.Status != "AVAILABLE" ? slot.Holds[0].EndDate : null;
    }

    /// <summary>
    /// Lý do ô kho không khả dụng cho kỳ [start, end) (null nếu khả dụng).
    /// </summary>
    public static string? UnavailableReason(UnitSlot slot, DateOnly start, DateOnly end, int bufferDays, DateOnly today)
    {
        if (Bookable(slot, start, end, bufferDays, today)) return null;
        if (slot.Holds.Any(h => h.Status == "OVERDUE")) return "Ô đang quá hạn trả, chưa nhận đặt trước.";
        if (slot.Holds.Count == 0 && slot.Unit.Status == "RESERVED") return "Ô đang được giữ cho đề xuất đổi kho.";
        if (slot.Holds.Count == 0 && BlockedUnitStatuses.Contains(slot.Unit.Status))
            return "Ô đang bảo trì / kiểm tra kỹ thuật trong thời gian này.";

        var endWithBuffer = end.AddDays(bufferDays);
        var conflict = slot.Holds.FirstOrDefault(h =>
        {
            var endsAt = h.EndDate < today && h.Status == "RETURN_PENDING" ? today : h.EndDate;
            var freeFrom = endsAt.AddDays(bufferDays);
            return !(freeFrom <= start || h.StartDate >= endWithBuffer);
        });
        return conflict != null
            ? $"Ô đã có hợp đồng/lịch giữ chỗ trùng kỳ chọn ({conflict.StartDate:dd/MM/yyyy} – {conflict.EndDate:dd/MM/yyyy})."
            : "Ô không khả dụng trong khoảng ngày đã chọn.";
    }

    /// <summary>
    /// Xác định ngày ô trống sớm nhất sau hợp đồng hiện tại (cộng ngày đệm) để hiển thị trên sơ đồ.
    /// Không nhảy vượt qua khoảng trống hợp lệ giữa hợp đồng hiện tại và hợp đồng tương lai (năm sau).
    /// </summary>
    /// <param name="slot">Thông tin ô kho.</param>
    /// <param name="bufferDays">Số ngày đệm.</param>
    /// <param name="today">Ngày hôm nay theo giờ địa phương.</param>
    /// <returns>Ngày bắt đầu trống (null nếu đang hoàn toàn trống hoặc không xác định được do quá hạn).</returns>
    public static DateOnly? FreeFrom(UnitSlot slot, int bufferDays, DateOnly today)
    {
        if (slot.FreeNow) return null;
        if (slot.Holds.Any(h => h.Status == "OVERDUE")) return null;
        if (slot.Holds.Count == 0)
            return BlockedUnitStatuses.Contains(slot.Unit.Status) ? today.AddDays(bufferDays) : null;

        var candidate = today;
        foreach (var h in slot.Holds.OrderBy(x => x.StartDate))
        {
            var endsAt = h.EndDate < today && h.Status == "RETURN_PENDING" ? today : (h.EndDate < today ? today : h.EndDate);
            var afterHold = endsAt.AddDays(bufferDays);
            if (h.StartDate <= candidate)
            {
                if (afterHold > candidate) candidate = afterHold;
            }
            else
            {
                break;
            }
        }
        return candidate;
    }

    /// <summary>
    /// Lựa chọn ô kho tối ưu cho đơn đặt chỗ mới:
    /// Ưu tiên ô trống thật (FreeNow); chỉ dùng ô sắp hết hạn khi hết ô trống (D41); ô trống sớm hơn xếp trước.
    /// </summary>
    /// <param name="slots">Danh sách các ô kho khả thi.</param>
    /// <param name="start">Ngày bắt đầu thuê.</param>
    /// <param name="end">Ngày kết thúc thuê.</param>
    /// <param name="bufferDays">Số ngày đệm.</param>
    /// <param name="today">Ngày hôm nay.</param>
    /// <returns>UnitSlot được lựa chọn, hoặc null nếu không có ô nào phù hợp.</returns>
    public static UnitSlot? Pick(IEnumerable<UnitSlot> slots, DateOnly start, DateOnly end, int bufferDays, DateOnly today) =>
        slots.Where(s => Bookable(s, start, end, bufferDays, today))
            .OrderBy(s => s.FreeNow ? 0 : 1)
            .ThenBy(s => FreeFrom(s, bufferDays, today) ?? DateOnly.MinValue)
            .ThenBy(s => s.Unit.UnitNumber).ThenBy(s => s.Unit.UnitId)
            .FirstOrDefault();

    /// <summary>
    /// Đếm số lượng ô kho có thể đặt được sau khi trừ đi các đơn đặt chỗ chưa gán ô đang giữ chỗ cùng kỳ.
    /// </summary>
    /// <param name="db">DbContext kết nối cơ sở dữ liệu.</param>
    /// <param name="facilityId">ID cơ sở.</param>
    /// <param name="unitTypeId">ID loại kho.</param>
    /// <param name="start">Ngày bắt đầu.</param>
    /// <param name="end">Ngày kết thúc.</param>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <returns>Số lượng ô khả dụng còn lại (tối thiểu 0).</returns>
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

    /// <summary>
    /// D41: Kiểm tra xem có hợp đồng mới nào đặt cùng ô bắt đầu từ ngày hết hạn của hợp đồng này trở đi hay không.
    /// Dùng để khoá gia hạn khi đã có khách khác đặt trước.
    /// </summary>
    /// <param name="db">DbContext truy vấn.</param>
    /// <param name="contract">Hợp đồng hiện tại đang xem xét gia hạn.</param>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <returns>Ngày bắt đầu của hợp đồng tiếp theo, hoặc null nếu không có ai đặt trước.</returns>
    public static async Task<DateOnly?> NextBookingAsync(AppDbContext db, RentalContract contract, CancellationToken ct) =>
        await db.RentalContracts.AsNoTracking()
            .Where(c => c.UnitId == contract.UnitId && c.ContractId != contract.ContractId && HoldingStatuses.Contains(c.Status)
                        && c.StartDate > contract.StartDate)
            .OrderBy(c => c.StartDate)
            .Select(c => (DateOnly?)c.StartDate)
            .FirstOrDefaultAsync(ct);
}
