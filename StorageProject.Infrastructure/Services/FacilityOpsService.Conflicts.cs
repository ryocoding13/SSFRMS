using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Phiên 4 · D41 — Quản lý đặt trước ô sắp hết hạn và giải quyết xung đột khi khách cũ chưa trả kho hoặc chưa kiểm tra đạt (D38).
/// Mốc 5 ngày trước ngày nhận kho (giờ Việt Nam): nếu ô chưa về Trống thì hệ thống tạo đề xuất đổi kho:
/// 1. Đổi ngang cùng loại (SWAP)
/// 2. Nâng cấp miễn phí lên ô lớn hơn (UPGRADE - giữ nguyên đơn giá và cọc cũ)
/// 3. Không còn ô khả dụng (NONE): cho phép khách dời ngày nhận kho hoặc huỷ đơn hoàn 100% tiền (không trừ phí huỷ D40).
/// Ô đề xuất được giữ RESERVED trong 48 giờ; nếu quá hạn mà khách chưa chọn thì tự động chấp nhận đề xuất.
/// </summary>
public partial class FacilityOpsService
{
    /// <summary>Số ngày trước ngày nhận kho bắt đầu kiểm tra và phát hiện xung đột ô (5 ngày).</summary>
    internal const int ConflictCheckDays = 5;
    /// <summary>Thời gian giữ ô đề xuất cho khách hàng lựa chọn: 48 giờ.</summary>
    internal static readonly TimeSpan ConflictHold = TimeSpan.FromHours(48);

    private static class ConflictAction
    {
        public const string Proposed = "UNIT_CONFLICT_PROPOSED";
        public const string Resolved = "UNIT_CONFLICT_RESOLVED";
    }

