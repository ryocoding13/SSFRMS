using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// T13 · Sự cố do cơ sở (D32). Luồng: quản lý ghi nhận (DRAFT) → gửi phương án cho khách (PROPOSED, giữ ô thay thế)
/// → khách tự chọn đổi ô (TRANSFER_PENDING) hoặc kết thúc (TERMINATION_PENDING, khai tài khoản chính chủ)
/// → quản lý xác nhận đã chuyển đồ (TRANSFERRED: ô cũ MAINTENANCE, ô mới OCCUPIED, mã cũ hết hiệu lực, cấp mã ô mới)
///   hoặc chốt kết thúc (TERMINATED: hợp đồng kết thúc, khoản hoàn PENDING = tháng đang thuê + tháng chưa dùng + 100% cọc).
/// Mỗi thao tác kiểm expectedVersion (409 khi cũ), khoá theo hợp đồng, server tự lấy giờ / tiền / chủ hợp đồng.
/// Không có API thu hồi mã thủ công; mã ô cũ chỉ đổi khi hoàn tất chuyển.
/// </summary>
public partial class FacilityOpsService
{
    private static readonly string[] OpenIncidentStatuses = ["DRAFT", "PROPOSED", "TRANSFER_PENDING", "TERMINATION_PENDING"];
    private static readonly Regex CaseCodePattern = new(@"^SC-(\d+)-(\d+)$");
    private const string IncidentPhotoOwner = "INCIDENT";

    // ------------------------------------------------------------------ đọc

    public async Task<IncidentListDto> GetIncidentsAsync(OpsActor actor, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var fid = facility.FacilityId;
        var since = NowUtc.AddDays(-90);
        var incidents = await IncidentQuery().AsNoTracking().AsSplitQuery()
            .Where(i => i.FacilityId == fid && (OpenIncidentStatuses.Contains(i.Status) || i.UpdatedAt >= since))
            .ToListAsync(ct);

        // Hợp đồng đủ điều kiện mà chưa có hồ sơ mở → mô tả nháp có mã/phiên bản do server cấp (chưa lưu cho tới khi SAVE/SEND).
        var openContracts = incidents.Where(i => OpenIncidentStatuses.Contains(i.Status)).Select(i => i.ContractId).ToHashSet();
        var eligible = await dbContext.RentalContracts.AsNoTracking()
            .Include(c => c.Customer)
            .Include(c => c.Unit).ThenInclude(u => u.UnitType)
            .Where(c => c.Unit.FacilityId == fid && (c.Status == "ACTIVE" || c.Status == "EXPIRING"))
            .ToListAsync(ct);
        eligible = eligible.Where(c => !openContracts.Contains(c.ContractId)).OrderBy(c => c.Unit.UnitNumber).ToList();
        var counts = await IncidentCountsAsync(eligible.Select(c => c.ContractId).ToList(), ct);

        var ctx = await IncidentUnitsAsync(fid, ct);
        var extras = await IncidentExtrasAsync(incidents, ct);
        var items = incidents
            .OrderBy(i => OpenIncidentStatuses.Contains(i.Status) ? 0 : 1).ThenByDescending(i => i.UpdatedAt)
            .Select(i => ToIncidentDto(i.CaseCode, i.Version, i.Status, i.Contract, i.OldUnit, i, ctx, extras))
            .Concat(eligible.Select(c => ToIncidentDto(
                $"SC-{c.ContractId:0000}-{counts.GetValueOrDefault(c.ContractId) + 1}", 1, "DRAFT", c, c.Unit, null, ctx, extras)))
            .ToList();
        return new IncidentListDto(items);
    }

    /// <summary>Khách chỉ thấy hồ sơ đã gửi (không thấy nháp) của hợp đồng mình.</summary>
    public async Task<IncidentListDto> GetCustomerIncidentsAsync(long customerId, CancellationToken ct = default)
    {
        var incidents = await IncidentQuery().AsNoTracking().AsSplitQuery()
            .Where(i => i.Contract.CustomerId == customerId && i.Status != "DRAFT")
            .ToListAsync(ct);
        var extras = await IncidentExtrasAsync(incidents, ct);
        var contexts = new Dictionary<long, IncidentUnitContext>();
        foreach (var fid in incidents.Select(i => i.FacilityId).Distinct()) contexts[fid] = await IncidentUnitsAsync(fid, ct);
        return new IncidentListDto(incidents.OrderByDescending(i => i.UpdatedAt)
            .Select(i => ToIncidentDto(i.CaseCode, i.Version, i.Status, i.Contract, i.OldUnit, i, contexts[i.FacilityId], extras))
            .ToList());
    }

