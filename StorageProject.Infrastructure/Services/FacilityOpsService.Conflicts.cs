using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Phiên 4 · D41 — đặt trước ô sắp hết hạn và xử lý khi khách cũ chưa trả kho / chưa kiểm tra đạt (D38).
/// Mốc 5 ngày trước ngày nhận kho (giờ Việt Nam): nếu ô chưa về Trống thì hệ thống tạo đề xuất đổi kho:
/// đổi ngang cùng loại → nâng cấp miễn phí (giữ giá, cọc) → không còn ô: dời ngày hoặc huỷ hoàn 100% (không phí D40).
/// Ô đề xuất được giữ RESERVED 48 giờ; quá hạn hệ thống tự nhận ô đề xuất. Trạng thái lưu trong activity_logs của hợp đồng mới.
/// </summary>
public partial class FacilityOpsService
{
    internal const int ConflictCheckDays = 5;
    internal static readonly TimeSpan ConflictHold = TimeSpan.FromHours(48);

    private static class ConflictAction
    {
        public const string Proposed = "UNIT_CONFLICT_PROPOSED";
        public const string Resolved = "UNIT_CONFLICT_RESOLVED";
    }

    private static readonly string[] OldTenantStatuses = ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];
    private static readonly string[] NotReadyUnitStatuses = ["INSPECTION", "MAINTENANCE", "OUT_OF_SERVICE"];

    private sealed record ConflictState(ActivityLog Proposal, ActivityLog? Resolution)
    {
        public bool Open => Resolution == null;
        public long? ProposedUnitId => long.TryParse(Read(Proposal, "proposedUnitId"), out var id) ? id : null;
        public string Option => Read(Proposal, "option") ?? "NONE";
        public DateTime? ExpiresAt => DateTime.TryParse(Read(Proposal, "expiresAt"), Invariant,
            System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var t) ? t : null;
    }

    private static ConflictState? LatestConflict(IEnumerable<ActivityLog> logs, long contractId)
    {
        var list = logs.Where(l => l.EntityId == contractId && l.EntityType == LogEntity.Contract).OrderBy(l => l.LoggedAt).ToList();
        var proposal = list.LastOrDefault(l => l.Action == ConflictAction.Proposed);
        if (proposal == null) return null;
        var resolution = list.LastOrDefault(l => l.Action == ConflictAction.Resolved && l.LoggedAt >= proposal.LoggedAt);
        return new ConflictState(proposal, resolution);
    }

    private async Task<List<ActivityLog>> ConflictLogsAsync(ICollection<long> contractIds, CancellationToken ct) =>
        contractIds.Count == 0 ? [] : await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == LogEntity.Contract && l.EntityId != null && contractIds.Contains(l.EntityId.Value)
                        && (l.Action == ConflictAction.Proposed || l.Action == ConflictAction.Resolved))
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);

    /// <summary>Lý do ô chưa sẵn sàng cho khách mới (null = sẵn sàng).</summary>
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
    /// D41 · Tiến trình nền: hợp đồng sắp nhận kho (còn ≤ 5 ngày, đơn tạo muộn thì kiểm ngay) mà ô chưa về Trống
    /// → tạo đề xuất đổi kho và giữ ô đề xuất 48 giờ. Mỗi hợp đồng chỉ có một đề xuất đang mở.
    /// </summary>
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

    /// <summary>Đổi ngang cùng loại đang trống thật; không có thì nâng cấp loại lớn hơn (cùng kho lạnh/thường trước); không có → NONE.</summary>
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
    /// Chuyển hợp đồng (chưa bắt đầu) sang ô mới: phân bổ, mã QR/PIN ô cũ hết hiệu lực, cấp mã mới. Giữ giá và cọc (nâng cấp miễn phí).
    /// recordedBy: người thao tác hoặc mã khách khi hệ thống tự làm (cột lịch sử ô bắt buộc người dùng).
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

    /// <summary>Ô đang giữ cho hợp đồng này (RESERVED) mà không còn ai giữ → AVAILABLE. Ô khách cũ đang dùng giữ nguyên.</summary>
    private async Task ReleaseUnitIfFreeAsync(StorageUnit unit, long contractId, long recordedBy, string reason, CancellationToken ct)
    {
        if (unit.Status != "RESERVED") return;
        var held = await dbContext.RentalContracts.AnyAsync(o => o.UnitId == unit.UnitId && o.ContractId != contractId
                                                                 && UnitAvailability.HoldingStatuses.Contains(o.Status), ct);
        if (!held) SetUnitStatus(unit, "AVAILABLE", recordedBy, reason);
    }

    private async Task<StorageUnit?> ProposedUnitAsync(ConflictState state, CancellationToken ct) =>
        state.ProposedUnitId is long id ? await dbContext.StorageUnits.FirstOrDefaultAsync(u => u.UnitId == id, ct) : null;

    /// <summary>D41 · Tiến trình nền: đề xuất quá 48 giờ khách chưa trả lời → hệ thống nhận ô đề xuất (đổi ngang / nâng cấp).</summary>
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

    public async Task<IReadOnlyList<UnitConflictDto>> GetCustomerUnitConflictsAsync(long customerId, CancellationToken ct = default)
    {
        var contracts = await dbContext.RentalContracts.AsNoTracking().Where(c => c.CustomerId == customerId).Select(c => c.ContractId).ToListAsync(ct);
        return await ConflictDtosAsync(contracts, ct);
    }

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
                Read(st.Proposal, "oldUnit") ?? c.Unit.UnitNumber, Read(st.Proposal, "proposedUnit"), Read(st.Proposal, "proposedType"), area,
                st.Option, Read(st.Proposal, "reason") ?? "", blocking.HasValue ? $"HĐ-{blocking.Value:0000}" : null,
                Local(st.Proposal.LoggedAt)!, st.ExpiresAt.HasValue ? Local(st.ExpiresAt) : null,
                st.Open ? "OPEN" : "RESOLVED", st.Resolution != null ? Read(st.Resolution, "resolution") : null, Local(st.Resolution?.LoggedAt),
                st.Resolution != null ? Read(st.Resolution, "newUnit") : null, st.Resolution != null ? Read(st.Resolution, "newStartDate") : null,
                earliest));
        }
        return result;
    }

    /// <summary>Ngày sớm nhất có ô cùng loại đặt được cho kỳ thuê cùng độ dài (để khách dời ngày).</summary>
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

    private static int MonthsBetween(DateOnly start, DateOnly end)
    {
        var months = (end.Year - start.Year) * 12 + end.Month - start.Month;
        return Math.Max(1, months);
    }

    /// <summary>D41: khách chọn ACCEPT (nhận ô đề xuất) · RESCHEDULE (dời ngày nhận kho) · CANCEL (huỷ, hoàn 100%, không phí D40).</summary>
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

    /// <summary>D41: không còn ô phù hợp → khách huỷ, hoàn 100% tiền thuê + cọc đã trả, không áp phí huỷ 5% (D40). Cách nhận hoàn theo D42/D44.</summary>
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
}
