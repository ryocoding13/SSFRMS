using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Tiến trình phân bổ ô kho thủ công bởi Quản lý cơ sở (M05 / F03 / D41).
/// Được gọi khi Quản lý cơ sở duyệt và gán ô kho cụ thể cho đơn đặt chỗ đã thanh toán hoặc đơn chờ thanh toán tại quầy.
/// Kiểm tra nghiêm ngặt tính khả dụng của ô kho theo ngày, loại kho, và ngăn ngừa phân bổ trùng lặp.
/// </summary>
public static class ReservationAllocation
{
    /// <summary>
    /// Thực hiện phân bổ ô kho cụ thể cho đơn đặt chỗ, cập nhật phân công ô và kích hoạt cấp hợp đồng.
    /// </summary>
    /// <param name="db">EF Core database context của hệ thống.</param>
    /// <param name="actor">ID của Quản lý cơ sở thực hiện thao tác phân bổ.</param>
    /// <param name="facilityId">ID của cơ sở phụ trách (đảm bảo quyền theo đúng cơ sở).</param>
    /// <param name="reservationId">ID đơn đặt chỗ cần phân bổ ô.</param>
    /// <param name="unitCode">Mã ô kho được chọn phân bổ (ví dụ: K01, K02...).</param>
    /// <param name="ct">Token hủy bất đồng bộ.</param>
    /// <exception cref="InvalidOperationException">Ném ra khi đơn không hợp lệ, ô kho không phù hợp, đã có phân bổ hoặc hết chỗ.</exception>
    public static async Task AllocateAsync(AppDbContext db, long actor, long facilityId, long reservationId,
        string unitCode, CancellationToken ct)
    {
        // Mở transaction và khóa đơn đặt chỗ + kho hàng của cơ sở
        await using var tx = await CheckoutTransaction.BeginAsync(db, $"reservation:{reservationId}", ct);
        await CheckoutTransaction.LockAsync(db, $"inventory:{facilityId}", ct);
        var r = await db.Reservations.Include(r => r.UnitAssignments).Include(r => r.RentalContract)
            .SingleOrDefaultAsync(r => r.ReservationId == reservationId && r.FacilityId == facilityId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn tại cơ sở của bạn.");
        var atFacility = r.Status == "PENDING_AT_FACILITY" && r.PaymentMethod == "AT_FACILITY";
        if (!atFacility && (r.Status is not ("CONFIRMED" or "UNIT_ASSIGNED")))
            throw new InvalidOperationException("Chỉ phân bổ đơn đã thanh toán hoặc đơn chờ thu tại kho.");
        if (atFacility && r.ExpiresAt <= DateTime.UtcNow) throw new InvalidOperationException("Đơn chờ thu đã hết hạn giữ chỗ.");
        if (!atFacility) await ReservationSettlement.RequirePaidAsync(db, r, ct);
        var unit = await db.StorageUnits.SingleOrDefaultAsync(u => u.FacilityId == facilityId && u.UnitNumber == unitCode, ct)
            ?? throw new InvalidOperationException("Không tìm thấy ô kho tại cơ sở.");
        if (unit.UnitTypeId != r.UnitTypeId) throw new InvalidOperationException("Ô kho không đúng loại khách đã đặt.");
        var current = r.UnitAssignments.SingleOrDefault(a => a.Status == "ACTIVE");
        if (current != null)
        {
            if (current.UnitId != unit.UnitId) throw new InvalidOperationException("Đơn đã phân bổ ô khác, không được phân bổ thêm.");
            if (!atFacility) await ContractProvisioning.EnsureAsync(db, r, actor, ct);
            await tx.CommitAsync(ct);
            return;
        }
        // D41: Ô trống tính theo ngày (ô đang thuê trống từ ngày hết hạn + ngày đệm RELET_BUFFER); không phân bổ ô đang quá hạn.
        var today = OpsRules.TodayLocal;
        var buffer = await UnitAvailability.BufferDaysAsync(db, facilityId, r.UnitTypeId, today, ct);
        var slot = (await UnitAvailability.SlotsAsync(db, facilityId, r.UnitTypeId, ct)).FirstOrDefault(s => s.Unit.UnitId == unit.UnitId);
        if (slot == null || !UnitAvailability.Bookable(slot, r.StartDate, r.ExpectedEndDate, buffer, today))
            throw new InvalidOperationException("Ô kho không còn trống trong kỳ thuê.");
        var contract = r.RentalContract;
        if (contract != null) throw new InvalidOperationException("Đơn đã có hợp đồng, cần kiểm tra phân bổ cũ.");
        var now = DateTime.UtcNow;
        contract = new RentalContract { ReservationId = r.ReservationId, CustomerId = r.CustomerId,
            UnitId = unit.UnitId, StartDate = r.StartDate, EndDate = r.ExpectedEndDate,
            AgreedMonthlyRate = r.QuotedMonthlyRate, DepositAmount = r.RequiredDeposit, Status = "DRAFT", CreatedAt = now };
        // D36 (Phiên 3): Phân bổ ô không tự tạo lịch nhận chìa khóa; lịch chỉ tạo khi khách gửi yêu cầu "Nhận chìa khóa".
        db.RentalContracts.Add(contract);
        foreach (var payment in await db.Payments.Where(p => p.ReservationId == r.ReservationId).ToListAsync(ct))
            payment.Contract = contract;
        db.UnitAssignments.Add(new UnitAssignment { ReservationId = r.ReservationId, UnitId = unit.UnitId,
            AssignedBy = actor, AssignedAt = now, Status = "ACTIVE", Reason = "Quản lý phân bổ ô" });
        if (unit.Status == "AVAILABLE") // Ô khách cũ còn giữ thì giữ nguyên trạng thái tới ngày bắt đầu (D41)
        {
            db.UnitStatusHistories.Add(new UnitStatusHistory { UnitId = unit.UnitId, ChangedBy = actor,
                OldStatus = unit.Status, NewStatus = "RESERVED", ChangedAt = now, Reason = $"Phân bổ đơn {r.ReservationId}" });
            unit.Status = "RESERVED";
            unit.UpdatedAt = now;
        }
        if (!atFacility) r.Status = "UNIT_ASSIGNED";
        ReservationSettlement.Audit(db, actor, "UNIT_ALLOCATED", r.ReservationId, new { unit.UnitNumber });
        await db.SaveChangesAsync(ct);
        if (!atFacility) await ContractProvisioning.EnsureAsync(db, r, actor, ct);
        await tx.CommitAsync(ct);
    }
}