    // ------------------------------------------------------------------ quản lý ghi nhận / gửi phương án

    public async Task<IncidentReceiptDto> SaveIncidentAsync(OpsActor actor, IncidentActionRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var action = (request.Action ?? string.Empty).Trim();
        if (action is not ("SAVE_INCIDENT" or "SEND_INCIDENT_PROPOSAL")) throw new ArgumentException("Thao tác sự cố không hợp lệ.");
        var facility = await FacilityOfAsync(actor, ct);
        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length == 0) throw new ArgumentException("Vui lòng mô tả sự cố.");
        if (description.Length > 1000) throw new ArgumentException("Nội dung không quá 1.000 ký tự.");
        var affectedAt = ParseInstant(request.AffectedAt, "thời điểm xảy ra sự cố");
        if (affectedAt > NowUtc.AddMinutes(1)) throw new ArgumentException("Thời điểm thực tế không được ở tương lai.");
        if (request.Confirmed != true) throw new ArgumentException("Cần xác nhận sự cố ảnh hưởng quyền sử dụng kho.");
        var proposal = (request.Proposal ?? string.Empty).Trim();
        if (proposal is not ("TRANSFER" or "TERMINATE")) throw new ArgumentException("Chọn phương án đề xuất cho khách.");
        var photos = EvidencePhotos.Decode(request.Photos, required: false, what: "sự cố");
        var (contractId, sequence) = ParseCaseCode(request.Id);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"incident-contract:{contractId}", ct);
        var now = NowUtc;
        var incident = await IncidentQuery().AsSplitQuery()
            .FirstOrDefaultAsync(i => i.CaseCode == request.Id && i.FacilityId == facility.FacilityId, ct);
        if (incident == null)
        {
            var contract = await dbContext.RentalContracts
                               .Include(c => c.Customer)
                               .Include(c => c.Unit).ThenInclude(u => u.UnitType)
                               .FirstOrDefaultAsync(c => c.ContractId == contractId && c.Unit.FacilityId == facility.FacilityId, ct)
                           ?? throw new KeyNotFoundException("Không tìm thấy hợp đồng tại cơ sở của bạn.");
            if (await dbContext.FacilityIncidents.AnyAsync(i => i.ContractId == contractId && OpenIncidentStatuses.Contains(i.Status), ct)
                || sequence != await dbContext.FacilityIncidents.CountAsync(i => i.ContractId == contractId, ct) + 1
                || request.ExpectedVersion != 1)
            {
                throw new OpsConflictException("Hồ sơ đã thay đổi. Tải lại trước khi gửi tiếp.");
            }
            incident = new FacilityIncident
            {
                CaseCode = request.Id!, ContractId = contractId, FacilityId = facility.FacilityId, OldUnitId = contract.UnitId,
                Status = "DRAFT", Version = 1, CreatedBy = actor.UserId, CreatedAt = now, UpdatedAt = now,
                Contract = contract, OldUnit = contract.Unit
            };
            dbContext.FacilityIncidents.Add(incident);
        }
        else
        {
            if (request.ExpectedVersion != incident.Version) throw new OpsConflictException("Hồ sơ đã thay đổi. Tải lại trước khi gửi tiếp.");
            if (incident.Status != "DRAFT") throw new InvalidOperationException("Phương án đã gửi; không sửa lựa chọn khách đã nhận.");
        }
        RequireIncidentContract(incident.Contract);

        StorageUnit? target = null;
        if (proposal == "TRANSFER")
        {
            var ctx = await IncidentUnitsAsync(facility.FacilityId, ct);
            var candidates = CandidatesFor(incident.Contract, incident.CaseCode, incident.OldUnitId, ctx);
            var unit = candidates.FirstOrDefault(u => u.UnitId.ToString(CultureInfo.InvariantCulture) == request.TargetUnitId);
            if (unit == null) throw new InvalidOperationException("Ô thay thế phải trống, tương đương và thuộc đúng cơ sở. Tải lại danh sách ô.");
            if (request.ExpectedTargetVersion != ctx.VersionOf(unit.UnitId)) throw new OpsConflictException("Ô thay thế vừa thay đổi. Tải lại danh sách ô.");
            target = await dbContext.StorageUnits.FirstAsync(u => u.UnitId == unit.UnitId, ct);
        }

        incident.Description = description;
        incident.AffectedAt = affectedAt;
        incident.Confirmed = true;
        incident.Proposal = proposal;
        incident.TargetUnitId = target?.UnitId;
        if (action == "SEND_INCIDENT_PROPOSAL")
        {
            incident.Status = "PROPOSED";
            // Giữ ô thay thế cho đúng hồ sơ này tới khi khách chọn (chống hai hợp đồng cùng giữ một ô).
            if (target != null) SetUnitStatus(target, "RESERVED", actor.UserId, $"Giữ cho hồ sơ sự cố {incident.CaseCode}");
        }
        incident.Version += 1;
        incident.UpdatedAt = now;
        await dbContext.SaveChangesAsync(ct);

        var existing = await dbContext.EvidencePhotos.AsNoTracking()
            .Where(p => p.OwnerType == IncidentPhotoOwner && p.OwnerId == incident.IncidentId)
            .Select(p => new { p.FileName, p.SizeBytes })
            .ToListAsync(ct);
        var fresh = photos.Where(p => !existing.Any(e => e.FileName == p.FileName && e.SizeBytes == p.Data.Length)).ToList();
        if (existing.Count + fresh.Count > 20) throw new ArgumentException("Mỗi hồ sơ sự cố tối đa 20 ảnh.");
        EvidencePhotos.Attach(dbContext, fresh, IncidentPhotoOwner, incident.IncidentId, actor.UserId, now);
        LogIncident(actor.UserId, action, incident, new { proposal, target = target?.UnitNumber, photos = fresh.Count });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new IncidentReceiptDto(await IncidentDtoAsync(incident.CaseCode, ct));
    }

    // ------------------------------------------------------------------ khách tự chọn

    public async Task<IncidentReceiptDto> ChooseIncidentOptionAsync(long customerId, string contractCode, IncidentActionRequest request, CancellationToken ct = default)
    {
        if ((request.Action ?? string.Empty).Trim() != "CHOOSE_INCIDENT_OPTION") throw new ArgumentException("Thao tác sự cố không hợp lệ.");
        var choice = (request.Choice ?? string.Empty).Trim();
        if (choice is not ("TRANSFER" or "TERMINATE")) throw new ArgumentException("Chọn phương án hỗ trợ.");
        var note = (request.Note ?? string.Empty).Trim();
        if (note.Length > 1000) throw new ArgumentException("Nội dung không quá 1.000 ký tự.");
        var contractId = ParseCode(contractCode, "HĐ-", "hợp đồng");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"incident-contract:{contractId}", ct);
        var incident = await IncidentQuery().AsSplitQuery()
                           .FirstOrDefaultAsync(i => i.CaseCode == request.Id && i.ContractId == contractId && i.Contract.CustomerId == customerId, ct)
                       ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ sự cố của bạn.");
        if (request.ExpectedVersion != incident.Version) throw new OpsConflictException("Hồ sơ đã thay đổi. Tải lại trước khi gửi tiếp.");
        if (incident.Status != "PROPOSED") throw new InvalidOperationException("Hồ sơ không còn ở bước chờ khách chọn.");
        RequireIncidentContract(incident.Contract);

        var now = NowUtc;
        if (choice == "TRANSFER")
        {
            if (incident.Proposal != "TRANSFER" || incident.TargetUnit == null || incident.TargetUnit.Status != "RESERVED")
            {
                throw new InvalidOperationException("Chưa có ô tương đương được cơ sở đề xuất; liên hệ cơ sở hoặc chọn kết thúc.");
            }
            var ctx = await IncidentUnitsAsync(incident.FacilityId, ct);
            if (request.TargetUnitId != incident.TargetUnit.UnitId.ToString(CultureInfo.InvariantCulture)
                || request.ExpectedTargetVersion != ctx.VersionOf(incident.TargetUnit.UnitId))
            {
                throw new OpsConflictException("Ô thay thế vừa thay đổi. Tải lại hồ sơ.");
            }
            incident.Status = "TRANSFER_PENDING";
        }
        else
        {
            // D32: hoàn vào tài khoản chính chủ, tên trùng tên trên hợp đồng.
            var bank = RefundBank.Validate(request.RefundBank, incident.Contract.Customer.FullName);
            incident.RefundBankName = bank.BankName;
            incident.RefundAccountNumber = bank.AccountNumber;
            incident.RefundAccountHolder = bank.AccountHolder;
            if (incident.TargetUnit is { Status: "RESERVED" })
            {
                SetUnitStatus(incident.TargetUnit, "AVAILABLE", customerId, $"Khách chọn kết thúc · {incident.CaseCode}");
            }
            incident.Status = "TERMINATION_PENDING";
        }
        incident.ChoiceOption = choice;
        incident.ChoiceNote = note;
        incident.ChoiceAt = now;
        incident.Version += 1;
        incident.UpdatedAt = now;
        LogIncident(customerId, "CHOOSE_INCIDENT_OPTION", incident, new { choice });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new IncidentReceiptDto(await IncidentDtoAsync(incident.CaseCode, ct));
    }

    // ------------------------------------------------------------------ quản lý hoàn tất chuyển / chốt kết thúc

    public async Task<IncidentReceiptDto> CompleteIncidentTransferAsync(OpsActor actor, string id, IncidentActionRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        if ((request.Action ?? string.Empty).Trim() != "COMPLETE_INCIDENT_TRANSFER") throw new ArgumentException("Thao tác sự cố không hợp lệ.");
        if (request.Confirmed != true) throw new ArgumentException("Xác nhận đã chuyển đồ thực tế trước khi đổi mã ra vào.");
        var movedAt = ParseInstant(request.MovedAt, "thời điểm chuyển");
        var facility = await FacilityOfAsync(actor, ct);
        var (contractId, _) = ParseCaseCode(id);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"incident-contract:{contractId}", ct);
        var incident = await IncidentQuery().AsSplitQuery()
                           .Include(i => i.Contract).ThenInclude(c => c.AccessCredentials)
                           .Include(i => i.Contract).ThenInclude(c => c.HandoverRecord)
                           .FirstOrDefaultAsync(i => i.CaseCode == id && i.FacilityId == facility.FacilityId, ct)
                       ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ sự cố tại cơ sở của bạn.");
        if (request.ExpectedVersion != incident.Version) throw new OpsConflictException("Hồ sơ đã thay đổi. Tải lại trước khi gửi tiếp.");
        if (incident.Status != "TRANSFER_PENDING" || incident.ChoiceOption != "TRANSFER")
        {
            throw new InvalidOperationException("Khách chưa đồng ý chuyển ô hoặc đã hoàn tất.");
        }
        var contract = incident.Contract;
        RequireIncidentContract(contract);
        var target = incident.TargetUnit;
        var ctx = await IncidentUnitsAsync(facility.FacilityId, ct);
        if (target == null || target.Status != "RESERVED"
            || request.TargetUnitId != target.UnitId.ToString(CultureInfo.InvariantCulture)
            || request.ExpectedTargetVersion != ctx.VersionOf(target.UnitId))
        {
            throw new OpsConflictException("Ô thay thế không còn hợp lệ. Tải lại hồ sơ và liên hệ khách.");
        }
        var now = NowUtc;
        if (movedAt > now.AddMinutes(1)) throw new ArgumentException("Thời điểm thực tế không được ở tương lai.");
        if (movedAt < incident.AffectedAt || movedAt < FloorMinute(incident.ChoiceAt ?? now))
        {
            throw new ArgumentException("Thời điểm chuyển phải sau sự cố và sau khi khách đồng ý.");
        }

        var oldUnit = incident.OldUnit;
        SetUnitStatus(oldUnit, "MAINTENANCE", actor.UserId, $"Sự cố cơ sở · {incident.CaseCode}");
        SetUnitStatus(target, "OCCUPIED", actor.UserId, $"Khách chuyển sang do sự cố · {incident.CaseCode}");
        contract.UnitId = target.UnitId;
        contract.Unit = target; // giữ nguyên kỳ thuê, giá, cọc (không phụ phí)
        foreach (var a in await dbContext.UnitAssignments.Where(a => a.ReservationId == contract.ReservationId && a.Status == "ACTIVE").ToListAsync(ct))
        {
            a.Status = "REPLACED";
        }
        dbContext.UnitAssignments.Add(new UnitAssignment
        {
            ReservationId = contract.ReservationId, UnitId = target.UnitId, AssignedBy = actor.UserId, AssignedAt = now,
            Status = "ACTIVE", Reason = $"Đổi ô do sự cố cơ sở {incident.CaseCode}"
        });
        // Mã ra vào ô cũ hết hiệu lực khi hoàn tất chuyển; hệ thống cấp QR/PIN cho ô mới. Chìa khóa vật lý nhận lại tại quầy.
        var hadKey = false;
        foreach (var cred in contract.AccessCredentials.Where(c => c.Status == "ACTIVE"))
        {
            hadKey |= cred.CredentialType == "KEY";
            cred.Status = "REPLACED";
            cred.ReturnedAt = now;
        }
        foreach (var kind in new[] { "QR", "PIN" })
        {
            contract.AccessCredentials.Add(new AccessCredential
            {
                ContractId = contract.ContractId, UnitId = target.UnitId, IssuedBy = actor.UserId, CredentialType = "ACCESS_CODE",
                CredentialReference = $"{kind}-{Guid.NewGuid():N}", IssuedAt = now, Status = "ACTIVE"
            });
        }
        if (hadKey && contract.HandoverRecord is { Status: "HANDED_OVER" } receipt)
        {
            receipt.Status = "VERIFIED"; // nhân viên ghi nhận giao chìa khóa ô mới ở màn nhận chìa khóa
            receipt.HandoverAt = null;
            receipt.StaffConfirmed = false;
            receipt.CustomerConfirmed = false;
        }
        incident.MovedAt = movedAt;
        incident.Status = "TRANSFERRED";
        incident.Version += 1;
        incident.UpdatedAt = now;
        LogIncident(actor.UserId, "COMPLETE_INCIDENT_TRANSFER", incident, new { from = oldUnit.UnitNumber, to = target.UnitNumber, movedAt });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new IncidentReceiptDto(await IncidentDtoAsync(incident.CaseCode, ct));
    }

    public async Task<IncidentReceiptDto> FinalizeIncidentTerminationAsync(OpsActor actor, string id, IncidentActionRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        if ((request.Action ?? string.Empty).Trim() != "FINALIZE_INCIDENT_TERMINATION") throw new ArgumentException("Thao tác sự cố không hợp lệ.");
        if (request.Confirmed != true) throw new ArgumentException("Xác nhận kết thúc theo lựa chọn khách trước khi chốt.");
        var facility = await FacilityOfAsync(actor, ct);
        var (contractId, _) = ParseCaseCode(id);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"incident-contract:{contractId}", ct);
        var incident = await IncidentQuery().AsSplitQuery()
                           .Include(i => i.Contract).ThenInclude(c => c.AccessCredentials)
                           .FirstOrDefaultAsync(i => i.CaseCode == id && i.FacilityId == facility.FacilityId, ct)
                       ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ sự cố tại cơ sở của bạn.");
        if (request.ExpectedVersion != incident.Version) throw new OpsConflictException("Hồ sơ đã thay đổi. Tải lại trước khi gửi tiếp.");
        if (incident.Status != "TERMINATION_PENDING" || incident.ChoiceOption != "TERMINATE")
        {
            throw new InvalidOperationException("Khách chưa chọn kết thúc hoặc hồ sơ đã xử lý.");
        }
        var contract = incident.Contract;
        RequireIncidentContract(contract);
        if (!RefundBank.IsComplete(incident.RefundBankName, incident.RefundAccountNumber, incident.RefundAccountHolder)
            || RefundBank.NormalizeHolder(incident.RefundAccountHolder) != RefundBank.NormalizeHolder(contract.Customer.FullName))
        {
            throw new InvalidOperationException("Thiếu tài khoản nhận hoàn chính chủ của khách.");
        }

        var now = NowUtc;
        var amounts = IncidentRefundPolicy.Calculate(contract.StartDate, contract.EndDate, contract.AgreedMonthlyRate, contract.DepositAmount, VnToday);
        var refund = new Payment
        {
            ContractId = contract.ContractId, PaymentType = "REFUND", Amount = amounts.Total, Currency = "VND",
            PaymentMethod = "BANK_TRANSFER", DueDate = RefundDueDate(now), Status = "PENDING", CreatedAt = now, UpdatedAt = now
        };
        dbContext.Payments.Add(refund);
        contract.Status = "TERMINATED";
        contract.TerminationReason = Clip($"Sự cố do cơ sở ({incident.CaseCode}): {incident.Description}", 500);
        contract.CompletedAt = now;
        foreach (var cred in contract.AccessCredentials.Where(c => c.Status == "ACTIVE"))
        {
            cred.Status = "REVOKED"; // hệ thống vô hiệu mã khi hợp đồng kết thúc, không phải thu hồi thủ công
            cred.ReturnedAt = now;
        }
        SetUnitStatus(incident.OldUnit, "MAINTENANCE", actor.UserId, $"Sự cố cơ sở · {incident.CaseCode}");
        if (incident.TargetUnit is { Status: "RESERVED" }) SetUnitStatus(incident.TargetUnit, "AVAILABLE", actor.UserId, $"Bỏ giữ ô · {incident.CaseCode}");
        incident.CurrentMonthRent = amounts.CurrentMonthRent;
        incident.UnusedRent = amounts.UnusedRent;
        incident.Status = "TERMINATED";
        incident.Version += 1;
        incident.UpdatedAt = now;
        await dbContext.SaveChangesAsync(ct);
        incident.RefundPaymentId = refund.PaymentId;
        LogIncident(actor.UserId, "FINALIZE_INCIDENT_TERMINATION", incident, new { refund = amounts.Total, payment = $"HC-{refund.PaymentId:0000}" });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new IncidentReceiptDto(await IncidentDtoAsync(incident.CaseCode, ct));
    }

    // ------------------------------------------------------------------ hỗ trợ

    private IQueryable<FacilityIncident> IncidentQuery() => dbContext.FacilityIncidents
        .Include(i => i.Contract).ThenInclude(c => c.Customer)
        .Include(i => i.Contract).ThenInclude(c => c.Unit).ThenInclude(u => u.UnitType)
        .Include(i => i.OldUnit).ThenInclude(u => u.UnitType)
        .Include(i => i.TargetUnit).ThenInclude(u => u!.UnitType);

    private static void RequireIncidentContract(RentalContract c)
    {
        if (c.Status is not ("ACTIVE" or "EXPIRING")) throw new InvalidOperationException("Hợp đồng không còn đủ điều kiện xử lý sự cố này.");
    }

    private static (long ContractId, int Sequence) ParseCaseCode(string? code)
    {
        var m = CaseCodePattern.Match((code ?? string.Empty).Trim());
        if (!m.Success || !long.TryParse(m.Groups[1].Value, out var cid) || !int.TryParse(m.Groups[2].Value, out var seq) || cid <= 0 || seq <= 0)
        {
            throw new KeyNotFoundException("Không tìm thấy hồ sơ sự cố.");
        }
        return (cid, seq);
    }

    /// <summary>Chuỗi ISO có múi giờ → UTC, làm tròn xuống mili giây (để trả lại đúng chuỗi toISOString của giao diện).</summary>
    internal static DateTime ParseInstant(string? value, string what)
    {
        if (!DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            throw new ArgumentException($"Nhập {what} hợp lệ.");
        }
        var utc = parsed.UtcDateTime;
        return new DateTime(utc.Ticks - utc.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
    }

    internal static string? Iso(DateTime? utc) =>
        utc.HasValue ? DateTime.SpecifyKind(utc.Value, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture) : null;

    private static DateTime FloorMinute(DateTime utc) => new(utc.Ticks - utc.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);

    private void LogIncident(long userId, string action, FacilityIncident incident, object value) =>
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId, Action = action, EntityType = "FACILITY_INCIDENT", EntityId = incident.IncidentId == 0 ? (long?)null : incident.IncidentId,
            NewValue = System.Text.Json.JsonSerializer.Serialize(new { incident = incident.CaseCode, detail = value }), LoggedAt = NowUtc
        });

    private async Task<Dictionary<long, int>> IncidentCountsAsync(List<long> contractIds, CancellationToken ct)
    {
        if (contractIds.Count == 0) return new Dictionary<long, int>();
        return await dbContext.FacilityIncidents.AsNoTracking()
            .Where(i => contractIds.Contains(i.ContractId))
            .GroupBy(i => i.ContractId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
    }

    private async Task<IncidentCaseDto> IncidentDtoAsync(string caseCode, CancellationToken ct)
    {
        dbContext.ChangeTracker.Clear(); // đọc lại đúng dữ liệu đã lưu, không dùng bản đang theo dõi
        var incident = await IncidentQuery().AsNoTracking().AsSplitQuery().FirstAsync(i => i.CaseCode == caseCode, ct);
        var ctx = await IncidentUnitsAsync(incident.FacilityId, ct);
        var extras = await IncidentExtrasAsync([incident], ct);
        return ToIncidentDto(incident.CaseCode, incident.Version, incident.Status, incident.Contract, incident.OldUnit, incident, ctx, extras);
    }

    /// <summary>Ảnh / tệp và khoản hoàn của các hồ sơ (một lần truy vấn cho cả danh sách).</summary>
    private sealed record IncidentExtras(Dictionary<long, List<(long PhotoId, string FileName, string ContentType, int Size)>> Photos, Dictionary<long, Payment> Refunds);

    private async Task<IncidentExtras> IncidentExtrasAsync(List<FacilityIncident> incidents, CancellationToken ct)
    {
        var ids = incidents.Select(i => i.IncidentId).ToList();
        var photoRows = await dbContext.EvidencePhotos.AsNoTracking()
            .Where(p => p.OwnerType == IncidentPhotoOwner && ids.Contains(p.OwnerId))
            .OrderBy(p => p.PhotoId)
            .Select(p => new { p.OwnerId, p.PhotoId, p.FileName, p.ContentType, p.SizeBytes })
            .ToListAsync(ct);
        var paymentIds = incidents.Where(i => i.RefundPaymentId != null).Select(i => i.RefundPaymentId!.Value).ToList();
        var refunds = await dbContext.Payments.AsNoTracking().Where(p => paymentIds.Contains(p.PaymentId)).ToDictionaryAsync(p => p.PaymentId, ct);
        return new IncidentExtras(
            photoRows.GroupBy(p => p.OwnerId).ToDictionary(g => g.Key, g => g.Select(p => (p.PhotoId, p.FileName, p.ContentType, p.SizeBytes)).ToList()),
            refunds);
    }

    /// <summary>Ô kho của cơ sở và các ràng buộc để chọn ô tương đương.</summary>
    private sealed class IncidentUnitContext
    {
        public List<StorageUnit> Units { get; init; } = [];
        public HashSet<long> UnderMaintenance { get; init; } = [];
        public List<(long ContractId, long UnitId, DateOnly Start, DateOnly End)> Busy { get; init; } = [];
        public Dictionary<long, int> HistoryCounts { get; init; } = new();
        public Dictionary<long, string> ReservedFor { get; init; } = new();
        /// <summary>Phiên bản ô = số lần đổi trạng thái đã ghi + 1 (tăng mỗi lần đổi qua SetUnitStatus / UnitStatusRules).</summary>
        public int VersionOf(long unitId) => HistoryCounts.GetValueOrDefault(unitId) + 1;
    }

    private async Task<IncidentUnitContext> IncidentUnitsAsync(long facilityId, CancellationToken ct)
    {
        var units = await dbContext.StorageUnits.AsNoTracking().Include(u => u.UnitType)
            .Where(u => u.FacilityId == facilityId).ToListAsync(ct);
        var unitIds = units.Select(u => u.UnitId).ToList();
        var maintenance = await dbContext.MaintenanceRequests.AsNoTracking()
            .Where(m => unitIds.Contains(m.UnitId) && m.Status != "COMPLETED" && m.Status != "CANCELLED")
            .Select(m => m.UnitId).Distinct().ToListAsync(ct);
        var busy = await dbContext.RentalContracts.AsNoTracking()
            .Where(c => unitIds.Contains(c.UnitId) && c.Status != "CANCELLED" && c.Status != "COMPLETED" && c.Status != "TERMINATED")
            .Select(c => new { c.ContractId, c.UnitId, c.StartDate, c.EndDate }).ToListAsync(ct);
        var history = await dbContext.UnitStatusHistories.AsNoTracking()
            .Where(h => unitIds.Contains(h.UnitId))
            .GroupBy(h => h.UnitId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var reserved = await dbContext.FacilityIncidents.AsNoTracking()
            .Where(i => i.FacilityId == facilityId && i.TargetUnitId != null && (i.Status == "PROPOSED" || i.Status == "TRANSFER_PENDING"))
            .Select(i => new { UnitId = i.TargetUnitId!.Value, i.CaseCode }).ToListAsync(ct);
        return new IncidentUnitContext
        {
            Units = units,
            UnderMaintenance = maintenance.ToHashSet(),
            Busy = busy.Select(b => (b.ContractId, b.UnitId, b.StartDate, b.EndDate)).ToList(),
            HistoryCounts = history,
            ReservedFor = reserved.GroupBy(r => r.UnitId).ToDictionary(g => g.Key, g => g.First().CaseCode)
        };
    }

    /// <summary>Ô tương đương: cùng cơ sở, cùng loại kho (loại + diện tích), trống hoặc đang giữ cho chính hồ sơ này,
    /// không bảo trì, không có hợp đồng khác trùng khoảng từ hôm nay tới hết kỳ thuê.</summary>
    private static List<StorageUnit> CandidatesFor(RentalContract contract, string caseCode, long oldUnitId, IncidentUnitContext ctx)
    {
        var today = VnToday;
        var typeId = ctx.Units.FirstOrDefault(u => u.UnitId == oldUnitId)?.UnitTypeId ?? contract.Unit.UnitTypeId;
        return ctx.Units
            .Where(u => u.UnitTypeId == typeId && u.UnitId != oldUnitId && u.UnitId != contract.UnitId
                        && ((u.Status == "AVAILABLE" && !ctx.ReservedFor.ContainsKey(u.UnitId))
                            || (u.Status == "RESERVED" && ctx.ReservedFor.TryGetValue(u.UnitId, out var holder) && holder == caseCode))
                        && !ctx.UnderMaintenance.Contains(u.UnitId)
                        && !ctx.Busy.Any(b => b.UnitId == u.UnitId && b.ContractId != contract.ContractId
                                              && b.Start < contract.EndDate && b.End > today))
            .OrderBy(u => u.UnitNumber)
            .ToList();
    }

    private static IncidentUnitDto UnitDto(StorageUnit u, IncidentUnitContext ctx) => new(
        u.UnitId.ToString(CultureInfo.InvariantCulture), u.UnitNumber, u.FacilityId, u.UnitType.TypeName,
        (int)Math.Round(u.UnitType.Area, MidpointRounding.AwayFromZero), u.Status, ctx.VersionOf(u.UnitId),
        ctx.ReservedFor.TryGetValue(u.UnitId, out var code) && u.Status == "RESERVED" ? code : null);

    private static string ContractStatusOf(RentalContract c) =>
        c.Status is "ACTIVE" or "EXPIRING" or "OVERDUE" or "RETURN_PENDING" ? c.Status : "ENDED";

    private IncidentCaseDto ToIncidentDto(string code, int version, string status, RentalContract c, StorageUnit oldUnit,
        FacilityIncident? i, IncidentUnitContext ctx, IncidentExtras extras)
    {
        var amounts = i is { Status: "TERMINATED", CurrentMonthRent: not null, UnusedRent: not null }
            ? new IncidentRefundPolicy.Result(i.CurrentMonthRent.Value, i.UnusedRent.Value, c.DepositAmount)
            : IncidentRefundPolicy.Calculate(c.StartDate, c.EndDate, c.AgreedMonthlyRate, c.DepositAmount, VnToday);
        List<(long PhotoId, string FileName, string ContentType, int Size)> photoRows =
            i != null && extras.Photos.TryGetValue(i.IncidentId, out var rows) ? rows : new();
        // Đơn vị kho hiện tại của hợp đồng (sau khi chuyển là ô mới) — loại/diện tích không đổi khi chuyển ô tương đương.
        var current = ctx.Units.FirstOrDefault(u => u.UnitId == c.UnitId) ?? c.Unit;
        var target = i?.TargetUnitId is long tid ? ctx.Units.FirstOrDefault(u => u.UnitId == tid) : null;
        List<IncidentUnitDto> candidates = status == "DRAFT"
            ? CandidatesFor(c, code, oldUnit.UnitId, ctx).Select(u => UnitDto(u, ctx)).ToList()
            : new();
        IncidentRefundDto? refund = null;
        if (i?.RefundPaymentId is long pid && extras.Refunds.TryGetValue(pid, out var p))
        {
            var paid = p.Status == "PAID";
            refund = new IncidentRefundDto($"HC-{p.PaymentId:0000}", p.Amount, paid ? "PAID" : p.Status,
                paid ? p.TransactionReference : null, paid ? Iso(p.PaidAt) : null);
        }
        var access = status switch
        {
            "TRANSFERRED" => new IncidentAccessDto("INVALID", "ISSUED"),
            "TERMINATED" => new IncidentAccessDto("INVALID", "NONE"),
            _ => new IncidentAccessDto("UNCHANGED", "NONE")
        };
        return new IncidentCaseDto(
            code, ContractCode(c), c.CustomerId, oldUnit.FacilityId, version, status, ContractStatusOf(c),
            oldUnit.UnitId.ToString(CultureInfo.InvariantCulture), oldUnit.UnitNumber, current.UnitNumber, current.UnitType.TypeName,
            (int)Math.Round(current.UnitType.Area, MidpointRounding.AwayFromZero), c.Customer.FullName,
            c.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), c.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            c.AgreedMonthlyRate, c.DepositAmount, amounts.CurrentMonthRent, amounts.UnusedRent,
            i?.Description, Iso(i?.AffectedAt), i?.Confirmed ?? false, i?.Proposal,
            photoRows.Select(r => new EvidencePhotoDto(EvidencePhotos.Url(r.PhotoId), r.FileName)).ToList(),
            photoRows.Select(r => new IncidentFileDto(r.FileName, r.ContentType, r.Size)).ToList(),
            candidates, target == null ? null : UnitDto(target, ctx),
            i?.ChoiceOption == null ? null : new IncidentChoiceDto(i.ChoiceOption, i.ChoiceNote ?? string.Empty, Iso(i.ChoiceAt)!),
            i?.RefundBankName == null ? null : new IncidentBankDto(i.RefundBankName, i.RefundAccountNumber ?? string.Empty, i.RefundAccountHolder ?? string.Empty),
            Iso(i?.MovedAt),
            status is "TRANSFERRED" or "TERMINATED" ? "MAINTENANCE" : (ctx.Units.FirstOrDefault(u => u.UnitId == oldUnit.UnitId)?.Status ?? oldUnit.Status),
            access, 0m, refund);
    }
}