    /// <summary>Các trạng thái của khách cũ cho thấy ô kho vẫn chưa sẵn sàng bàn giao.</summary>
    private static readonly string[] OldTenantStatuses = ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];
    /// <summary>Các trạng thái kỹ thuật của ô kho chưa sẵn sàng cho khách mới.</summary>
    private static readonly string[] NotReadyUnitStatuses = ["INSPECTION", "MAINTENANCE", "OUT_OF_SERVICE"];

    /// <summary>Bản ghi thể hiện trạng thái giải quyết xung đột hiện tại của một hợp đồng.</summary>
    private sealed record ConflictState(ActivityLog Proposal, ActivityLog? Resolution)
    {
        public bool Open => Resolution == null;
        public long? ProposedUnitId => long.TryParse(Read(Proposal, "proposedUnitId"), out var id) ? id : null;
        public string Option => Read(Proposal, "option") ?? "NONE";
        public DateTime? ExpiresAt => DateTime.TryParse(Read(Proposal, "expiresAt"), Invariant,
            System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var t) ? t : null;
    }

    /// <summary>Lấy trạng thái xung đột mới nhất của hợp đồng từ danh sách nhật ký ActivityLog.</summary>
    private static ConflictState? LatestConflict(IEnumerable<ActivityLog> logs, long contractId)
    {
        var list = logs.Where(l => l.EntityId == contractId && l.EntityType == LogEntity.Contract).OrderBy(l => l.LoggedAt).ToList();
        var proposal = list.LastOrDefault(l => l.Action == ConflictAction.Proposed);
        if (proposal == null) return null;
        var resolution = list.LastOrDefault(l => l.Action == ConflictAction.Resolved && l.LoggedAt >= proposal.LoggedAt);
        return new ConflictState(proposal, resolution);
    }

    /// <summary>Tải danh sách ActivityLog liên quan đến xung đột ô kho của các hợp đồng.</summary>
    private async Task<List<ActivityLog>> ConflictLogsAsync(ICollection<long> contractIds, CancellationToken ct) =>
        contractIds.Count == 0 ? [] : await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == LogEntity.Contract && l.EntityId != null && contractIds.Contains(l.EntityId.Value)
                        && (l.Action == ConflictAction.Proposed || l.Action == ConflictAction.Resolved))
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);

    /// <summary>Kiểm tra lý do ô chưa sẵn sàng cho khách mới (null = ô đã hoàn toàn sẵn sàng).</summary>
    private async Task<(string Reason, long? BlockingContractId)?> NotReadyAsync(RentalContract c, CancellationToken ct)
    {
        var old = await dbContext.RentalContracts.AsNoTracking()
            .Where(o => o.UnitId == c.UnitId && o.ContractId != c.ContractId && OldTenantStatuses.Contains(o.Status) && o.StartDate < c.StartDate)
            .OrderBy(o => o.StartDate)
            .Select(o => new { o.ContractId, o.Status })
            .FirstOrDefaultAsync(ct);
        if (old != null)
        {
            return (old.Status == "RETURN_PENDING" ? "Khách trước đã trả kho nhưng chưa kiểm tra đạt" : "Khách trước chưa trả kho", old.ContractId);
        }
        return NotReadyUnitStatuses.Contains(c.Unit.Status) ? ("Ô đang kiểm tra / bảo trì sau khi khách trước trả", null) : null;
    }

    /// <summary>
    /// D41 · Tiến trình nền: Quét các hợp đồng sắp nhận kho (trong vòng 5 ngày tới) mà ô kho chưa về AVAILABLE
    /// để tự động khởi tạo đề xuất đổi ô và khoá ô đề xuất trong 48 giờ.
    /// </summary>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <returns>Số lượng đề xuất đổi kho mới được tạo.</returns>
    public async Task<int> DetectUnitConflictsAsync(CancellationToken ct = default)
    {
        var today = VnToday;
        var until = today.AddDays(ConflictCheckDays);
        var ids = await dbContext.RentalContracts.AsNoTracking()
            .Where(c => (c.Status == "ACTIVE" || c.Status == "EXPIRING") && c.StartDate > today && c.StartDate <= until)
            .Select(c => c.ContractId)
            .ToListAsync(ct);
        var logs = await ConflictLogsAsync(ids, ct);
        var created = 0;
        foreach (var id in ids.Where(id => LatestConflict(logs, id) is not { Open: true }))
        {
            try
            {
                if (await ProposeForContractAsync(id, ct)) created++;
            }
            finally
            {
                dbContext.ChangeTracker.Clear();
            }
        }
        return created;
    }

    /// <summary>Khởi tạo đề xuất đổi kho cho một hợp đồng cụ thể bị xung đột.</summary>
    private async Task<bool> ProposeForContractAsync(long contractId, CancellationToken ct)
    {
        var facilityId = await dbContext.RentalContracts.Where(c => c.ContractId == contractId).Select(c => c.Unit.FacilityId).FirstAsync(ct);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"unit-conflict:{contractId}", ct);
        await CheckoutTransaction.LockAsync(dbContext, $"inventory:{facilityId}", ct);
        var c = await dbContext.RentalContracts.Include(x => x.Unit).ThenInclude(u => u.UnitType).Include(x => x.Customer)
            .FirstAsync(x => x.ContractId == contractId, ct);
        if (LatestConflict(await ConflictLogsAsync([contractId], ct), contractId) is { Open: true }) return false;
        var notReady = await NotReadyAsync(c, ct);
        if (notReady == null) return false;

        var today = VnToday;
        var (option, target) = await AlternativeAsync(c, today, ct);
        var now = NowUtc;
        if (target != null) SetUnitStatus(target.Unit, "RESERVED", c.CustomerId, $"Giữ ô đề xuất đổi kho 48 giờ · {ContractCode(c)}");
        Log(null, ConflictAction.Proposed, LogEntity.Contract, c.ContractId, new
        {
            oldUnitId = c.UnitId, oldUnit = c.Unit.UnitNumber, proposedUnitId = target?.Unit.UnitId, proposedUnit = target?.Unit.UnitNumber,
            proposedType = target?.Unit.UnitType.TypeName, proposedArea = target?.Unit.UnitType.Area, option,
            reason = notReady.Value.Reason, blockingContractId = notReady.Value.BlockingContractId,
            expiresAt = target != null ? (now + ConflictHold).ToString("o", Invariant) : null, system = true
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return true;
    }

    /// <summary>
    /// Tìm phương án thay thế: ưu tiên đổi ngang cùng loại đang trống thật; không có thì nâng cấp loại lớn hơn; không có → NONE.
    /// </summary>
    private async Task<(string Option, UnitAvailability.UnitSlot? Target)> AlternativeAsync(RentalContract c, DateOnly today, CancellationToken ct)
    {
        var facilityId = c.Unit.FacilityId;
        var buffer = await UnitAvailability.BufferDaysAsync(dbContext, facilityId, c.Unit.UnitTypeId, today, ct);
        bool Fits(UnitAvailability.UnitSlot s) => s.Unit.UnitId != c.UnitId && s.FreeNow
                                                  && UnitAvailability.Bookable(s, c.StartDate, c.EndDate, buffer, today);
        var same = (await UnitAvailability.SlotsAsync(dbContext, facilityId, c.Unit.UnitTypeId, ct, c.ContractId)).FirstOrDefault(Fits);
        if (same != null) return ("SWAP", same);
        var larger = (await UnitAvailability.SlotsAsync(dbContext, facilityId, null, ct, c.ContractId))
            .Where(s => s.Unit.UnitType.Area > c.Unit.UnitType.Area && Fits(s))
            .OrderBy(s => s.Unit.UnitType.ClimateControlled == c.Unit.UnitType.ClimateControlled ? 0 : 1)
            .ThenBy(s => s.Unit.UnitType.Area).ThenBy(s => s.Unit.UnitNumber)
            .FirstOrDefault();
        return larger != null ? ("UPGRADE", larger) : ("NONE", null);
    }

    /// <summary>
    /// Chuyển hợp đồng (chưa bắt đầu) sang ô mới: phân bổ lại, mã QR/PIN ô cũ hết hiệu lực, cấp mã mới. Giữ giá và cọc (nâng cấp miễn phí).
    /// </summary>
    private async Task MoveContractUnitAsync(RentalContract c, StorageUnit target, long recordedBy, string reason, CancellationToken ct)
    {
        var now = NowUtc;
        var oldUnit = c.Unit;
        await ReleaseUnitIfFreeAsync(oldUnit, c.ContractId, recordedBy, $"Khách mới chuyển sang ô {target.UnitNumber} · {ContractCode(c)}", ct);
        SetUnitStatus(target, c.StartDate > VnToday ? "RESERVED" : "OCCUPIED", recordedBy, $"{reason} · {ContractCode(c)}");
        c.UnitId = target.UnitId;
        c.Unit = target;
        foreach (var a in await dbContext.UnitAssignments.Where(a => a.ReservationId == c.ReservationId && a.Status == "ACTIVE").ToListAsync(ct))
        {
            a.Status = "REPLACED";
        }
        dbContext.UnitAssignments.Add(new UnitAssignment
        {
            ReservationId = c.ReservationId, UnitId = target.UnitId, AssignedBy = recordedBy, AssignedAt = now, Status = "ACTIVE",
            Reason = Clip(reason, 255)
        });
        var credentials = await dbContext.AccessCredentials.Where(a => a.ContractId == c.ContractId && a.Status == "ACTIVE").ToListAsync(ct);
        var hadKey = false;
        foreach (var cred in credentials)
        {
            hadKey |= cred.CredentialType == "KEY";
            cred.Status = "REPLACED"; // D41: mã ô cũ không có hiệu lực với khách mới
            cred.ReturnedAt = now;
        }
        foreach (var kind in new[] { "QR", "PIN" })
        {
            dbContext.AccessCredentials.Add(new AccessCredential
            {
                ContractId = c.ContractId, UnitId = target.UnitId, IssuedBy = recordedBy, CredentialType = "ACCESS_CODE",
                CredentialReference = $"{kind}-{Guid.NewGuid():N}", IssuedAt = now, Status = "ACTIVE"
            });
        }
        var handover = await dbContext.HandoverRecords.FirstOrDefaultAsync(h => h.ContractId == c.ContractId, ct);
        if (hadKey && handover is { Status: "HANDED_OVER" })
        {
            handover.Status = "VERIFIED"; // nhận chìa khóa ô mới tại quầy
            handover.HandoverAt = null;
            handover.StaffConfirmed = false;
            handover.CustomerConfirmed = false;
        }
    }

    /// <summary>Ô đang giữ cho hợp đồng này (RESERVED) mà không còn ai giữ → chuyển về AVAILABLE. Ô khách cũ đang dùng giữ nguyên.</summary>
    private async Task ReleaseUnitIfFreeAsync(StorageUnit unit, long contractId, long recordedBy, string reason, CancellationToken ct)
    {
        if (unit.Status != "RESERVED") return;
        var held = await dbContext.RentalContracts.AnyAsync(o => o.UnitId == unit.UnitId && o.ContractId != contractId
                                                                 && UnitAvailability.HoldingStatuses.Contains(o.Status), ct);
        if (!held) SetUnitStatus(unit, "AVAILABLE", recordedBy, reason);
    }

    /// <summary>Lấy thực thể StorageUnit của ô được đề xuất từ ConflictState.</summary>
    private async Task<StorageUnit?> ProposedUnitAsync(ConflictState state, CancellationToken ct) =>
        state.ProposedUnitId is long id ? await dbContext.StorageUnits.FirstOrDefaultAsync(u => u.UnitId == id, ct) : null;

    /// <summary>
    /// D41 · Tiến trình nền: Quét các đề xuất đổi kho đã quá 48 giờ mà khách chưa phản hồi để tự động xác nhận nhận ô (đổi ngang / nâng cấp).
    /// </summary>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <returns>Số lượng đề xuất đã tự động xử lý.</returns>
    public async Task<int> ExpireUnitConflictsAsync(CancellationToken ct = default)
    {
        var now = NowUtc;
        var ids = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == LogEntity.Contract && l.Action == ConflictAction.Proposed && l.EntityId != null
                        && l.LoggedAt <= now - ConflictHold)
            .Select(l => l.EntityId!.Value).Distinct().ToListAsync(ct);
        var applied = 0;
        foreach (var id in ids)
        {
            try
            {
                var facilityId = await dbContext.RentalContracts.Where(c => c.ContractId == id).Select(c => c.Unit.FacilityId).FirstAsync(ct);
                await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"unit-conflict:{id}", ct);
                await CheckoutTransaction.LockAsync(dbContext, $"inventory:{facilityId}", ct);
                var state = LatestConflict(await ConflictLogsAsync([id], ct), id);
                if (state is not { Open: true } || state.Option == "NONE" || state.ExpiresAt > now) continue;
                var c = await dbContext.RentalContracts.Include(x => x.Unit).FirstAsync(x => x.ContractId == id, ct);
                if (c.Status is not ("ACTIVE" or "EXPIRING")) continue;
                var target = await ProposedUnitAsync(state, ct);
                if (target == null) continue;
                await MoveContractUnitAsync(c, target, c.CustomerId, state.Option == "UPGRADE" ? "Nâng cấp miễn phí (tự động sau 48 giờ)" : "Đổi ngang (tự động sau 48 giờ)", ct);
                Log(null, ConflictAction.Resolved, LogEntity.Contract, c.ContractId, new
                {
                    resolution = state.Option == "UPGRADE" ? "AUTO_UPGRADE" : "AUTO_SWAP", newUnit = target.UnitNumber, system = true
                });
                await dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                applied++;
            }
            finally
            {
                dbContext.ChangeTracker.Clear();
            }
        }
        return applied;
    }

    // ---------------------------------------------------------------------------------------------
    // Khách xem và chọn phương án
    // ---------------------------------------------------------------------------------------------

    /// <summary>Lấy danh sách các đề xuất đổi kho của khách hàng.</summary>
    public async Task<IReadOnlyList<UnitConflictDto>> GetCustomerUnitConflictsAsync(long customerId, CancellationToken ct = default)
    {
        var contracts = await dbContext.RentalContracts.AsNoTracking().Where(c => c.CustomerId == customerId).Select(c => c.ContractId).ToListAsync(ct);
        return await ConflictDtosAsync(contracts, ct);
    }

    /// <summary>Lấy danh sách các đề xuất đổi kho thuộc cơ sở đang phụ trách dành cho nhân viên/quản lý.</summary>
    public async Task<IReadOnlyList<UnitConflictDto>> GetUnitConflictsAsync(OpsActor actor, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var since = NowUtc.AddDays(-30);
        var ids = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == LogEntity.Contract && l.Action == ConflictAction.Proposed && l.EntityId != null)
            .Select(l => l.EntityId!.Value).Distinct().ToListAsync(ct);
        var inFacility = await dbContext.RentalContracts.AsNoTracking()
            .Where(c => ids.Contains(c.ContractId) && (c.Unit.FacilityId == facility.FacilityId
                        || dbContext.UnitAssignments.Any(a => a.ReservationId == c.ReservationId && a.Unit.FacilityId == facility.FacilityId)))
            .Select(c => c.ContractId).ToListAsync(ct);
        var list = await ConflictDtosAsync(inFacility, ct);
        return list.Where(d => d.Status == "OPEN" || string.CompareOrdinal(d.ResolvedAt ?? "", Local(since)!) >= 0).ToList();
    }

    /// <summary>Chuyển đổi danh sách hợp đồng thành DTO UnitConflictDto hoàn chỉnh.</summary>
    private async Task<IReadOnlyList<UnitConflictDto>> ConflictDtosAsync(ICollection<long> contractIds, CancellationToken ct)
    {
        var logs = await ConflictLogsAsync(contractIds, ct);
        var ids = contractIds.Where(id => LatestConflict(logs, id) != null).ToList();
        if (ids.Count == 0) return [];
        var contracts = await dbContext.RentalContracts.AsNoTracking().Include(c => c.Customer).Include(c => c.Unit)
            .Where(c => ids.Contains(c.ContractId)).ToListAsync(ct);
        var today = VnToday;
        var result = new List<UnitConflictDto>();
        foreach (var c in contracts.OrderBy(c => c.StartDate))
        {
            var st = LatestConflict(logs, c.ContractId)!;
            string? earliest = null;
            if (st.Open && st.Option == "NONE")
            {
                earliest = (await EarliestFreeDateAsync(c, today, ct))?.ToString("yyyy-MM-dd");
            }
            long? blocking = long.TryParse(Read(st.Proposal, "blockingContractId"), out var b) ? b : null;
            decimal? area = decimal.TryParse(Read(st.Proposal, "proposedArea"), System.Globalization.NumberStyles.Number, Invariant, out var ar) ? ar : null;
            result.Add(new UnitConflictDto(
                $"XD-{st.Proposal.LogId:0000}", ContractCode(c), c.Customer.FullName, c.Customer.Phone,
                c.StartDate.ToString("yyyy-MM-dd"), c.EndDate.ToString("yyyy-MM-dd"),
                Read(st.Proposal, "oldUnit") ?? c.Unit.UnitNumber, Text(st.Proposal, "proposedUnit"), Text(st.Proposal, "proposedType"), area,
                st.Option, Read(st.Proposal, "reason") ?? "", blocking.HasValue ? $"HĐ-{blocking.Value:0000}" : null,
                Local(st.Proposal.LoggedAt)!, st.ExpiresAt.HasValue ? Local(st.ExpiresAt) : null,
                st.Open ? "OPEN" : "RESOLVED", st.Resolution != null ? Read(st.Resolution, "resolution") : null, Local(st.Resolution?.LoggedAt),
                st.Resolution != null ? Text(st.Resolution, "newUnit") : null, st.Resolution != null ? Text(st.Resolution, "newStartDate") : null,
                earliest));
        }
        return result;
    }

    /// <summary>Tính ngày sớm nhất có ô cùng loại đặt được cho chu kỳ thuê tương đương (dành cho phương án dời ngày).</summary>
    private async Task<DateOnly?> EarliestFreeDateAsync(RentalContract c, DateOnly today, CancellationToken ct)
    {
        var buffer = await UnitAvailability.BufferDaysAsync(dbContext, c.Unit.FacilityId, c.Unit.UnitTypeId, today, ct);
        var slots = await UnitAvailability.SlotsAsync(dbContext, c.Unit.FacilityId, c.Unit.UnitTypeId, ct, c.ContractId);
        var months = MonthsBetween(c.StartDate, c.EndDate);
        for (var d = c.StartDate.AddDays(1); d <= c.StartDate.AddDays(90); d = d.AddDays(1))
        {
            if (slots.Any(s => UnitAvailability.Bookable(s, d, d.AddMonths(months), buffer, today))) return d;
        }
        return null;
    }

    /// <summary>Tính số tháng tròn giữa hai mốc ngày.</summary>
    private static int MonthsBetween(DateOnly start, DateOnly end)
    {
        var months = (end.Year - start.Year) * 12 + end.Month - start.Month;
        return Math.Max(1, months);
    }

    /// <summary>
    /// D41: Khách hàng lựa chọn phương án giải quyết xung đột:
    /// - ACCEPT: Nhận ô đề xuất (đổi ngang hoặc nâng cấp miễn phí).
    /// - RESCHEDULE: Dời ngày nhận kho sang thời điểm ô khả dụng.
    /// - CANCEL: Huỷ đơn, hoàn trả 100% tiền thuê và cọc đã thanh toán (không áp dụng phí huỷ 5%).
    /// </summary>
    public async Task<UnitConflictDto> ChooseUnitConflictAsync(long customerId, string contractCode, UnitConflictChoiceRequest request,
        CancellationToken ct = default)
    {
        var choice = (request.Choice ?? string.Empty).Trim().ToUpperInvariant();
        if (choice is not ("ACCEPT" or "RESCHEDULE" or "CANCEL")) throw new ArgumentException("Chọn một phương án đổi kho.");
        var contractId = CustomerContractId(contractCode);
        var facilityId = await dbContext.RentalContracts.Where(c => c.ContractId == contractId && c.CustomerId == customerId)
                             .Select(c => (long?)c.Unit.FacilityId).FirstOrDefaultAsync(ct)
                         ?? throw new KeyNotFoundException("Không tìm thấy hợp đồng của bạn.");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"unit-conflict:{contractId}", ct);
        await CheckoutTransaction.LockAsync(dbContext, $"inventory:{facilityId}", ct);
        var state = LatestConflict(await ConflictLogsAsync([contractId], ct), contractId);
        if (state is not { Open: true }) throw new InvalidOperationException("Không có đề xuất đổi kho đang chờ bạn trả lời.");
        var c = await dbContext.RentalContracts.Include(x => x.Unit).ThenInclude(u => u.UnitType).Include(x => x.Customer)
            .Include(x => x.Reservation).Include(x => x.Payments).Include(x => x.AccessCredentials)
            .FirstAsync(x => x.ContractId == contractId, ct);
        if (c.Status is not ("ACTIVE" or "EXPIRING") || c.StartDate <= VnToday)
        {
            throw new InvalidOperationException("Hợp đồng đã bắt đầu hoặc không còn hiệu lực, liên hệ cơ sở để được hỗ trợ.");
        }
        var proposed = await ProposedUnitAsync(state, ct);
        object resolution;
        switch (choice)
        {
            case "ACCEPT":
                if (proposed == null || state.Option == "NONE") throw new InvalidOperationException("Không có ô đề xuất để nhận. Chọn dời ngày hoặc huỷ.");
                await MoveContractUnitAsync(c, proposed, customerId, state.Option == "UPGRADE" ? "Khách nhận nâng cấp miễn phí" : "Khách nhận đổi ngang", ct);
                resolution = new { resolution = state.Option, newUnit = proposed.UnitNumber, upgrade = state.Option == "UPGRADE" };
                break;
            case "RESCHEDULE":
                resolution = await RescheduleAsync(c, request.NewStartDate, proposed, customerId, ct);
                break;
            default:
                resolution = await CancelForConflictAsync(c, request.RefundBank, proposed, customerId, ct);
                break;
        }
        Log(customerId, ConflictAction.Resolved, LogEntity.Contract, c.ContractId, resolution);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        dbContext.ChangeTracker.Clear();
        return (await ConflictDtosAsync([contractId], ct)).Single();
    }

    /// <summary>Xử lý phương án dời ngày nhận kho cho hợp đồng.</summary>
    private async Task<object> RescheduleAsync(RentalContract c, DateOnly? newStart, StorageUnit? proposed, long customerId, CancellationToken ct)
    {
        var today = VnToday;
        if (newStart is not DateOnly start || start <= c.StartDate) throw new ArgumentException("Chọn ngày nhận kho mới sau ngày cũ.");
        if (start > c.StartDate.AddDays(90)) throw new ArgumentException("Chỉ dời ngày nhận kho trong 90 ngày.");
        var months = MonthsBetween(c.StartDate, c.EndDate);
        var end = start.AddMonths(months);
        var buffer = await UnitAvailability.BufferDaysAsync(dbContext, c.Unit.FacilityId, c.Unit.UnitTypeId, today, ct);
        var slots = await UnitAvailability.SlotsAsync(dbContext, c.Unit.FacilityId, c.Unit.UnitTypeId, ct, c.ContractId);
        // Giữ ô cũ nếu ô cũ trống kịp; không thì ô cùng loại đặt được cho kỳ mới (ưu tiên trống thật).
        var current = slots.FirstOrDefault(s => s.Unit.UnitId == c.UnitId);
        var pick = current != null && UnitAvailability.Bookable(current, start, end, buffer, today)
            ? current
            : UnitAvailability.Pick(slots, start, end, buffer, today);
        if (pick == null)
        {
            throw new InvalidOperationException("Chưa có ô cùng loại trống cho ngày này. Chọn ngày khác hoặc huỷ hoàn 100%.");
        }
        var oldStart = c.StartDate;
        c.StartDate = start;
        c.EndDate = end;
        c.Reservation.StartDate = start;
        c.Reservation.ExpectedEndDate = end;
        if (pick.Unit.UnitId != c.UnitId)
        {
            await MoveContractUnitAsync(c, pick.Unit, customerId, "Khách dời ngày nhận kho", ct);
        }
        if (proposed != null && proposed.UnitId != c.UnitId)
        {
            await ReleaseUnitIfFreeAsync(proposed, c.ContractId, customerId, $"Bỏ giữ ô đề xuất · {ContractCode(c)}", ct);
        }
        return new { resolution = "RESCHEDULE", oldStartDate = oldStart.ToString("yyyy-MM-dd"), newStartDate = start.ToString("yyyy-MM-dd"),
            newEndDate = end.ToString("yyyy-MM-dd"), newUnit = pick.Unit.UnitNumber };
    }

    /// <summary>D41: Không còn ô phù hợp → khách huỷ, hoàn 100% tiền thuê + cọc đã trả, không áp phí huỷ 5% (D40). Cách nhận hoàn theo D42/D44.</summary>
    private async Task<object> CancelForConflictAsync(RentalContract c, StorageProject.Core.DTOs.Evidence.RefundBankInput? bank,
        StorageUnit? proposed, long customerId, CancellationToken ct)
    {
        var account = RefundBank.Validate(bank, c.Customer.FullName, allowCash: true);
        var now = NowUtc;
        var r = c.Reservation;
        var paid = await dbContext.Payments
            .Where(p => (p.ReservationId == r.ReservationId || p.ContractId == c.ContractId) && p.Status == "PAID"
                        && (p.PaymentType == "RENT" || p.PaymentType == "DEPOSIT"))
            .SumAsync(p => p.Amount, ct);
        r.Status = "CANCELLED";
        r.CancelledAt = now;
        r.CancellationReason = "D41: ô chưa sẵn sàng do khách trước, khách huỷ — hoàn 100%";
        r.RefundBankName = account.BankName;
        r.RefundAccountNumber = account.AccountNumber.Length > 0 ? account.AccountNumber : null;
        r.RefundAccountHolder = account.AccountHolder;
        c.Status = "CANCELLED";
        c.TerminationReason = "Huỷ do xung đột ô (D41), hoàn 100%";
        foreach (var a in await dbContext.UnitAssignments.Where(a => a.ReservationId == r.ReservationId && a.Status == "ACTIVE").ToListAsync(ct))
        {
            a.Status = "CANCELLED";
        }
        foreach (var cred in c.AccessCredentials.Where(a => a.Status == "ACTIVE"))
        {
            cred.Status = "REVOKED";
            cred.ReturnedAt = now;
        }
        var handover = await dbContext.HandoverRecords.FirstOrDefaultAsync(h => h.ContractId == c.ContractId, ct);
        if (handover is { Status: not "HANDED_OVER" }) handover.Status = "CANCELLED";
        await ReleaseUnitIfFreeAsync(c.Unit, c.ContractId, customerId, $"Khách huỷ do xung đột ô · {ContractCode(c)}", ct);
        if (proposed != null) await ReleaseUnitIfFreeAsync(proposed, c.ContractId, customerId, $"Bỏ giữ ô đề xuất · {ContractCode(c)}", ct);
        if (paid > 0 && !await dbContext.Payments.AnyAsync(p => p.ReservationId == r.ReservationId && p.PaymentType == "REFUND", ct))
        {
            dbContext.Payments.Add(new Payment
            {
                ReservationId = r.ReservationId, ContractId = c.ContractId, PaymentType = "REFUND", Amount = paid, Currency = "VND",
                PaymentMethod = RefundBank.IsCash(account.BankName) ? CashMethod : "BANK_TRANSFER", DueDate = RefundDueDate(now),
                Status = "PENDING", CreatedAt = now, UpdatedAt = now
            });
        }
        return new { resolution = "CANCEL", refund = paid, method = RefundBank.IsCash(account.BankName) ? CashMethod : "BANK_TRANSFER" };
    }

    /// <summary>Trường chữ trong log: JSON null / rỗng → null (Read trả "" cho JSON null).</summary>
    private static string? Text(ActivityLog log, string field) => Read(log, field) is { Length: > 0 } v ? v : null;
}
