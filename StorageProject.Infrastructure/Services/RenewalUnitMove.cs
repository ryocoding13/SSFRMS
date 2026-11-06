using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D46 · Gia hạn sang ô khác / về loại cũ sau nâng cấp miễn phí (D41). Giữ cùng hợp đồng, chỉ đổi ô.
/// Trạng thái lưu trong activity_logs (EntityType RENEWAL) như IMPL-P3, không thêm cột / bảng:
///   RENEWAL_UNIT_CHANGE (khách chọn ô) → RENEWAL_UNIT_HELD (quản lý duyệt, giữ ô RESERVED, chốt cọc chênh)
///   → renewal PAID (thu cọc chênh cùng khoản gia hạn) → RENEWAL_UNIT_MOVED (khách bấm "Đã chuyển đồ" trong 3 ngày cuối kỳ cũ,
///   hoặc hệ thống tự chuyển khi hết kỳ cũ) → RENEWAL_OLD_UNIT_INSPECTED (nhân viên kiểm tra ô cũ, trừ cọc nếu có).
/// Mã QR/PIN hiện tại mở được cả ô mới trong thời gian chuyển; chuyển xong cấp mã mới cho ô mới, mã cũ hết hiệu lực.
/// </summary>
public static class RenewalUnitMove
{
    public const string Requested = "RENEWAL_UNIT_CHANGE";
    public const string Held = "RENEWAL_UNIT_HELD";
    public const string Moved = "RENEWAL_UNIT_MOVED";
    public const string Inspected = "RENEWAL_OLD_UNIT_INSPECTED";
    public const int MoveWindowDays = 3;
    private static readonly string[] Actions = [Requested, Held, Moved, Inspected];

    public sealed record Plan(long RenewalId, long FromUnitId, string FromUnit, long TargetUnitId, string TargetUnit,
        long TargetUnitTypeId, decimal TargetRate, decimal DepositRequired, decimal TopUp);

    private sealed record State(Plan Plan, ActivityLog? MovedLog, ActivityLog? InspectedLog);

    private static string Json(object o) => JsonSerializer.Serialize(o);

    private static T? Field<T>(ActivityLog log, string name)
    {
        if (string.IsNullOrEmpty(log.NewValue)) return default;
        using var doc = JsonDocument.Parse(log.NewValue);
        if (!doc.RootElement.TryGetProperty(name, out var v) || v.ValueKind == JsonValueKind.Null) return default;
        return v.Deserialize<T>();
    }

    /// <summary>Ngày đầu được chuyển đồ: 3 ngày cuối kỳ cũ (gồm cả ngày hết hạn).</summary>
    public static DateOnly MoveFrom(DateOnly oldEndDate) => oldEndDate.AddDays(1 - MoveWindowDays);

