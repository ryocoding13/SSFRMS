using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Phiên 3 (05/11/2026):
/// - D39/D40: khách xác nhận khấu trừ trả kho trong 48 giờ, quá hạn tự chốt theo biên bản nhân viên;
///   khách tự dọn / tự thay / khiếu nại → cơ sở kiểm tra lại, đạt thì không trừ khoản tương ứng.
/// - D42/D43: hoàn tiền mặt tại quầy (quản lý duyệt, nhân viên chi, tick 4 mục), gọi nhắc ngày 10/20/25, hạn 30 ngày,
///   ngày hẹn tạm dừng gọi nhắc; báo cáo việc tồn cuối ngày 22:00 cho quản lý cơ sở.
/// Trạng thái lưu trong activity_logs (không thêm cột/bảng mới).
/// </summary>
public partial class FacilityOpsService
{
    /// <summary>D40/D42: nhân viên gửi biên bản trả kho trong 3 ngày kể từ khi khách gửi yêu cầu.</summary>
    private static readonly TimeSpan InspectionSla = TimeSpan.FromDays(3);
    /// <summary>D40: khách có 48 giờ kể từ khi nhận biên bản để xác nhận khấu trừ.</summary>
    internal static readonly TimeSpan DeductionWindow = TimeSpan.FromHours(48);
    /// <summary>D42: khách nhận tiền mặt trong 30 ngày kể từ khi quản lý duyệt; nhắc ở ngày 10, 20, 25.</summary>
    internal const int CashRefundDays = 30;
    internal static readonly int[] CashReminderDays = [10, 20, 25];
    /// <summary>D42: giờ gửi báo cáo cuối ngày (giờ Việt Nam).</summary>
    internal const int DailyReportHour = 22;

    private static class FlowAction
    {
        public const string DeductionDecision = "RETURN_DEDUCTION_DECISION";
        public const string DeductionRecheck = "RETURN_DEDUCTION_RECHECK";
        public const string DeductionAutoAgreed = "RETURN_DEDUCTION_AUTO_AGREED";
        public const string CashApproved = "CASH_REFUND_APPROVED";
        public const string CashCall = "CASH_REFUND_CALL";
        public const string CashPaid = "CASH_REFUND_PAID";
        public const string CashForfeited = "CASH_REFUND_FORFEITED";
        public const string CashSwitchedToBank = "CASH_REFUND_SWITCHED_TO_BANK";
        public const string DailyReport = "DAILY_STAFF_REPORT";
    }

    private const string PaymentEntity = "PAYMENT";
    private const string FacilityEntity = "FACILITY";
    internal const string CashMethod = "CASH";

    private static readonly string[] DeductionDecisions = ["AGREE", "SELF_CLEAN", "SELF_REPLACE", "DISPUTE"];
    private static readonly string[] CallResults = ["APPOINTMENT", "NO_ANSWER", "SWITCH_TO_BANK", "WRONG_NUMBER"];

    internal static string CashRefundCode(long paymentId) => $"CH-{paymentId:0000}";

    // =====================================================================
    // D39 · Trạng thái khấu trừ của một biên bản
    // =====================================================================

    /// <summary>
    /// NONE (không có khấu trừ / chưa có biên bản) · WAITING (trong 48 giờ, khách chưa chọn) · AUTO_AGREED (quá 48 giờ) ·
    /// AGREED · SELF_CLEAN / SELF_REPLACE / DISPUTE (chờ cơ sở kiểm tra lại) · RECHECKED (đã kiểm tra lại).
    /// </summary>
    private static (string Status, DateTime? DeadlineUtc) DeductionStateOf(ReturnInspection i, IEnumerable<ActivityLog> logs, DateTime now)
    {
        if (i.Status != "COMPLETED" || i.InspectedAt == null) return ("NONE", null);
        var list = logs.Where(l => l.EntityId == i.InspectionId).OrderBy(l => l.LoggedAt).ToList();
        var recheck = list.LastOrDefault(l => l.Action == FlowAction.DeductionRecheck);
        if (recheck != null) return ("RECHECKED", null);
        if (i.CleaningFee <= 0 && i.DamageFee <= 0 && !i.CleaningRequired) return ("NONE", null);
        var deadline = DateTime.SpecifyKind(i.InspectedAt.Value, DateTimeKind.Utc) + DeductionWindow;
        var decision = list.LastOrDefault(l => l.Action == FlowAction.DeductionDecision);
        if (decision != null)
        {
            var d = Read(decision, "decision") ?? "AGREE";
            return (d == "AGREE" ? "AGREED" : d, deadline);
        }
        if (list.Any(l => l.Action == FlowAction.DeductionAutoAgreed) || now >= deadline) return ("AUTO_AGREED", deadline);
        return ("WAITING", deadline);
    }

    /// <summary>Chặn chốt hoàn cọc (M07) khi khách còn trong hạn xác nhận hoặc phương án thay thế chưa được kiểm tra lại.</summary>
    private async Task RequireDeductionSettledAsync(ReturnInspection inspection, long? actorId, DateTime now, CancellationToken ct)
    {
        var logs = await LogsAsync(LogEntity.Return, [inspection.InspectionId], ct);
        var (status, deadline) = DeductionStateOf(inspection, logs, now);
        switch (status)
        {
            case "WAITING":
                throw new InvalidOperationException(
                    $"Chờ khách xác nhận khấu trừ đến {Local(deadline)!.Replace('T', ' ')}. Quá hạn hệ thống tự chốt theo biên bản.");
            case "SELF_CLEAN" or "SELF_REPLACE" or "DISPUTE":
                throw new InvalidOperationException("Khách đã chọn phương án khác. Kiểm tra lại kho trước khi chốt hoàn cọc.");
            case "AUTO_AGREED" when !logs.Any(l => l.Action == FlowAction.DeductionAutoAgreed):
                Log(actorId, FlowAction.DeductionAutoAgreed, LogEntity.Return, inspection.InspectionId,
                    new { deadline = Local(deadline), note = "Quá 48 giờ khách chưa xác nhận, chốt theo biên bản nhân viên", system = actorId == null });
                break;
        }
    }

