using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// M02 · Luồng phản hồi và tự khắc phục hư hỏng (B10 / D32 / D34 / T23).
/// Khách hàng: GET /api/damage-cases, POST /api/damage-cases/actions.
/// Quản lý cơ sở: GET /api/ops/damage-cases, POST /api/ops/damage-cases/actions.
/// </summary>
public partial class FacilityOpsService
{
    private const string DamageCasePrefix = "HH-";

    internal class DamageWorkflowState
    {
        public int Version { get; set; } = 1;
        public string Status { get; set; } = "AWAITING_RESPONSE";
        public DamageResponseDto? Response { get; set; }
        public DamageDecisionDto? Decision { get; set; }
        public string? Deadline { get; set; }
        public DamageRemediationDto? Remediation { get; set; }
        public DamageInspectionDto? Inspection { get; set; }
        public List<DamageHistoryDto> History { get; set; } = [];
    }

    public async Task<DamageCaseListDto> GetDamageCasesAsync(OpsActor actor, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);

        var inspections = await dbContext.ReturnInspections
            .AsNoTracking()
            .Include(i => i.Contract).ThenInclude(c => c.Unit)
            .Include(i => i.Contract).ThenInclude(c => c.Customer)
            .Include(i => i.Contract).ThenInclude(c => c.Payments)
            .Include(i => i.Staff)
            .Where(i => i.Contract.Unit.FacilityId == facility.FacilityId && i.DamageFee > 0)
            .OrderByDescending(i => i.InspectionId)
            .ToListAsync(ct);