    private static async Task<State?> StateAsync(AppDbContext db, long renewalId, CancellationToken ct)
    {
        var logs = await db.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == "RENEWAL" && l.EntityId == renewalId && Actions.Contains(l.Action))
            .OrderBy(l => l.LoggedAt).ThenBy(l => l.LogId).ToListAsync(ct);
        var req = logs.LastOrDefault(l => l.Action == Requested);
        if (req == null) return null;
        var held = logs.LastOrDefault(l => l.Action == Held);
        var plan = new Plan(renewalId,
            Field<long>(req, "fromUnitId"), Field<string>(req, "fromUnit") ?? "",
            Field<long>(req, "targetUnitId"), Field<string>(req, "targetUnit") ?? "",
            Field<long>(req, "targetUnitTypeId"),
            Field<decimal>(held ?? req, "targetRate"), Field<decimal>(held ?? req, "depositRequired"), Field<decimal>(held ?? req, "topUp"));
        return new State(plan, logs.LastOrDefault(l => l.Action == Moved), logs.LastOrDefault(l => l.Action == Inspected));
    }

    public static async Task<Plan?> PlanAsync(AppDbContext db, long renewalId, CancellationToken ct) =>
        (await StateAsync(db, renewalId, ct))?.Plan;

    /// <summary>Các yêu cầu gia hạn có chuyển ô (để loại khỏi phần "gia hạn đang chờ giữ ô cũ" của D41).</summary>
    public static IQueryable<long> UnitChangeRenewalIds(AppDbContext db) =>
        db.ActivityLogs.Where(l => l.EntityType == "RENEWAL" && l.Action == Requested && l.EntityId != null).Select(l => l.EntityId!.Value);

    private static async Task<decimal> DepositRequiredAsync(AppDbContext db, long facilityId, long unitTypeId, decimal rate, DateOnly onDate, CancellationToken ct)
    {
        var policy = await OpsRules.FindApplicablePolicyAsync(db, "DEPOSIT", facilityId, unitTypeId, onDate, ct);
        return OpsRules.CalculateDeposit(policy, rate, rate);
    }

    private static async Task<decimal> RateAsync(AppDbContext db, long facilityId, long unitTypeId, decimal fallback, DateOnly onDate, CancellationToken ct)
    {
        var rate = await db.RentalRates
            .Where(r => r.FacilityId == facilityId && r.UnitTypeId == unitTypeId && r.Status == "ACTIVE"
                        && r.EffectiveFrom <= onDate && (r.EffectiveTo == null || r.EffectiveTo >= onDate))
            .OrderByDescending(r => r.EffectiveFrom).Select(r => (decimal?)r.MonthlyRate).FirstOrDefaultAsync(ct);
        return rate ?? fallback;
    }

    /// <summary>D46 / D41: ô trống thật (không hợp đồng giữ, trạng thái AVAILABLE) cùng loại đang thuê, hoặc loại đã đặt ban đầu nếu đã được nâng cấp.</summary>
    public static async Task<RenewalUnitOptionsDto> OptionsAsync(AppDbContext db, RentalContract contract, CancellationToken ct)
    {
        var today = OpsRules.TodayLocal;
        var unit = contract.Unit;
        var originalType = await db.Reservations.Where(r => r.ReservationId == contract.ReservationId)
            .Select(r => (long?)r.UnitTypeId).FirstOrDefaultAsync(ct);
        var upgraded = originalType is long o && o != unit.UnitTypeId;
        var types = upgraded ? new[] { unit.UnitTypeId, originalType!.Value } : new[] { unit.UnitTypeId };
        var options = new List<RenewalUnitOptionDto>();
        foreach (var typeId in types)
        {
            var slots = await UnitAvailability.SlotsAsync(db, unit.FacilityId, typeId, ct);
            var free = slots.Where(s => s.FreeNow && s.Unit.UnitId != unit.UnitId).ToList();
            if (free.Count == 0) continue;
            var rate = await RateAsync(db, unit.FacilityId, typeId, contract.AgreedMonthlyRate, today, ct);
            var deposit = await DepositRequiredAsync(db, unit.FacilityId, typeId, rate, today, ct);
            options.AddRange(free.Select(s => new RenewalUnitOptionDto(s.Unit.UnitId, s.Unit.UnitNumber, typeId,
                s.Unit.UnitType?.TypeName ?? "", typeId == unit.UnitTypeId ? "SWAP" : "ORIGINAL_TYPE",
                rate, deposit, Math.Max(0m, deposit - contract.DepositAmount))));
        }
        return new RenewalUnitOptionsDto(contract.ContractId, unit.UnitNumber, contract.EndDate,
            await UnitAvailability.NextBookingAsync(db, contract, ct), upgraded, contract.DepositAmount, options);
    }

    private static RenewalUnitOptionDto Pick(RenewalUnitOptionsDto options, long targetUnitId) =>
        options.Options.FirstOrDefault(o => o.UnitId == targetUnitId)
        ?? throw new InvalidOperationException("Ô vừa có người đặt hoặc không còn trống. Vui lòng chọn ô khác.");

    /// <summary>Khách gửi gia hạn sang ô khác: kiểm ô còn trống, ghi kế hoạch chuyển ô. Chưa giữ ô (giữ khi quản lý duyệt).</summary>
    public static async Task<RenewalUnitOptionDto> ValidateAsync(AppDbContext db, RentalContract contract, long targetUnitId, CancellationToken ct) =>
        Pick(await OptionsAsync(db, contract, ct), targetUnitId);

    public static void Record(AppDbContext db, RentalContract contract, ContractRenewal renewal, RenewalUnitOptionDto option)
    {
        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = contract.CustomerId, EntityType = "RENEWAL", EntityId = renewal.RenewalId, Action = Requested, LoggedAt = DateTime.UtcNow,
            NewValue = Json(new
            {
                contractId = contract.ContractId, fromUnitId = contract.UnitId, fromUnit = contract.Unit.UnitNumber,
                targetUnitId = option.UnitId, targetUnit = option.UnitNumber, targetUnitTypeId = option.UnitTypeId,
                kind = option.Kind, targetRate = option.MonthlyRate, depositRequired = option.DepositRequired, topUp = option.DepositTopUp
            })
        });
    }

    /// <summary>Quản lý duyệt: kiểm lại ô còn trống, giữ ô (RESERVED), chốt giá ô mới và cọc chênh. Trả về số tiền cọc chênh cần thu.</summary>
    public static async Task<(decimal Rate, decimal TopUp)> HoldAsync(AppDbContext db, long userId, ContractRenewal renewal, Plan plan, CancellationToken ct)
    {
        var contract = renewal.Contract;
        var option = Pick(await OptionsAsync(db, contract, ct), plan.TargetUnitId);
        var target = await db.StorageUnits.SingleAsync(u => u.UnitId == option.UnitId, ct);
        SetStatus(db, target, "RESERVED", userId, $"Giữ ô cho gia hạn sang ô khác · GH-{renewal.RenewalId:0000}");
        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId, EntityType = "RENEWAL", EntityId = renewal.RenewalId, Action = Held, LoggedAt = DateTime.UtcNow,
            NewValue = Json(new { targetUnitId = option.UnitId, targetRate = option.MonthlyRate, depositRequired = option.DepositRequired, topUp = option.DepositTopUp })
        });
        return (option.MonthlyRate, option.DepositTopUp);
    }

    /// <summary>Gia hạn bị huỷ / hết hạn thanh toán: trả ô đang giữ nếu không còn ai giữ.</summary>
    public static async Task ReleaseAsync(AppDbContext db, long renewalId, long? userId, string reason, CancellationToken ct)
    {
        var plan = await PlanAsync(db, renewalId, ct);
        if (plan == null) return;
        var target = await db.StorageUnits.SingleOrDefaultAsync(u => u.UnitId == plan.TargetUnitId, ct);
        if (target is not { Status: "RESERVED" }) return;
        var held = await db.RentalContracts.AnyAsync(c => c.UnitId == target.UnitId && UnitAvailability.HoldingStatuses.Contains(c.Status), ct);
        var actor = userId ?? await db.RentalContracts.Where(c => c.ContractRenewals.Any(r => r.RenewalId == renewalId))
            .Select(c => c.CustomerId).FirstAsync(ct);
        if (!held) SetStatus(db, target, "AVAILABLE", actor, reason);
    }

    /// <summary>Đã thu đủ: tách cọc chênh khỏi khoản gia hạn thành khoản DEPOSIT (báo cáo doanh thu không tính cọc), tăng cọc đang giữ.</summary>
    public static async Task SettleAsync(AppDbContext db, ContractRenewal renewal, Payment renewalPayment, CancellationToken ct)
    {
        var plan = await PlanAsync(db, renewal.RenewalId, ct);
        if (plan == null || plan.TopUp <= 0) return;
        var now = DateTime.UtcNow;
        renewalPayment.Amount -= plan.TopUp;
        db.Payments.Add(new Payment
        {
            ContractId = renewal.ContractId, RenewalId = renewal.RenewalId, PaymentType = "DEPOSIT", Amount = plan.TopUp, Currency = "VND",
            PaymentMethod = renewalPayment.PaymentMethod,
            // payments.TransactionReference là duy nhất: khoản cọc chênh dùng mã của khoản gia hạn kèm hậu tố -COC.
            TransactionReference = renewalPayment.TransactionReference is { Length: > 0 } reference ? Ref($"{reference}-COC") : null,
            PaidAt = now, Status = "PAID", CreatedAt = now, UpdatedAt = now
        });
        renewal.Contract.DepositAmount += plan.TopUp;
    }

    /// <summary>Yêu cầu gia hạn đã trả tiền, chưa chuyển đồ, của một hợp đồng.</summary>
    private static async Task<(ContractRenewal Renewal, Plan Plan)?> PendingMoveAsync(AppDbContext db, long contractId, CancellationToken ct)
    {
        var ids = await db.ContractRenewals.AsNoTracking()
            .Where(r => r.ContractId == contractId && r.Status == "PAID" && UnitChangeRenewalIds(db).Contains(r.RenewalId))
            .OrderByDescending(r => r.RenewalId).Select(r => r.RenewalId).ToListAsync(ct);
        foreach (var id in ids)
        {
            var state = await StateAsync(db, id, ct);
            if (state is { MovedLog: null })
                return (await db.ContractRenewals.SingleAsync(r => r.RenewalId == id, ct), state.Plan);
        }
        return null;
    }

    public static async Task<bool> HasPendingMoveAsync(AppDbContext db, long contractId, CancellationToken ct) =>
        await PendingMoveAsync(db, contractId, ct) != null;

    /// <summary>Hợp đồng đang trong thời gian chuyển sang ô <paramref name="unitNumber"/> (mã hiện tại mở được ô mới).</summary>
    public static async Task<bool> CanOpenTargetAsync(AppDbContext db, long contractId, string unitNumber, CancellationToken ct)
    {
        var pending = await PendingMoveAsync(db, contractId, ct);
        return pending is { } p && p.Plan.TargetUnit == unitNumber && OpsRules.TodayLocal >= MoveFrom(p.Renewal.OldEndDate);
    }

    /// <summary>Hợp đồng đang chuyển tới ô này (để tra PIN tại ô mới).</summary>
    public static async Task<List<long>> ContractsMovingIntoAsync(AppDbContext db, string unitNumber, CancellationToken ct)
    {
        var contractIds = await db.ContractRenewals.AsNoTracking()
            .Where(r => r.Status == "PAID" && UnitChangeRenewalIds(db).Contains(r.RenewalId)).Select(r => r.ContractId).Distinct().ToListAsync(ct);
        var result = new List<long>();
        foreach (var id in contractIds)
            if (await CanOpenTargetAsync(db, id, unitNumber, ct)) result.Add(id);
        return result;
    }

    /// <summary>Khách bấm "Đã chuyển đồ" trong 3 ngày cuối kỳ cũ.</summary>
    public static async Task<UnitMoveDto> MarkMovedAsync(AppDbContext db, long customerId, long contractId, CancellationToken ct)
    {
        await using var tx = await CheckoutTransaction.BeginAsync(db, $"contract:{contractId}", ct);
        var contract = await LoadContractAsync(db, contractId, ct);
        if (contract == null || contract.CustomerId != customerId) throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
        var pending = await PendingMoveAsync(db, contractId, ct)
            ?? throw new InvalidOperationException("Hợp đồng không có ô mới đang chờ chuyển đồ.");
        if (OpsRules.TodayLocal < MoveFrom(pending.Renewal.OldEndDate))
            throw new InvalidOperationException($"Chỉ chuyển đồ trong 3 ngày cuối kỳ cũ, từ {MoveFrom(pending.Renewal.OldEndDate):dd/MM/yyyy}.");
        await CompleteAsync(db, contract, pending.Renewal, pending.Plan, customerId, auto: false, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await DtoAsync(db, pending.Renewal.RenewalId, ct))!;
    }

    /// <summary>Hết kỳ cũ mà khách chưa bấm: hệ thống tự chuyển hợp đồng sang ô mới, mã ô cũ hết hiệu lực, tạo việc kiểm tra ô cũ.</summary>
    public static async Task<int> AutoCompleteAsync(AppDbContext db, CancellationToken ct)
    {
        var today = OpsRules.TodayLocal;
        var candidates = await db.ContractRenewals.AsNoTracking()
            .Where(r => r.Status == "PAID" && r.OldEndDate < today && UnitChangeRenewalIds(db).Contains(r.RenewalId))
            .Select(r => r.ContractId).Distinct().Take(100).ToListAsync(ct);
        var done = 0;
        foreach (var contractId in candidates)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(db, $"contract:{contractId}", ct);
            var pending = await PendingMoveAsync(db, contractId, ct);
            if (pending is not { } p || p.Renewal.OldEndDate >= OpsRules.TodayLocal) continue;
            var contract = await LoadContractAsync(db, contractId, ct);
            if (contract == null || contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE")) continue;
            await CompleteAsync(db, contract, p.Renewal, p.Plan, contract.CustomerId, auto: true, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            done++;
        }
        return done;
    }

    private static Task<RentalContract?> LoadContractAsync(AppDbContext db, long contractId, CancellationToken ct) =>
        db.RentalContracts.Include(c => c.Unit).Include(c => c.AccessCredentials).Include(c => c.HandoverRecord)
            .SingleOrDefaultAsync(c => c.ContractId == contractId, ct);

    private static async Task CompleteAsync(AppDbContext db, RentalContract contract, ContractRenewal renewal, Plan plan, long actorId, bool auto, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var oldUnit = contract.Unit;
        var target = await db.StorageUnits.SingleAsync(u => u.UnitId == plan.TargetUnitId, ct);
        var reason = $"Gia hạn sang ô khác · GH-{renewal.RenewalId:0000}";
        SetStatus(db, target, "OCCUPIED", actorId, reason);
        SetStatus(db, oldUnit, "INSPECTION", actorId, $"{reason} · chờ kiểm tra ô cũ");
        contract.UnitId = target.UnitId;
        contract.Unit = target;
        foreach (var a in await db.UnitAssignments.Where(a => a.ReservationId == contract.ReservationId && a.Status == "ACTIVE").ToListAsync(ct))
        {
            a.Status = "REPLACED";
            a.UnassignedAt = now;
        }
        db.UnitAssignments.Add(new UnitAssignment
        {
            ReservationId = contract.ReservationId, UnitId = target.UnitId, AssignedBy = actorId, AssignedAt = now, Status = "ACTIVE", Reason = reason
        });
        // Mã ô cũ hết hiệu lực; cấp QR/PIN mới cho ô mới. Chìa khóa vật lý: nhân viên ghi nhận giao chìa ô mới (như chuyển ô do sự cố).
        var hadKey = false;
        foreach (var cred in contract.AccessCredentials.Where(c => c.Status == "ACTIVE"))
        {
            hadKey |= cred.CredentialType == "KEY";
            cred.Status = "REPLACED";
            cred.ReturnedAt = now;
        }
        foreach (var kind in new[] { "QR", "PIN" })
            contract.AccessCredentials.Add(new AccessCredential
            {
                ContractId = contract.ContractId, UnitId = target.UnitId, IssuedBy = actorId, CredentialType = "ACCESS_CODE",
                CredentialReference = $"{kind}-{Guid.NewGuid():N}", IssuedAt = now, Status = "ACTIVE"
            });
        if (hadKey && contract.HandoverRecord is { Status: "HANDED_OVER" } receipt)
        {
            receipt.Status = "VERIFIED";
            receipt.HandoverAt = null;
            receipt.StaffConfirmed = false;
            receipt.CustomerConfirmed = false;
        }
        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = auto ? null : actorId, EntityType = "RENEWAL", EntityId = renewal.RenewalId, Action = Moved, LoggedAt = now,
            NewValue = Json(new { contractId = contract.ContractId, fromUnit = oldUnit.UnitNumber, toUnit = target.UnitNumber, auto })
        });
    }

    /// <summary>Việc kiểm tra ô cũ đang chờ tại cơ sở (đã chuyển, chưa kiểm tra).</summary>
    public static async Task<IReadOnlyList<UnitMoveDto>> PendingInspectionsAsync(AppDbContext db, long facilityId, CancellationToken ct)
    {
        var ids = await db.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == "RENEWAL" && l.Action == Moved && l.EntityId != null).Select(l => l.EntityId!.Value).Distinct().ToListAsync(ct);
        var result = new List<UnitMoveDto>();
        foreach (var id in ids)
        {
            var state = await StateAsync(db, id, ct);
            if (state == null || state.InspectedLog != null) continue;
            if (!await db.StorageUnits.AnyAsync(u => u.UnitId == state.Plan.FromUnitId && u.FacilityId == facilityId, ct)) continue;
            if (await DtoAsync(db, id, ct) is { } dto) result.Add(dto);
        }
        return result.OrderBy(d => d.MovedAt).ToList();
    }

    /// <summary>Nhân viên kiểm tra ô cũ như trả kho (D38) nhưng không hoàn cọc; khấu trừ vào cọc đang giữ, không tạo nợ (D31).</summary>
    public static async Task<UnitMoveDto> InspectAsync(AppDbContext db, long staffId, long facilityId, long renewalId, UnitMoveInspectionRequest request, CancellationToken ct)
    {
        var contractId = await db.ContractRenewals.AsNoTracking().Where(r => r.RenewalId == renewalId).Select(r => (long?)r.ContractId).FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");
        await using var tx = await CheckoutTransaction.BeginAsync(db, $"contract:{contractId}", ct);
        var state = await StateAsync(db, renewalId, ct) ?? throw new KeyNotFoundException("Yêu cầu gia hạn không có chuyển ô.");
        if (state.MovedLog == null) throw new InvalidOperationException("Khách chưa chuyển sang ô mới.");
        if (state.InspectedLog != null) throw new InvalidOperationException("Ô cũ đã được kiểm tra.");
        var oldUnit = await db.StorageUnits.SingleAsync(u => u.UnitId == state.Plan.FromUnitId, ct);
        if (oldUnit.FacilityId != facilityId) throw new UnauthorizedAccessException("Ô không thuộc cơ sở bạn phụ trách.");
        if (request.GoodsRemaining)
            throw new InvalidOperationException("Ô cũ còn đồ: liên hệ khách chuyển hết rồi kiểm tra lại. Phí quá hạn tính đến ngày kiểm tra đạt.");
        var damage = request.DamageFee ?? 0m;
        if (damage < 0 || damage != decimal.Truncate(damage)) throw new ArgumentException("Phí hư hỏng phải là số tiền VND không âm.");
        var contract = await db.RentalContracts.Include(c => c.Unit).SingleAsync(c => c.ContractId == contractId, ct);
        var renewal = await db.ContractRenewals.SingleAsync(r => r.RenewalId == renewalId, ct);
        var now = DateTime.UtcNow;
        var auto = Field<bool>(state.MovedLog, "auto");
        // Khách không báo chuyển kịp: ô cũ tính quá hạn theo D32 từ ngày sau hết kỳ cũ đến ngày kiểm tra đạt.
        var overdueDays = auto ? Math.Max(0, OpsRules.TodayLocal.DayNumber - renewal.OldEndDate.DayNumber) : 0;
        var overdue = 0m;
        if (overdueDays > 0)
        {
            var policy = await OpsRules.FindApplicablePolicyAsync(db, "OVERDUE", oldUnit.FacilityId, oldUnit.UnitTypeId, OpsRules.TodayLocal, ct);
            overdue = policy != null
                ? StorageProject.Core.Policies.RefundPolicy.OverdueFeeFor(policy.CalculationType, policy.Value, contract.DepositAmount, overdueDays, maxCap: contract.DepositAmount)
                : StorageProject.Core.Policies.RefundPolicy.OverdueFeeFor("DEPOSIT_PERCENT_PER_DAY", OpsRules.DefaultOverdueRatePerDay, contract.DepositAmount, overdueDays, maxCap: contract.DepositAmount);
        }
        var cleaning = request.CleaningRequired ? FacilityOpsService.CleaningFeeFor(contract.DepositAmount) : 0m;
        // Khấu trừ tối đa bằng cọc đang giữ, không tạo nợ (D31); thứ tự trừ: quá hạn, vệ sinh, hư hỏng.
        var left = contract.DepositAmount;
        decimal Take(decimal x) { var t = Math.Min(left, x); left -= t; return t; }
        var fees = new (string Type, decimal Amount)[] { ("OVERDUE_FEE", Take(overdue)), ("CLEANING_FEE", Take(cleaning)), ("DAMAGE_FEE", Take(damage)) };
        foreach (var (type, amount) in fees.Where(f => f.Amount > 0))
            db.Payments.Add(new Payment
            {
                ContractId = contractId, RenewalId = renewalId, PaymentType = type, Amount = amount, Currency = "VND", PaymentMethod = "CASH",
                TransactionReference = $"TRU-COC-GH-{renewalId:0000}-{type}", PaidAt = now, // mỗi khoản một mã (unique) Status = "PAID", CreatedAt = now, UpdatedAt = now
            });
        var deduction = fees.Sum(f => f.Amount);
        contract.DepositAmount -= deduction;
        // D38: cần vệ sinh / sửa → bảo trì; có khách đặt tiếp → giữ; còn lại trống.
        var nextBooked = await db.RentalContracts.AnyAsync(c => c.UnitId == oldUnit.UnitId && c.ContractId != contractId
                                                                && UnitAvailability.HoldingStatuses.Contains(c.Status), ct);
        SetStatus(db, oldUnit, cleaning > 0 || damage > 0 ? "MAINTENANCE" : nextBooked ? "RESERVED" : "AVAILABLE", staffId,
            $"Kiểm tra ô cũ sau gia hạn sang ô khác · GH-{renewalId:0000}");
        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = staffId, EntityType = "RENEWAL", EntityId = renewalId, Action = Inspected, LoggedAt = now,
            NewValue = Json(new { contractId, unit = oldUnit.UnitNumber, overdueDays, overdue = fees[0].Amount, cleaning = fees[1].Amount,
                damage = fees[2].Amount, deduction, depositLeft = contract.DepositAmount, note = request.Note?.Trim() })
        });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await DtoAsync(db, renewalId, ct))!;
    }

    public static async Task<UnitMoveDto?> CurrentForContractAsync(AppDbContext db, long customerId, long contractId, CancellationToken ct)
    {
        if (!await db.RentalContracts.AnyAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct))
            throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
        var id = await db.ContractRenewals.AsNoTracking()
            .Where(r => r.ContractId == contractId && UnitChangeRenewalIds(db).Contains(r.RenewalId)
                        && r.Status != "REJECTED" && r.Status != "CANCELLED" && r.Status != "EXPIRED")
            .OrderByDescending(r => r.RenewalId).Select(r => (long?)r.RenewalId).FirstOrDefaultAsync(ct);
        return id == null ? null : await DtoAsync(db, id.Value, ct);
    }

    private static async Task<UnitMoveDto?> DtoAsync(AppDbContext db, long renewalId, CancellationToken ct)
    {
        var state = await StateAsync(db, renewalId, ct);
        if (state == null) return null;
        var r = await db.ContractRenewals.AsNoTracking().Where(x => x.RenewalId == renewalId)
            .Select(x => new { x.ContractId, x.Status, x.OldEndDate, Customer = x.Contract.Customer.FullName, Deposit = x.Contract.DepositAmount }).SingleAsync(ct);
        var status = state.InspectedLog != null ? "INSPECTED" : state.MovedLog != null ? "MOVED"
            : r.Status == "PAID" ? "PAID" : r.Status == "APPROVED" ? "HELD" : r.Status == "PENDING" ? "REQUESTED" : r.Status;
        return new UnitMoveDto(renewalId, r.ContractId, r.Customer, state.Plan.FromUnit, state.Plan.TargetUnit, r.OldEndDate,
            MoveFrom(r.OldEndDate), state.Plan.TopUp, status,
            // Giờ Việt Nam không kèm múi giờ, như các DTO vận hành khác (FE hiển thị trực tiếp).
            state.MovedLog == null ? null : DateTime.SpecifyKind(state.MovedLog.LoggedAt.AddHours(7), DateTimeKind.Unspecified),
            state.MovedLog != null && Field<bool>(state.MovedLog, "auto"),
            state.InspectedLog != null ? Field<decimal>(state.InspectedLog, "deduction") : null, r.Deposit);
    }

    private const int ReferenceMaxLength = 150; // ReservationContractConfigurations: TransactionReference HasMaxLength(150)
    private static string Ref(string value) => value.Length <= ReferenceMaxLength ? value : value[^ReferenceMaxLength..];

    private static void SetStatus(AppDbContext db, StorageUnit unit, string status, long userId, string reason)
    {
        if (unit.Status == status) return;
        var now = DateTime.UtcNow;
        db.UnitStatusHistories.Add(new UnitStatusHistory
        {
            UnitId = unit.UnitId, ChangedBy = userId, OldStatus = unit.Status, NewStatus = status,
            Reason = reason.Length > 255 ? reason[..255] : reason, ChangedAt = now
        });
        unit.Status = status;
        unit.UpdatedAt = now;
    }
}