    private static long CustomerContractId(string? code)
    {
        var text = (code ?? string.Empty).Trim();
        return long.TryParse(text, out var id) && id > 0 ? id : ParseCode(text, "HĐ-", "hợp đồng");
    }

    private async Task<(RentalContract Contract, ReturnInspection Inspection)> CustomerInspectionAsync(
        long customerId, string contractCode, bool track, CancellationToken ct)
    {
        var contractId = CustomerContractId(contractCode);
        var query = dbContext.RentalContracts.Include(c => c.Unit).Include(c => c.ReturnInspections).ThenInclude(i => i.Staff)
            .Include(c => c.Payments).AsQueryable();
        if (!track) query = query.AsNoTracking();
        var contract = await query.FirstOrDefaultAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct)
                       ?? throw new KeyNotFoundException("Không tìm thấy hợp đồng của bạn.");
        var inspection = contract.ReturnInspections.Where(i => i.Status == "COMPLETED")
                             .OrderByDescending(i => i.InspectedAt ?? i.CreatedAt).FirstOrDefault()
                         ?? throw new InvalidOperationException("Cơ sở chưa gửi biên bản trả kho.");
        return (contract, inspection);
    }

    private async Task<ReturnDeductionDto> ToDeductionDtoAsync(RentalContract c, ReturnInspection i, CancellationToken ct)
    {
        var logs = await LogsAsync(LogEntity.Return, [i.InspectionId], ct);
        var (status, deadline) = DeductionStateOf(i, logs, NowUtc);
        var decision = logs.LastOrDefault(l => l.Action == FlowAction.DeductionDecision);
        var recheck = logs.LastOrDefault(l => l.Action == FlowAction.DeductionRecheck);
        var photos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, [i.InspectionId], ct);
        var customerPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnDeduction, [i.InspectionId], ct);
        // D30-13: phí quá hạn tính đến lúc khách gửi trả kho (D32), hiển thị cùng khoản khấu trừ.
        var overdueDays = Math.Max(0, DateOnly.FromDateTime(i.CreatedAt + VnOffset).DayNumber - c.EndDate.DayNumber);
        var overdueFee = c.Unit != null ? await OverdueFeeAtAsync(c, c.Unit.FacilityId, i.CreatedAt, ct) : 0;
        return new ReturnDeductionDto(
            ReturnCode(i.InspectionId), ContractCode(c), c.DepositAmount, i.CleaningFee, i.DamageFee,
            i.DamageItem ?? "", i.FeeReason ?? "", PhotosOf(photos, i.InspectionId),
            Local(i.InspectedAt), Local(deadline), status == "WAITING",
            status, decision != null ? Read(decision, "decision") : null, decision != null ? Read(decision, "note") : null,
            Local(decision?.LoggedAt), recheck != null ? Read(recheck, "note") : null,
            overdueFee, overdueDays, i.Staff?.FullName,
            customerPhotos.TryGetValue(i.InspectionId, out var mine) ? mine : []);
    }

    public async Task<ReturnDeductionDto> GetReturnDeductionAsync(long customerId, string contractCode, CancellationToken ct = default)
    {
        var (c, i) = await CustomerInspectionAsync(customerId, contractCode, track: false, ct);
        return await ToDeductionDtoAsync(c, i, ct);
    }

    public async Task<ReturnDeductionDto> DecideReturnDeductionAsync(long customerId, string contractCode,
        ReturnDeductionDecisionRequest request, CancellationToken ct = default)
    {
        var decision = (request.Decision ?? string.Empty).Trim().ToUpperInvariant();
        if (!DeductionDecisions.Contains(decision)) throw new ArgumentException("Chọn một phương án xác nhận khấu trừ.");
        var note = Clip(request.Note, 1000);
        if (decision == "DISPUTE" && note.Length == 0) throw new ArgumentException("Ghi rõ nội dung khiếu nại.");
        // Câu 7: ảnh hoá đơn / vật dụng thay thế (không bắt buộc), chỉ cho tự thay thế hoặc khiếu nại.
        if (request.Photos?.Count > 0 && decision is not ("SELF_REPLACE" or "DISPUTE"))
            throw new ArgumentException("Chỉ đính kèm ảnh khi tự thay thế vật dụng hoặc khiếu nại.");
        var photos = EvidencePhotos.Decode(request.Photos, required: false, "hoá đơn / vật dụng thay thế");

        var contractId = CustomerContractId(contractCode);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"move-out:{contractId}", ct);
        var (c, i) = await CustomerInspectionAsync(customerId, contractCode, track: true, ct);
        if (c.Status != "RETURN_PENDING" || c.Payments.Any(p => p.PaymentType == "REFUND"))
        {
            throw new InvalidOperationException("Hoàn cọc đã được chốt, không đổi được lựa chọn.");
        }
        var logs = await LogsAsync(LogEntity.Return, [i.InspectionId], ct);
        var (status, _) = DeductionStateOf(i, logs, NowUtc);
        switch (status)
        {
            case "NONE": throw new InvalidOperationException("Biên bản không có khoản khấu trừ, không cần xác nhận.");
            case "AUTO_AGREED": throw new InvalidOperationException("Đã quá 48 giờ, hệ thống đã chốt theo biên bản của nhân viên.");
            case not "WAITING": throw new InvalidOperationException("Bạn đã gửi lựa chọn cho biên bản này.");
        }
        var cleaning = i.CleaningRequired || i.CleaningFee > 0;
        if (decision == "SELF_CLEAN" && !cleaning) throw new ArgumentException("Biên bản không có phí vệ sinh.");
        if (decision == "SELF_REPLACE" && i.DamageFee <= 0) throw new ArgumentException("Biên bản không có phí hư hỏng.");

        Log(customerId, FlowAction.DeductionDecision, LogEntity.Return, i.InspectionId,
            new { decision, note, cleaningFee = i.CleaningFee, damageFee = i.DamageFee, photos = photos.Count });
        EvidencePhotos.Attach(dbContext, photos, EvidencePhotos.ReturnDeduction, i.InspectionId, customerId, NowUtc);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await ToDeductionDtoAsync(c, i, ct);
    }

    /// <summary>D39: cơ sở kiểm tra lại sau khi khách tự dọn / tự thay / khiếu nại. Đạt → không trừ khoản tương ứng.</summary>
    public async Task RecheckReturnAsync(OpsActor actor, string id, ReturnRecheckRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var note = Clip(request.Note, 1000);
        if (note.Length == 0) throw new ArgumentException("Ghi kết quả kiểm tra lại.");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"return-inspection:{facility.FacilityId}:{id}", ct);
        var i = await InspectionAsync(facility.FacilityId, id, ct);
        var logs = await LogsAsync(LogEntity.Return, [i.InspectionId], ct);
        var (status, _) = DeductionStateOf(i, logs, NowUtc);
        if (status is not ("SELF_CLEAN" or "SELF_REPLACE" or "DISPUTE"))
        {
            throw new InvalidOperationException("Biên bản không có phương án nào chờ kiểm tra lại.");
        }
        if (await dbContext.Payments.AnyAsync(p => p.ContractId == i.ContractId && p.PaymentType == "REFUND", ct))
        {
            throw new InvalidOperationException("Hoàn cọc đã được chốt.");
        }
        var cleaningPassed = request.CleaningPassed == true && (status is "SELF_CLEAN" or "DISPUTE") && (i.CleaningRequired || i.CleaningFee > 0);
        var replacementPassed = request.ReplacementPassed == true && (status is "SELF_REPLACE" or "DISPUTE") && i.DamageFee > 0;
        var before = new { cleaningFee = i.CleaningFee, damageFee = i.DamageFee, condition = i.ConditionStatus };
        if (cleaningPassed)
        {
            i.CleaningFee = 0;
            i.CleaningRequired = false;
        }
        if (replacementPassed)
        {
            i.DamageFee = 0;
            i.DamageItem = null;
        }
        if (cleaningPassed || replacementPassed)
        {
            i.ConditionStatus = i.DamageFee > 0 ? "DAMAGED" : i.CleaningRequired ? "DIRTY" : i.MaintenanceRequired ? "MAINTENANCE_REQUIRED" : "GOOD";
        }
        Log(actor.UserId, FlowAction.DeductionRecheck, LogEntity.Return, i.InspectionId, new
        {
            status, cleaningPassed, replacementPassed, note, before,
            cleaningFee = i.CleaningFee, damageFee = i.DamageFee, staff = StaffCode(actor.UserId)
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// D40 + D44 (cách B): hệ thống tự chốt hoàn cọc theo biên bản (tạo khoản hoàn PENDING như M07), ghi nhật ký là
    /// "Hệ thống" (UserId = null, system = true) — không cần cơ sở có quản lý.
    /// Chốt khi: quá 48 giờ khách chưa trả lời (AUTO_AGREED) hoặc khách đã bấm "Đồng ý khấu trừ · hoàn tất hoàn cọc" (AGREED).
    /// Phương án khác (tự dọn / tự thay / khiếu nại) chờ cơ sở kiểm tra lại rồi quản lý chốt ở M07.
    /// </summary>
    public async Task<int> AutoSettleExpiredDeductionsAsync(CancellationToken ct = default)
    {
        var now = NowUtc;
        var candidates = await dbContext.ReturnInspections.AsNoTracking()
            .Where(i => i.Status == "COMPLETED" && i.InspectedAt != null
                        && (i.CleaningFee > 0 || i.DamageFee > 0 || i.CleaningRequired)
                        && i.Contract.Status == "RETURN_PENDING"
                        && !i.Contract.Payments.Any(p => p.PaymentType == "REFUND"))
            .Select(i => new { i.InspectionId, i.ContractId, FacilityId = i.Contract.Unit.FacilityId })
            .ToListAsync(ct);
        if (candidates.Count == 0) return 0;

        var settled = 0;
        foreach (var x in candidates)
        {
            try
            {
                await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract-settlement:{x.ContractId}", ct);
                var contract = await dbContext.RentalContracts
                    .Include(c => c.Unit).Include(c => c.Payments).Include(c => c.ReturnInspections)
                    .Include(c => c.OverdueCases).Include(c => c.AccessCredentials)
                    .FirstAsync(c => c.ContractId == x.ContractId, ct);
                var inspection = contract.ReturnInspections.Where(i => i.Status == "COMPLETED")
                    .OrderByDescending(i => i.InspectedAt ?? i.CreatedAt).First();
                var logs = await LogsAsync(LogEntity.Return, [inspection.InspectionId], ct);
                var (status, _) = DeductionStateOf(inspection, logs, now);
                if (status is not ("AUTO_AGREED" or "AGREED")) continue;
                await SettleReturnAsync(contract, x.FacilityId, null,
                    status == "AGREED" ? "Hệ thống chốt: khách đồng ý khấu trừ (D39)" : "Hệ thống chốt: quá 48 giờ khách chưa xác nhận (D40)", ct);
                await dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                settled++;
            }
            catch (InvalidOperationException)
            {
                // Quản lý vừa chốt cùng lúc / trạng thái đổi / chưa cấu hình chính sách — lần quét sau xem lại.
            }
            finally
            {
                dbContext.ChangeTracker.Clear();
            }
        }
        return settled;
    }

    private async Task<long?> FacilityManagerIdAsync(long facilityId, CancellationToken ct)
    {
        var today = VnToday;
        return await dbContext.UserFacilities.AsNoTracking()
            .Where(uf => uf.FacilityId == facilityId && uf.Status == "ACTIVE" && uf.AssignedFrom <= today
                         && (uf.AssignedTo == null || uf.AssignedTo >= today)
                         && uf.User.Status == "ACTIVE" && uf.User.UserRoles.Any(r => r.Role.RoleName == "MANAGER"))
            .OrderBy(uf => uf.AssignedFrom)
            .Select(uf => (long?)uf.UserId)
            .FirstOrDefaultAsync(ct);
    }

    // =====================================================================
    // D42 · Hoàn tiền mặt tại quầy
    // =====================================================================

    private IQueryable<Payment> CashRefundQuery(long facilityId) => dbContext.Payments
        .Include(p => p.Reservation).ThenInclude(r => r.Customer)
        .Include(p => p.Contract).ThenInclude(c => c.Unit)
        .Include(p => p.Contract).ThenInclude(c => c.Customer)
        .Where(p => p.PaymentType == "REFUND" && p.PaymentMethod == CashMethod
                    && ((p.ReservationId != null && p.Reservation.FacilityId == facilityId)
                        || (p.ReservationId == null && p.ContractId != null && p.Contract.Unit.FacilityId == facilityId)));

    private sealed record CashState(
        string Status, DateTime? ApprovedAt, long? AssignedStaffId, DateOnly? Deadline, int Days,
        int? ReminderDay, DateOnly? Appointment, ActivityLog? LastCall, ActivityLog? Paid);

    /// <summary>
    /// WAITING_APPROVAL (chờ quản lý duyệt) · READY (chờ khách đến quầy) · REMIND (đến mốc 10/20/25, cần gọi nhắc) ·
    /// APPOINTMENT (đã hẹn ngày đến) · FORFEITED (D44: quá 30 ngày chưa nhận, khách mất khoản hoàn) · PAID.
    /// </summary>
    private static CashState CashStateOf(Payment p, IEnumerable<ActivityLog> logs, DateOnly today)
    {
        var list = logs.Where(l => l.EntityId == p.PaymentId).OrderBy(l => l.LoggedAt).ToList();
        // Hạn 30 ngày tính từ lần duyệt đầu; giao lại nhân viên (duyệt lại) chỉ đổi người phụ trách.
        var approved = list.FirstOrDefault(l => l.Action == FlowAction.CashApproved);
        var assigned = list.LastOrDefault(l => l.Action == FlowAction.CashApproved);
        var paid = list.LastOrDefault(l => l.Action == FlowAction.CashPaid);
        var lastCall = list.LastOrDefault(l => l.Action == FlowAction.CashCall);
        long? staffId = assigned != null && long.TryParse(Read(assigned, "staffId"), out var s) ? s : null;
        if (p.Status == "PAID") return new CashState("PAID", approved?.LoggedAt, staffId, null, 0, null, null, lastCall, paid);
        var forfeited = list.LastOrDefault(l => l.Action == FlowAction.CashForfeited);
        if (approved == null) return new CashState("WAITING_APPROVAL", null, null, null, 0, null, null, lastCall, null);

        var approvedDay = DateOnly.FromDateTime(approved.LoggedAt + VnOffset);
        var deadline = approvedDay.AddDays(CashRefundDays);
        var days = today.DayNumber - approvedDay.DayNumber;
        DateOnly? appointment = lastCall != null && DateOnly.TryParseExact(Read(lastCall, "appointmentDate"), "yyyy-MM-dd", Invariant, System.Globalization.DateTimeStyles.None, out var a) ? a : null;
        // D44: quá 30 ngày (tính từ lần duyệt đầu) chưa nhận → khách mất khoản hoàn; hết hạn hiện ngay, worker ghi sổ sau.
        if (forfeited != null || p.Status == "CANCELLED" || days > CashRefundDays)
            return new CashState("FORFEITED", approved.LoggedAt, staffId, deadline, days, null, appointment, lastCall, forfeited);
        if (appointment.HasValue && appointment.Value >= today)
        {
            return new CashState("APPOINTMENT", approved.LoggedAt, staffId, deadline, days, null, appointment, lastCall, null);
        }
        // Mốc gọi nhắc gần nhất đã tới mà chưa gọi sau mốc đó.
        int? milestone = CashReminderDays.Where(d => days >= d).Select(d => (int?)d).LastOrDefault();
        if (milestone.HasValue)
        {
            var milestoneUtc = UtcFromLocal(approvedDay.AddDays(milestone.Value), 0);
            if (lastCall == null || lastCall.LoggedAt < milestoneUtc)
            {
                return new CashState("REMIND", approved.LoggedAt, staffId, deadline, days, milestone, appointment, lastCall, null);
            }
        }
        return new CashState("READY", approved.LoggedAt, staffId, deadline, days, null, appointment, lastCall, null);
    }

    private static (string Source, string Reference, User Customer) CashOwner(Payment p,
        IReadOnlyDictionary<long, string>? incidentCodes = null) =>
        p.ReservationId != null
            ? ("RESERVATION", ReservationCode(p.Reservation), p.Reservation.Customer)
            : incidentCodes != null && incidentCodes.TryGetValue(p.PaymentId, out var caseCode)
                ? ("INCIDENT", caseCode, p.Contract.Customer)
                : ("DEPOSIT", ContractCode(p.Contract), p.Contract.Customer);

    /// <summary>D44: khoản hoàn do sự cố cơ sở (T13) — mã hồ sơ sự cố theo id khoản REFUND.</summary>
    private async Task<Dictionary<long, string>> IncidentCodesAsync(IEnumerable<long> paymentIds, CancellationToken ct)
    {
        var ids = paymentIds.ToList();
        if (ids.Count == 0) return [];
        return await dbContext.FacilityIncidents.AsNoTracking()
            .Where(i => i.RefundPaymentId != null && ids.Contains(i.RefundPaymentId.Value))
            .ToDictionaryAsync(i => i.RefundPaymentId!.Value, i => i.CaseCode, ct);
    }

    private async Task<IReadOnlyList<CashRefundDto>> ToCashDtosAsync(List<Payment> rows, CancellationToken ct)
    {
        var logs = await LogsAsync(PaymentEntity, rows.Select(p => p.PaymentId).ToList(), ct);
        var today = VnToday;
        var staffIds = logs.Where(l => l.Action == FlowAction.CashPaid && l.UserId != null).Select(l => l.UserId!.Value).Distinct().ToList();
        var names = await dbContext.Users.AsNoTracking().Where(u => staffIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName, ct);
        var incidents = await IncidentCodesAsync(rows.Select(p => p.PaymentId), ct);
        return rows.Select(p =>
            {
                var st = CashStateOf(p, logs, today);
                var (source, reference, customer) = CashOwner(p, incidents);
                var call = st.LastCall == null ? null
                    : $"{Read(st.LastCall, "result")} · {Local(st.LastCall.LoggedAt)}{(Read(st.LastCall, "note") is { Length: > 0 } n ? " · " + n : "")}";
                string? paidBy = st.Paid?.UserId is long uid && names.TryGetValue(uid, out var nm) ? nm : null;
                return new CashRefundDto(CashRefundCode(p.PaymentId), source, reference, customer.FullName, customer.Phone,
                    p.Amount, st.Status, Local(st.ApprovedAt), st.Deadline?.ToString("yyyy-MM-dd"), Math.Max(0, st.Days),
                    st.ReminderDay, st.Appointment?.ToString("yyyy-MM-dd"), call, Local(p.PaidAt), paidBy);
            })
            .OrderBy(d => d.Status == "PAID" ? 1 : 0)
            .ThenBy(d => d.ApprovedAt ?? "")
            .ToList();
    }

    public async Task<IReadOnlyList<CashRefundDto>> GetCashRefundsAsync(OpsActor actor, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var since = NowUtc.AddDays(-60);
        var rows = await CashRefundQuery(facility.FacilityId).AsNoTracking().AsSplitQuery()
            .Where(p => p.Status == "PENDING" || p.UpdatedAt >= since)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync(ct);
        return await ToCashDtosAsync(rows, ct);
    }

    private async Task<Payment> CashPaymentAsync(long facilityId, string code, CancellationToken ct)
    {
        var id = ParseCode(code, "CH-", "khoản hoàn tiền mặt");
        return await CashRefundQuery(facilityId).AsSplitQuery().FirstOrDefaultAsync(p => p.PaymentId == id, ct)
               ?? throw new KeyNotFoundException("Không tìm thấy khoản hoàn tiền mặt tại cơ sở của bạn.");
    }

    /// <summary>D42: quản lý duyệt chi tiền mặt theo lựa chọn của khách và giao việc cho nhân viên cùng cơ sở.</summary>
    public async Task<CashRefundDto> ApproveCashRefundAsync(OpsActor actor, string id, OpsAssignRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var staffCode = (request.StaffId ?? string.Empty).Trim();
        var staff = (await FacilityStaffAsync(facility.FacilityId, ct)).FirstOrDefault(u => StaffCode(u.UserId) == staffCode)
                    ?? throw new ArgumentException("Chọn nhân viên đang làm tại cơ sở.");
        var paymentId = ParseCode(id, "CH-", "khoản hoàn tiền mặt");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"cash-refund:{paymentId}", ct);
        var p = await CashPaymentAsync(facility.FacilityId, id, ct);
        if (p.Status != "PENDING" || p.Amount <= 0) throw new InvalidOperationException("Khoản hoàn không còn chờ xử lý.");
        var logs = await LogsAsync(PaymentEntity, [p.PaymentId], ct);
        var state = CashStateOf(p, logs, VnToday);
        if (state.Status == "FORFEITED") throw new InvalidOperationException("Đã quá 30 ngày, khách không còn nhận khoản hoàn này (D44).");
        // Duyệt lại chỉ để giao cho nhân viên khác; hạn 30 ngày vẫn tính từ lần duyệt đầu (CashStateOf).
        Log(actor.UserId, FlowAction.CashApproved, PaymentEntity, p.PaymentId, new
        {
            staffId = staff.UserId, staff = StaffCode(staff.UserId), amount = p.Amount, reassigned = state.ApprovedAt != null
        });
        p.UpdatedAt = NowUtc;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await ToCashDtosAsync([p], ct))[0];
    }

    /// <summary>D42/D43 · S10b: ghi kết quả gọi nhắc; hẹn ngày đến thì tạm dừng gọi nhắc đến ngày đó.</summary>
    public async Task<CashRefundDto> RecordCashRefundCallAsync(OpsActor actor, string id, CashRefundCallRequest request, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var result = (request.Result ?? string.Empty).Trim().ToUpperInvariant();
        if (!CallResults.Contains(result)) throw new ArgumentException("Chọn kết quả cuộc gọi.");
        var today = VnToday;
        if (result == "APPOINTMENT")
        {
            if (request.AppointmentDate is not DateOnly date) throw new ArgumentException("Nhập ngày khách hẹn đến quầy.");
            if (date < today) throw new ArgumentException("Ngày hẹn không được trước hôm nay.");
        }
        var paymentId = ParseCode(id, "CH-", "khoản hoàn tiền mặt");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"cash-refund:{paymentId}", ct);
        var p = await CashPaymentAsync(facility.FacilityId, id, ct);
        var logs = await LogsAsync(PaymentEntity, [p.PaymentId], ct);
        var state = CashStateOf(p, logs, today);
        if (state.Status is "PAID" or "WAITING_APPROVAL" or "FORFEITED") throw new InvalidOperationException("Khoản hoàn không ở bước chờ khách nhận.");
        if (result == "APPOINTMENT" && state.Deadline.HasValue && request.AppointmentDate > state.Deadline)
        {
            throw new ArgumentException($"Ngày hẹn phải trong hạn nhận tiền ({state.Deadline.Value:dd/MM/yyyy}).");
        }
        Log(actor.UserId, FlowAction.CashCall, PaymentEntity, p.PaymentId, new
        {
            result, appointmentDate = result == "APPOINTMENT" ? request.AppointmentDate?.ToString("yyyy-MM-dd") : null,
            note = Clip(request.Note, 500), milestone = state.ReminderDay, staff = StaffCode(actor.UserId)
        });
        p.UpdatedAt = NowUtc;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await ToCashDtosAsync([p], ct))[0];
    }

    /// <summary>D42 · S10: nhân viên tick đủ 4 mục rồi xác nhận đã chi; không lưu ảnh / số phiếu chi.</summary>
    public async Task<CashRefundDto> PayCashRefundAsync(OpsActor actor, string id, CashRefundPayRequest request, CancellationToken ct = default)
    {
        if (!(request.IdentityChecked && request.CodeChecked && request.AmountCounted && request.Signed))
        {
            throw new ArgumentException("Tick đủ 4 mục kiểm tra trước khi xác nhận đã chi.");
        }
        var facility = await FacilityOfAsync(actor, ct);
        var paymentId = ParseCode(id, "CH-", "khoản hoàn tiền mặt");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"cash-refund:{paymentId}", ct);
        var p = await CashPaymentAsync(facility.FacilityId, id, ct);
        var logs = await LogsAsync(PaymentEntity, [p.PaymentId], ct);
        var state = CashStateOf(p, logs, VnToday);
        switch (state.Status)
        {
            case "PAID": throw new InvalidOperationException("Khoản hoàn đã được chi.");
            case "WAITING_APPROVAL": throw new InvalidOperationException("Quản lý cơ sở chưa duyệt chi khoản này.");
            case "FORFEITED": throw new InvalidOperationException("Đã quá 30 ngày nhận tiền mặt, khách không còn nhận khoản hoàn này (D44).");
        }
        if (!actor.IsManager && state.AssignedStaffId.HasValue && state.AssignedStaffId != actor.UserId)
        {
            throw new UnauthorizedAccessException("Việc chi tiền này được giao cho nhân viên khác.");
        }
        var now = NowUtc;
        p.Status = "PAID";
        p.PaidAt = now;
        p.TransactionReference = $"CASH:{actor.UserId}:{(now + VnOffset):yyyyMMddHHmm}:{p.PaymentId}";
        p.UpdatedAt = now;
        var (source, reference, _) = CashOwner(p);
        Log(actor.UserId, FlowAction.CashPaid, PaymentEntity, p.PaymentId, new
        {
            amount = p.Amount, source, reference, staff = StaffCode(actor.UserId),
            checks = new[] { "IDENTITY", "CODE_PHONE", "AMOUNT_COUNTED", "SIGNED" }
        });
        if (p.ContractId != null)
        {
            Log(actor.UserId, "DEPOSIT_REFUND_CASH_PAID", LogEntity.Contract, p.ContractId.Value,
                new { refund = p.Amount, payment = CashRefundCode(p.PaymentId) });
        }
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await ToCashDtosAsync([p], ct))[0];
    }

    // =====================================================================
    // D44 · Khách đổi sang chuyển khoản trong 30 ngày; quá 30 ngày chưa nhận thì mất khoản hoàn
    // =====================================================================

    private IQueryable<Payment> CustomerCashQuery(long customerId) => dbContext.Payments
        .Include(p => p.Reservation).ThenInclude(r => r.Customer)
        .Include(p => p.Contract).ThenInclude(c => c.Unit)
        .Include(p => p.Contract).ThenInclude(c => c.Customer)
        .Include(p => p.Contract).ThenInclude(c => c.ReturnInspections)
        .Where(p => p.PaymentType == "REFUND" && p.PaymentMethod == CashMethod
                    && ((p.ReservationId != null && p.Reservation.CustomerId == customerId)
                        || (p.ReservationId == null && p.ContractId != null && p.Contract.CustomerId == customerId)));

    /// <summary>Khách xem khoản hoàn tiền mặt của mình (hạn nhận, ngày hẹn, đã nhận / đã mất).</summary>
    public async Task<IReadOnlyList<CashRefundDto>> GetCustomerCashRefundsAsync(long customerId, CancellationToken ct = default)
    {
        var rows = await CustomerCashQuery(customerId).AsNoTracking().AsSplitQuery().OrderBy(p => p.CreatedAt).ToListAsync(ct);
        return await ToCashDtosAsync(rows, ct);
    }

    /// <summary>
    /// D44: trong 30 ngày khách đổi khoản tiền mặt sang chuyển khoản vào tài khoản chính chủ (tên trùng hợp đồng).
    /// Khoản trở về luồng chuyển khoản (M08 / hoàn cọc / sự cố) để quản lý ghi mã giao dịch; việc chi tiền mặt và gọi nhắc dừng.
    /// </summary>
    public async Task<CashRefundDto> SwitchCashRefundToBankAsync(long customerId, string id, StorageProject.Core.DTOs.Evidence.RefundBankInput bank,
        CancellationToken ct = default)
    {
        var paymentId = ParseCode(id, "CH-", "khoản hoàn tiền mặt");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"cash-refund:{paymentId}", ct);
        var p = await CustomerCashQuery(customerId).AsSplitQuery().FirstOrDefaultAsync(x => x.PaymentId == paymentId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy khoản hoàn tiền mặt của bạn.");
        var logs = await LogsAsync(PaymentEntity, [p.PaymentId], ct);
        var state = CashStateOf(p, logs, VnToday);
        switch (state.Status)
        {
            case "PAID": throw new InvalidOperationException("Bạn đã nhận tiền mặt tại quầy.");
            case "FORFEITED": throw new InvalidOperationException("Đã quá 30 ngày nhận tiền mặt nên không đổi được sang chuyển khoản.");
        }
        if (p.Status != "PENDING") throw new InvalidOperationException("Khoản hoàn không còn chờ xử lý.");
        var (source, reference, customer) = CashOwner(p, await IncidentCodesAsync([p.PaymentId], ct));
        var account = RefundBank.Validate(bank with { Method = null }, customer.FullName);

        var now = NowUtc;
        switch (source)
        {
            case "RESERVATION":
                p.Reservation.RefundBankName = account.BankName;
                p.Reservation.RefundAccountNumber = account.AccountNumber;
                p.Reservation.RefundAccountHolder = account.AccountHolder;
                break;
            case "INCIDENT":
                var incident = await dbContext.FacilityIncidents.FirstAsync(i => i.RefundPaymentId == p.PaymentId, ct);
                incident.RefundBankName = account.BankName;
                incident.RefundAccountNumber = account.AccountNumber;
                incident.RefundAccountHolder = account.AccountHolder;
                break;
            default:
                var inspection = LatestInspection(p.Contract)
                                 ?? throw new InvalidOperationException("Không tìm thấy biên bản trả kho của khoản hoàn này.");
                inspection.RefundBankName = account.BankName;
                inspection.RefundAccountNumber = account.AccountNumber;
                inspection.RefundAccountHolder = account.AccountHolder;
                break;
        }
        p.PaymentMethod = "BANK_TRANSFER";
        p.DueDate = RefundDueDate(now);
        p.UpdatedAt = now;
        Log(customerId, FlowAction.CashSwitchedToBank, PaymentEntity, p.PaymentId, new
        {
            source, reference, amount = p.Amount, bank = account.BankName,
            accountLast4 = account.AccountNumber.Length > 4 ? account.AccountNumber[^4..] : account.AccountNumber,
            previousStatus = state.Status
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new CashRefundDto(CashRefundCode(p.PaymentId), source, reference, customer.FullName, customer.Phone, p.Amount,
            "SWITCHED_TO_BANK", Local(state.ApprovedAt), state.Deadline?.ToString("yyyy-MM-dd"), Math.Max(0, state.Days),
            null, null, null, null, null);
    }

    /// <summary>
    /// D44 · Tiến trình nền: khoản tiền mặt đã duyệt quá 30 ngày chưa nhận → khách mất khoản hoàn.
    /// Khoản REFUND chuyển CANCELLED (tham chiếu FORFEITED:{id}), ghi nhật ký hệ thống; không chi, không chuyển khoản.
    /// </summary>
    public async Task<int> ForfeitExpiredCashRefundsAsync(CancellationToken ct = default)
    {
        var cutoffUtc = UtcFromLocal(VnToday.AddDays(-CashRefundDays), 0); // duyệt trước ngày này (giờ VN) thì đã quá 30 ngày
        var ids = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == PaymentEntity && l.Action == FlowAction.CashApproved && l.EntityId != null)
            .GroupBy(l => l.EntityId!.Value)
            .Where(g => g.Min(l => l.LoggedAt) < cutoffUtc)
            .Select(g => g.Key)
            .ToListAsync(ct);
        var forfeited = 0;
        foreach (var paymentId in ids)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"cash-refund:{paymentId}", ct);
            var p = await dbContext.Payments.FirstOrDefaultAsync(x => x.PaymentId == paymentId && x.PaymentType == "REFUND"
                                                                      && x.PaymentMethod == CashMethod && x.Status == "PENDING", ct);
            if (p == null) continue;
            var logs = await LogsAsync(PaymentEntity, [p.PaymentId], ct);
            if (CashStateOf(p, logs, VnToday).Status != "FORFEITED") continue;
            var now = NowUtc;
            p.Status = "CANCELLED";
            p.TransactionReference = $"FORFEITED:{p.PaymentId}";
            p.UpdatedAt = now;
            Log(null, FlowAction.CashForfeited, PaymentEntity, p.PaymentId, new
            {
                amount = p.Amount, system = true, reason = "Quá 30 ngày khách không đến nhận tiền mặt (D44)"
            });
            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            forfeited++;
        }
        dbContext.ChangeTracker.Clear();
        return forfeited;
    }

    // =====================================================================
    // D42 · Việc tồn cuối ngày (22:00) — tên nhân viên, số việc chưa xong, chi tiết + lịch sử trong ngày
    // =====================================================================

    public async Task<DailyStaffReportDto> GetDailyReportAsync(OpsActor actor, DateOnly? date = null, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        return await BuildDailyReportAsync(facility.FacilityId, date ?? VnToday, ct);
    }

    internal async Task<DailyStaffReportDto> BuildDailyReportAsync(long facilityId, DateOnly day, CancellationToken ct)
    {
        var now = NowUtc;
        var fromUtc = UtcFromLocal(day, 0);
        var toUtc = UtcFromLocal(day.AddDays(1), 0);
        var endOfDay = now < toUtc ? now : toUtc;
        var staff = await FacilityStaffAsync(facilityId, ct);
        var staffIds = staff.Select(s => s.UserId).ToList();

        var returns = await dbContext.ReturnInspections.AsNoTracking()
            .Where(i => i.Status != "COMPLETED" && i.Status != "CANCELLED" && staffIds.Contains(i.StaffId)
                        && i.Contract.Unit.FacilityId == facilityId && i.CreatedAt < toUtc)
            .Select(i => new { i.StaffId, i.InspectionId, i.CreatedAt, Unit = i.Contract.Unit.UnitNumber })
            .ToListAsync(ct);
        var tickets = await dbContext.SupportTickets.AsNoTracking()
            .Where(t => t.AssignedStaffId != null && staffIds.Contains(t.AssignedStaffId.Value)
                        && (t.Status == "OPEN" || t.Status == "ASSIGNED" || t.Status == "IN_PROGRESS")
                        && (t.Contract != null ? t.Contract.Unit.FacilityId == facilityId : t.Unit != null && t.Unit.FacilityId == facilityId)
                        && t.CreatedAt < toUtc)
            .Select(t => new { StaffId = t.AssignedStaffId!.Value, t.TicketId, t.CreatedAt, t.Title })
            .ToListAsync(ct);
        var handovers = await dbContext.HandoverRecords.AsNoTracking()
            .Where(h => (h.Status == "SCHEDULED" || h.Status == "VERIFIED") && staffIds.Contains(h.StaffId)
                        && h.Contract.Unit.FacilityId == facilityId && h.CreatedAt < toUtc
                        && (h.ScheduledAt == null || h.ScheduledAt < toUtc))
            .Select(h => new { h.StaffId, h.HandoverId, h.CreatedAt, Unit = h.Contract.Unit.UnitNumber })
            .ToListAsync(ct);
        var cash = await CashRefundQuery(facilityId).AsNoTracking().AsSplitQuery().Where(p => p.Status == "PENDING").ToListAsync(ct);
        var cashLogs = await LogsAsync(PaymentEntity, cash.Select(p => p.PaymentId).ToList(), ct);
        var history = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.UserId != null && staffIds.Contains(l.UserId.Value) && l.LoggedAt >= fromUtc && l.LoggedAt < toUtc
                        && l.EntityType != "AUTH" && l.EntityType != "USER")
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);

        var rows = staff.Select(s =>
        {
            var pending = new List<(DateTime At, DailyTaskDto Task)>();
            pending.AddRange(returns.Where(r => r.StaffId == s.UserId).Select(r => (r.CreatedAt,
                new DailyTaskDto("RETURN", ReturnCode(r.InspectionId), $"Kiểm tra trả kho · ô {r.Unit}", Local(r.CreatedAt)!,
                    endOfDay - r.CreatedAt > InspectionSla))));
            pending.AddRange(tickets.Where(t => t.StaffId == s.UserId).Select(t => (t.CreatedAt,
                new DailyTaskDto("TICKET", TicketCode(t.TicketId), t.Title, Local(t.CreatedAt)!))));
            pending.AddRange(handovers.Where(h => h.StaffId == s.UserId).Select(h => (h.CreatedAt,
                new DailyTaskDto("HANDOVER", HandoverCode(h.HandoverId), $"Giao chìa khóa · ô {h.Unit}", Local(h.CreatedAt)!))));
            foreach (var p in cash)
            {
                var st = CashStateOf(p, cashLogs, day);
                if (st.AssignedStaffId != s.UserId || st.ApprovedAt == null) continue;
                var (_, reference, customer) = CashOwner(p);
                if (st.Status == "REMIND")
                    pending.Add((st.ApprovedAt.Value, new DailyTaskDto("CASH_CALL", CashRefundCode(p.PaymentId),
                        $"Gọi nhắc nhận tiền hoàn (ngày {st.ReminderDay}) · {customer.FullName} · {reference}", Local(st.ApprovedAt)!)));
                else if ((st.Status == "APPOINTMENT" && st.Appointment == day) || (st.Status == "READY" && st.Days == 0))
                    pending.Add((st.ApprovedAt.Value, new DailyTaskDto("CASH_PAY", CashRefundCode(p.PaymentId),
                        $"Chi tiền hoàn {Money(p.Amount)} · {customer.FullName} · {reference}", Local(st.ApprovedAt)!)));
            }
            var ordered = pending.OrderBy(x => x.At).Select(x => x.Task).ToList(); // FIFO, không ưu tiên loại việc (D42)
            var done = history.Where(l => l.UserId == s.UserId).ToList();
            return new DailyStaffRowDto(StaffCode(s.UserId), s.FullName, done.Count, ordered.Count,
                ordered.FirstOrDefault()?.At,
                ordered,
                done.Select(l => new DailyTaskDto(l.Action, $"{l.EntityType}:{l.EntityId}", HistoryLabel(l), Local(l.LoggedAt)!)).ToList());
        })
        .OrderByDescending(r => r.Pending).ThenBy(r => r.FullName)
        .ToList();
        return new DailyStaffReportDto(day.ToString("yyyy-MM-dd"), Local(now)!, rows);
    }

    private static string HistoryLabel(ActivityLog l) => l.Action switch
    {
        LogAction.PaymentConfirmed => "Xác nhận đã thu",
        LogAction.CustomerVerified => "Xác minh khách nhận kho",
        LogAction.HandoverCompleted or "PHYSICAL_KEY_RECEIVED" => "Giao chìa khóa",
        LogAction.ReturnInspected => "Gửi biên bản trả kho",
        LogAction.TicketResponse => "Phản hồi yêu cầu hỗ trợ",
        FlowAction.DeductionRecheck => "Kiểm tra lại phương án khách",
        FlowAction.CashCall => "Gọi nhắc nhận tiền hoàn",
        FlowAction.CashPaid => "Chi tiền hoàn tại quầy",
        "OVERDUE_REMOVAL_RECORDED" => "Lập biên bản xử lý đồ quá hạn",
        _ => l.Action
    };

    /// <summary>D42: 22:00 mỗi ngày lưu báo cáo (chuông cho quản lý) một lần cho mỗi cơ sở. Trả số cơ sở đã ghi.</summary>
    public async Task<int> WriteDailyReportsAsync(CancellationToken ct = default)
    {
        var nowLocal = NowUtc + VnOffset;
        if (nowLocal.Hour < DailyReportHour) return 0;
        var day = DateOnly.FromDateTime(nowLocal);
        var dayText = day.ToString("yyyy-MM-dd");
        var fromUtc = UtcFromLocal(day, 0);
        var facilities = await dbContext.Facilities.AsNoTracking().Select(f => f.FacilityId).ToListAsync(ct);
        var written = 0;
        foreach (var fid in facilities)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"daily-report:{fid}:{dayText}", ct);
            var exists = await dbContext.ActivityLogs.AnyAsync(l => l.Action == FlowAction.DailyReport && l.EntityType == FacilityEntity
                                                                    && l.EntityId == fid && l.LoggedAt >= fromUtc, ct);
            if (exists) continue;
            var managerId = await FacilityManagerIdAsync(fid, ct);
            var report = await BuildDailyReportAsync(fid, day, ct);
            dbContext.ActivityLogs.Add(new ActivityLog
            {
                UserId = managerId, // người nhận chuông; null khi cơ sở chưa có quản lý
                Action = FlowAction.DailyReport,
                EntityType = FacilityEntity,
                EntityId = fid,
                NewValue = System.Text.Json.JsonSerializer.Serialize(new
                {
                    date = dayText,
                    staff = report.Staff.Select(r => new { r.StaffId, r.FullName, r.Pending, r.Done })
                }),
                LoggedAt = NowUtc
            });
            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            written++;
        }
        return written;
    }
}