        var inspectionIds = inspections.Select(i => i.InspectionId).ToList();
        var allPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, inspectionIds, ct);
        var allLogs = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.EntityType == "DAMAGE_CASE" && l.EntityId != null && inspectionIds.Contains(l.EntityId.Value))
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);

        var items = new List<DamageCaseDto>();
        foreach (var i in inspections)
        {
            var state = ExtractDamageWorkflowState(allLogs, i.InspectionId);
            items.Add(await MapToDamageCaseDtoAsync(i, state, allPhotos.GetValueOrDefault(i.InspectionId, []), ct));
        }

        return new DamageCaseListDto(items);
    }

    public async Task<DamageCaseListDto> GetCustomerDamageCasesAsync(long customerId, CancellationToken ct = default)
    {
        var inspections = await dbContext.ReturnInspections
            .AsNoTracking()
            .Include(i => i.Contract).ThenInclude(c => c.Unit)
            .Include(i => i.Contract).ThenInclude(c => c.Customer)
            .Include(i => i.Contract).ThenInclude(c => c.Payments)
            .Include(i => i.Staff)
            .Where(i => i.Contract.CustomerId == customerId && i.DamageFee > 0)
            .OrderByDescending(i => i.InspectionId)
            .ToListAsync(ct);

        var inspectionIds = inspections.Select(i => i.InspectionId).ToList();
        var allPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, inspectionIds, ct);
        var allLogs = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.EntityType == "DAMAGE_CASE" && l.EntityId != null && inspectionIds.Contains(l.EntityId.Value))
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);

        var items = new List<DamageCaseDto>();
        foreach (var i in inspections)
        {
            var state = ExtractDamageWorkflowState(allLogs, i.InspectionId);
            items.Add(await MapToDamageCaseDtoAsync(i, state, allPhotos.GetValueOrDefault(i.InspectionId, []), ct));
        }

        return new DamageCaseListDto(items);
    }

    public async Task<DamageCaseReceiptDto> HandleDamageActionAsync(OpsActor actor, DamageCaseActionRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();
        if (action is not ("DECIDE_DAMAGE_RESPONSE" or "INSPECT_DAMAGE_REMEDIATION"))
        {
            throw new ArgumentException("Thao tác không đúng phạm vi tài khoản.");
        }

        var inspectionId = ParseDamageCaseId(request.Id);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"damage-case:{inspectionId}", ct);

        var inspection = await dbContext.ReturnInspections
            .Include(i => i.Contract).ThenInclude(c => c.Unit)
            .Include(i => i.Contract).ThenInclude(c => c.Customer)
            .Include(i => i.Contract).ThenInclude(c => c.Payments)
            .Include(i => i.Staff)
            .FirstOrDefaultAsync(i => i.InspectionId == inspectionId && i.Contract.Unit.FacilityId == facility.FacilityId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy hồ sơ hư hỏng #{request.Id}.");

        var settlementStatus = GetSettlementStatus(inspection.Contract);
        if (settlementStatus != "OPEN")
        {
            throw new InvalidOperationException("Hồ sơ đã chốt đối soát hoặc chưa có trạng thái đối soát hợp lệ. Vui lòng liên hệ cơ sở.");
        }

        var state = await GetDamageWorkflowStateAsync(inspectionId, ct);
        if (request.ExpectedVersion != state.Version)
        {
            throw new OpsConflictException("Hồ sơ đã thay đổi. Vui lòng tải lại trước khi gửi.");
        }

        var now = DateTime.UtcNow;
        if (action == "DECIDE_DAMAGE_RESPONSE")
        {
            if (state.Status != "RESPONSE_SUBMITTED")
            {
                throw new InvalidOperationException("Hồ sơ không ở bước chờ cơ sở xử lý.");
            }

            var decision = (request.Decision ?? string.Empty).Trim().ToUpperInvariant();
            if (decision is not ("ALLOW" or "REJECT"))
            {
                throw new ArgumentException("Chọn quyết định của cơ sở.");
            }

            var note = (request.Note ?? string.Empty).Trim();
            if (decision == "REJECT")
            {
                if (string.IsNullOrEmpty(note))
                {
                    throw new ArgumentException("Vui lòng nhập lý do xử lý.");
                }
                state.Status = "REJECTED";
                state.Decision = new DamageDecisionDto("REJECT", note, now.ToString("O"));
            }
            else // ALLOW
            {
                var deadlineRaw = (request.Deadline ?? string.Empty).Trim();
                if (string.IsNullOrEmpty(deadlineRaw))
                {
                    throw new ArgumentException("Chọn hạn khắc phục theo giờ Việt Nam.");
                }

                DateTime deadlineUtc;
                if (DateTime.TryParse(deadlineRaw, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var parsed))
                {
                    deadlineUtc = parsed;
                }
                else if (DateTime.TryParse(deadlineRaw, out var localParsed))
                {
                    deadlineUtc = localParsed.ToUniversalTime();
                }
                else
                {
                    throw new ArgumentException("Hạn khắc phục không hợp lệ.");
                }

                if (deadlineUtc <= now)
                {
                    throw new ArgumentException("Hạn khắc phục phải ở tương lai theo giờ Việt Nam.");
                }

                state.Status = "REMEDIATION_ALLOWED";
                state.Deadline = deadlineUtc.ToString("O");
                state.Decision = new DamageDecisionDto("ALLOW", string.IsNullOrEmpty(note) ? null : note, now.ToString("O"));
            }
        }
        else if (action == "INSPECT_DAMAGE_REMEDIATION")
        {
            if (state.Status != "AWAITING_INSPECTION")
            {
                throw new InvalidOperationException("Khách chưa báo khắc phục xong hoặc hồ sơ đã được kiểm tra.");
            }

            var result = (request.Result ?? string.Empty).Trim().ToUpperInvariant();
            if (result is not ("PASS" or "FAIL"))
            {
                throw new ArgumentException("Chọn kết quả kiểm tra.");
            }

            var note = (request.Note ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(note))
            {
                throw new ArgumentException("Vui lòng nhập ghi chú kiểm tra.");
            }

            if (result == "PASS")
            {
                state.Status = "REMEDIATED";
                state.Inspection = new DamageInspectionDto("PASS", note, now.ToString("O"));
            }
            else
            {
                state.Status = "REMEDIATION_FAILED";
                state.Inspection = new DamageInspectionDto("FAIL", note, now.ToString("O"));
            }
        }

        state.Version++;
        var actorUser = await dbContext.Users.FindAsync([actor.UserId], ct);
        state.History.Add(new DamageHistoryDto(action, actorUser?.FullName ?? "Quản lý cơ sở", now.ToString("O")));

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = actor.UserId,
            Action = action,
            EntityType = "DAMAGE_CASE",
            EntityId = inspectionId,
            NewValue = JsonSerializer.Serialize(state),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var photos = (await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, [inspectionId], ct))
            .GetValueOrDefault(inspectionId, []);
        var dto = await MapToDamageCaseDtoAsync(inspection, state, photos, ct);
        return new DamageCaseReceiptDto(dto);
    }

    public async Task<DamageCaseReceiptDto> HandleCustomerDamageActionAsync(long customerId, DamageCaseActionRequest request, CancellationToken ct = default)
    {
        var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();
        if (action is not ("RESPOND_DAMAGE" or "REPORT_DAMAGE_REMEDIATION"))
        {
            throw new ArgumentException("Thao tác không đúng phạm vi tài khoản.");
        }

        var inspectionId = ParseDamageCaseId(request.Id);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"damage-case:{inspectionId}", ct);

        var inspection = await dbContext.ReturnInspections
            .Include(i => i.Contract).ThenInclude(c => c.Unit)
            .Include(i => i.Contract).ThenInclude(c => c.Customer)
            .Include(i => i.Contract).ThenInclude(c => c.Payments)
            .Include(i => i.Staff)
            .FirstOrDefaultAsync(i => i.InspectionId == inspectionId && i.Contract.CustomerId == customerId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy hồ sơ hư hỏng #{request.Id}.");

        var settlementStatus = GetSettlementStatus(inspection.Contract);
        if (settlementStatus != "OPEN")
        {
            throw new InvalidOperationException("Hồ sơ đã chốt đối soát hoặc chưa có trạng thái đối soát hợp lệ. Vui lòng liên hệ cơ sở.");
        }

        var state = await GetDamageWorkflowStateAsync(inspectionId, ct);
        if (request.ExpectedVersion != state.Version)
        {
            throw new OpsConflictException("Hồ sơ đã thay đổi. Vui lòng tải lại trước khi gửi.");
        }

        var now = DateTime.UtcNow;
        if (action == "RESPOND_DAMAGE")
        {
            if (state.Status != "AWAITING_RESPONSE")
            {
                throw new InvalidOperationException("Hồ sơ này đã có phản hồi. Vui lòng tải lại.");
            }

            var choice = (request.Choice ?? string.Empty).Trim().ToUpperInvariant();
            if (choice is not ("AGREE" or "REMEDIATE" or "DISPUTE"))
            {
                throw new ArgumentException("Chọn một phương án phản hồi.");
            }

            var note = (request.Note ?? string.Empty).Trim();
            if (choice != "AGREE" && string.IsNullOrEmpty(note))
            {
                throw new ArgumentException("Vui lòng nhập nội dung phản hồi.");
            }
            if (note.Length > 1000)
            {
                throw new ArgumentException("nội dung phản hồi không quá 1.000 ký tự.");
            }

            var files = new List<DamageFileDto>();
            if (request.Photos != null && request.Photos.Count > 0)
            {
                var decoded = EvidencePhotos.Decode(request.Photos, required: false, what: "ảnh đính kèm");
                EvidencePhotos.Attach(dbContext, decoded, EvidencePhotos.ReturnInspection, inspectionId, customerId, now);
                files = decoded.Select(d => new DamageFileDto(d.FileName, d.ContentType, d.Data.Length)).ToList();
            }

            state.Status = choice == "AGREE" ? "CUSTOMER_ACCEPTED" : "RESPONSE_SUBMITTED";
            state.Response = new DamageResponseDto(choice, note, now.ToString("O"), files);
        }
        else if (action == "REPORT_DAMAGE_REMEDIATION")
        {
            if (state.Status != "REMEDIATION_ALLOWED")
            {
                throw new InvalidOperationException("Cơ sở chưa cho phép khắc phục hoặc bạn đã gửi kết quả.");
            }

            if (string.IsNullOrEmpty(state.Deadline) ||
                !DateTime.TryParse(state.Deadline, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var deadlineUtc) ||
                deadlineUtc <= now)
            {
                throw new InvalidOperationException("Đã hết hạn khắc phục. Liên hệ cơ sở để được xử lý; không tự gửi lại.");
            }

            var note = (request.Note ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(note))
            {
                throw new ArgumentException("Vui lòng nhập nội dung đã khắc phục.");
            }
            if (note.Length > 1000)
            {
                throw new ArgumentException("nội dung đã khắc phục không quá 1.000 ký tự.");
            }

            var files = new List<DamageFileDto>();
            if (request.Photos != null && request.Photos.Count > 0)
            {
                var decoded = EvidencePhotos.Decode(request.Photos, required: false, what: "ảnh khắc phục");
                EvidencePhotos.Attach(dbContext, decoded, EvidencePhotos.ReturnInspection, inspectionId, customerId, now);
                files = decoded.Select(d => new DamageFileDto(d.FileName, d.ContentType, d.Data.Length)).ToList();
            }

            state.Status = "AWAITING_INSPECTION";
            state.Remediation = new DamageRemediationDto(note, now.ToString("O"), files);
        }

        state.Version++;
        var customerUser = await dbContext.Users.FindAsync([customerId], ct);
        state.History.Add(new DamageHistoryDto(action, customerUser?.FullName ?? "Khách", now.ToString("O")));

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = customerId,
            Action = action,
            EntityType = "DAMAGE_CASE",
            EntityId = inspectionId,
            NewValue = JsonSerializer.Serialize(state),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var photos = (await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, [inspectionId], ct))
            .GetValueOrDefault(inspectionId, []);
        var dto = await MapToDamageCaseDtoAsync(inspection, state, photos, ct);
        return new DamageCaseReceiptDto(dto);
    }

    private static string GetSettlementStatus(RentalContract contract)
    {
        return (contract.Status is "COMPLETED" or "TERMINATED" or "CANCELLED") ||
               contract.Payments.Any(p => p.PaymentType == "REFUND" && p.Status == "PAID")
            ? "FINALIZED"
            : "OPEN";
    }

    private async Task<DamageWorkflowState> GetDamageWorkflowStateAsync(long inspectionId, CancellationToken ct)
    {
        var log = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.EntityType == "DAMAGE_CASE" && l.EntityId == inspectionId)
            .OrderByDescending(l => l.LoggedAt)
            .FirstOrDefaultAsync(ct);

        if (log != null && !string.IsNullOrWhiteSpace(log.NewValue))
        {
            try
            {
                var state = JsonSerializer.Deserialize<DamageWorkflowState>(log.NewValue);
                if (state != null) return state;
            }
            catch { }
        }

        return new DamageWorkflowState();
    }

    private static DamageWorkflowState ExtractDamageWorkflowState(List<ActivityLog> allLogs, long inspectionId)
    {
        var log = allLogs.LastOrDefault(l => l.EntityId == inspectionId);
        if (log != null && !string.IsNullOrWhiteSpace(log.NewValue))
        {
            try
            {
                var state = JsonSerializer.Deserialize<DamageWorkflowState>(log.NewValue);
                if (state != null) return state;
            }
            catch { }
        }
        return new DamageWorkflowState();
    }

    private async Task<DamageCaseDto> MapToDamageCaseDtoAsync(
        ReturnInspection i,
        DamageWorkflowState state,
        IReadOnlyList<EvidencePhotoDto> photos,
        CancellationToken ct)
    {
        var contract = i.Contract;
        var deposit = contract.DepositAmount;
        var damageAmount = i.DamageFee;
        var damageDeduction = state.Status == "REMEDIATED" ? 0m : damageAmount;

        // D32: Other deductions = cleaning fee + overdue fee
        var cleaningFee = i.CleaningRequired ? (i.CleaningFee > 0 ? i.CleaningFee : CleaningFeeFor(deposit)) : 0m;

        var moveOutDate = DateOnly.FromDateTime((i.CreatedAt != default ? i.CreatedAt : (i.InspectedAt ?? NowUtc)) + VnOffset);
        var overdueDays = Math.Max(0, moveOutDate.DayNumber - contract.EndDate.DayNumber);
        decimal overdueFee = 0;
        if (overdueDays > 0)
        {
            var policy = await OpsRules.FindApplicablePolicyAsync(dbContext, "OVERDUE", contract.Unit.FacilityId,
                contract.Unit.UnitTypeId, moveOutDate, ct);
            if (policy != null)
            {
                overdueFee = RefundPolicy.OverdueFeeFor(policy.CalculationType, policy.Value, deposit, overdueDays, maxCap: deposit);
            }
            else
            {
                overdueFee = Math.Min(deposit, deposit * 0.05m * overdueDays);
            }
        }

        var otherDeductions = cleaningFee + overdueFee;
        var refundPreview = Math.Max(0, deposit - Math.Min(deposit, otherDeductions + damageDeduction));
        var refundIfRemedied = Math.Max(0, deposit - Math.Min(deposit, otherDeductions));

        var caseId = $"{DamageCasePrefix}{i.InspectionId:D4}";
        var contractId = ContractCode(contract);
        var item = !string.IsNullOrWhiteSpace(i.DamageItem)
            ? i.DamageItem
            : (!string.IsNullOrWhiteSpace(i.DamageDescription) ? i.DamageDescription : "Hư hỏng thiết bị kho");

        var recordedBy = i.Staff?.FullName ?? "Trần Văn Long";
        var recordedAt = (i.InspectedAt ?? i.CreatedAt).ToString("O");

        return new DamageCaseDto(
            Id: caseId,
            ContractId: contractId,
            OwnerId: contract.CustomerId,
            FacilityId: contract.Unit.FacilityId,
            Unit: contract.Unit.UnitNumber,
            Item: item,
            DamageAmount: damageAmount,
            DamageDeduction: damageDeduction,
            Deposit: deposit,
            OtherDeductions: otherDeductions,
            RefundPreview: refundPreview,
            RefundIfRemedied: refundIfRemedied,
            Status: state.Status,
            Version: state.Version,
            SettlementStatus: GetSettlementStatus(contract),
            RecordedBy: recordedBy,
            RecordedAt: recordedAt,
            Photos: photos,
            Response: state.Response,
            Decision: state.Decision,
            Deadline: state.Deadline,
            Remediation: state.Remediation,
            Inspection: state.Inspection,
            History: state.History
        );
    }

    private static long ParseDamageCaseId(string? code) =>
        ParseCode(code, DamageCasePrefix, "hồ sơ hư hỏng");
}
