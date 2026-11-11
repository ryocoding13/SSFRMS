using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Quản lý hồ sơ quá hạn và biên bản xử lý tài sản trong kho quá hạn ngày thứ 20 (D32 / T12).
/// Hỗ trợ:
/// 1. GET /api/ops/overdue-cases: Lấy danh sách hồ sơ quá hạn theo cơ sở.
/// 2. POST /api/ops/overdue-cases/actions (ASSIGN_REMOVAL): Quản lý phân công nhân viên xử lý đồ.
/// 3. POST /api/ops/overdue-cases/actions (RECORD_REMOVAL): Nhân viên / quản lý ghi nhận biên bản xử lý đồ kèm ảnh trước và sau.
/// </summary>
public partial class FacilityOpsService
{
    private const string AssignRemovalAction = "ASSIGN_REMOVAL";
    private const string RecordRemovalAction = "RECORD_REMOVAL";

    /// <summary>
    /// Lấy danh sách các hồ sơ hợp đồng quá hạn thuộc cơ sở của tài khoản đang đăng nhập.
    /// Kèm thông tin hợp đồng, khách hàng, nhân viên phụ trách và ảnh biên bản nếu đã xử lý.
    /// </summary>
    /// <param name="actor">Thông tin người dùng vận hành hiện tại.</param>
    /// <param name="ct">Token hủy thao tác không đồng bộ.</param>
    /// <returns>Danh sách OverdueCaseDto.</returns>
    public async Task<IReadOnlyList<OverdueCaseDto>> GetOverdueCasesAsync(OpsActor actor, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var cases = await dbContext.OverdueCases
            .AsNoTracking()
            .AsSplitQuery()
            .Include(o => o.Contract).ThenInclude(c => c.Unit)
            .Include(o => o.Contract).ThenInclude(c => c.Customer)
            .Include(o => o.AssignedStaff)
            .Where(o => o.Contract.Unit.FacilityId == facility.FacilityId)
            .OrderByDescending(o => o.OverdueCaseId)
            .ToListAsync(ct);

        var resolvedCaseIds = cases.Where(c => c.Status == "RESOLVED" || (c.Notes != null && c.Notes.Contains("\"Staff\""))).Select(c => c.OverdueCaseId).ToList();
        var allPhotos = await OverduePhotosAsync(resolvedCaseIds, ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow + VnOffset);
        var dtos = new List<OverdueCaseDto>();
        foreach (var c in cases)
        {
            var isSettled = c.Status == "RESOLVED";
            var calc = await OpsRules.CalculateContractOverdueAsync(dbContext, c.Contract, today, isSettled, ct);
            dtos.Add(MapToOverdueCaseDto(c, allPhotos, calc));
        }

        return dtos;
    }

    /// <summary>
    /// Điều phối xử lý thao tác trên hồ sơ quá hạn (phân công xử lý hoặc ghi biên bản xử lý tài sản).
    /// </summary>
    /// <param name="actor">Thông tin người thao tác.</param>
    /// <param name="request">Yêu cầu thao tác (ASSIGN_REMOVAL hoặc RECORD_REMOVAL).</param>
    /// <param name="ct">Token hủy thao tác.</param>
    /// <returns>OverdueCaseDto sau khi cập nhật.</returns>
    public async Task<OverdueCaseDto> HandleOverdueCaseActionAsync(OpsActor actor, OverdueCaseActionRequest request, CancellationToken ct = default)
    {
        var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();
        return action switch
        {
            AssignRemovalAction => await AssignRemovalAsync(actor, request, ct),
            RecordRemovalAction => await RecordRemovalAsync(actor, request, ct),
            _ => throw new ArgumentException("Thao tác hồ sơ quá hạn không hợp lệ.")
        };
    }

    /// <summary>
    /// Quản lý phân công nhân viên cơ sở thực hiện kiểm kê và xử lý tài sản quá hạn mốc ngày 20.
    /// </summary>
    private async Task<OverdueCaseDto> AssignRemovalAsync(OpsActor actor, OverdueCaseActionRequest request, CancellationToken ct)
    {
        RequireManager(actor);
        var caseId = ParseCaseId(request.Id);
        var facility = await FacilityOfAsync(actor, ct);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"overdue-case:{facility.FacilityId}:{caseId}", ct);
        var c = await dbContext.OverdueCases
            .Include(o => o.Contract).ThenInclude(co => co.Unit)
            .Include(o => o.Contract).ThenInclude(co => co.Customer)
            .Include(o => o.AssignedStaff)
            .FirstOrDefaultAsync(o => o.OverdueCaseId == caseId && o.Contract.Unit.FacilityId == facility.FacilityId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy hồ sơ quá hạn #{request.Id}.");

        if (c.Status is "DONE" or "RESOLVED")
        {
            throw new InvalidOperationException("Biên bản đã hoàn tất.");
        }

        var assigneeText = (request.Assignee ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(assigneeText) && !request.AssigneeId.HasValue)
        {
            throw new ArgumentException("Vui lòng nhập nhân viên phụ trách.");
        }

        User? staffUser = null;
        if (request.AssigneeId.HasValue)
        {
            staffUser = await dbContext.Users
                .Include(u => u.UserFacilities)
                .FirstOrDefaultAsync(u => u.UserId == request.AssigneeId.Value
                    && u.UserFacilities.Any(uf => uf.FacilityId == facility.FacilityId && uf.Status == "ACTIVE"), ct);
        }

        if (staffUser == null && !string.IsNullOrWhiteSpace(assigneeText))
        {
            staffUser = await dbContext.Users
                .Include(u => u.UserFacilities)
                .FirstOrDefaultAsync(u => (u.FullName == assigneeText || u.Username == assigneeText)
                    && u.UserFacilities.Any(uf => uf.FacilityId == facility.FacilityId && uf.Status == "ACTIVE"), ct);
        }

        if (staffUser != null)
        {
            c.AssignedStaffId = staffUser.UserId;
            c.AssignedStaff = staffUser;
        }

        c.Status = "ESCALATED";
        var staffDisplayName = staffUser?.FullName ?? assigneeText;
        c.Notes = string.IsNullOrWhiteSpace(c.Notes)
            ? $"[Phân công]: {staffDisplayName}"
            : $"{c.Notes}\n[Phân công]: {staffDisplayName}";

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return MapToOverdueCaseDto(c, new());
    }

    /// <summary>
    /// Ghi nhận biên bản di dời và xử lý tài sản trong kho quá hạn sau ngày 20.
    /// Yêu cầu ảnh chụp hiện trường trước và sau khi xử lý, chuyển ô kho sang INSPECTION hoặc MAINTENANCE.
    /// </summary>
    private async Task<OverdueCaseDto> RecordRemovalAsync(OpsActor actor, OverdueCaseActionRequest request, CancellationToken ct)
    {
        var caseId = ParseCaseId(request.Id);
        var facility = await FacilityOfAsync(actor, ct);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"overdue-case:{facility.FacilityId}:{caseId}", ct);
        var c = await dbContext.OverdueCases
            .Include(o => o.Contract).ThenInclude(co => co.Unit)
            .Include(o => o.Contract).ThenInclude(co => co.Customer)
            .Include(o => o.AssignedStaff)
            .FirstOrDefaultAsync(o => o.OverdueCaseId == caseId && o.Contract.Unit.FacilityId == facility.FacilityId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy hồ sơ quá hạn #{request.Id}.");

        if (c.Status is "DONE" or "RESOLVED")
        {
            throw new InvalidOperationException("Biên bản đã được lưu; không gửi lại.");
        }

        if (!actor.IsManager && c.AssignedStaffId.HasValue && c.AssignedStaffId.Value != actor.UserId)
        {
            throw new InvalidOperationException("Bạn chưa được phân công hồ sơ này.");
        }

        // 1. Kiểm tra thời gian thực hiện
        var rawPerformedAt = (request.PerformedAt ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(rawPerformedAt))
        {
            throw new ArgumentException("Điền đầy đủ thời gian, tình trạng đồ và vị trí thực tế.");
        }

        DateTime performedUtc;
        if (DateTime.TryParse(rawPerformedAt, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var parsedUtc))
        {
            performedUtc = parsedUtc;
        }
        else if (DateTime.TryParse(rawPerformedAt, out var localParsed))
        {
            performedUtc = localParsed.ToUniversalTime();
        }
        else
        {
            throw new ArgumentException("Thời gian thực hiện không đúng định dạng.");
        }

        if (performedUtc > NowUtc.AddMinutes(5))
        {
            throw new ArgumentException("Thời gian thực tế không được ở tương lai.");
        }

        // Mốc ngày 20 theo giờ Việt Nam (+07:00)
        var performedDateVn = DateOnly.FromDateTime(performedUtc.AddHours(7));
        var overdueDays = performedDateVn.DayNumber - c.Contract.EndDate.DayNumber;
        const int removalDay = 20;
        if (overdueDays < removalDay)
        {
            throw new InvalidOperationException($"Chưa đến mốc {removalDay} ngày quá hạn tại thời điểm thực hiện.");
        }

        // 2. Kiểm tra danh mục đồ và vị trí
        var inventory = (request.Inventory ?? string.Empty).Trim();
        var location = (request.Location ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(inventory) || string.IsNullOrWhiteSpace(location))
        {
            throw new ArgumentException("Điền đầy đủ danh sách đồ và vị trí thực tế.");
        }

        // 3. Kiểm tra trạng thái ô kho sau kiểm tra (INSPECTION hoặc MAINTENANCE, không được AVAILABLE)
        var unitStatus = (request.UnitStatus ?? string.Empty).Trim().ToUpperInvariant();
        if (unitStatus is not ("INSPECTION" or "MAINTENANCE"))
        {
            throw new ArgumentException("Kho cần chờ kiểm tra hoặc bảo trì.");
        }

        // 4. Kiểm tra xác nhận
        if (request.Confirmed != true)
        {
            throw new ArgumentException("Cần xác nhận nội dung phản ánh đúng việc đã thực hiện.");
        }

        // 5. Kiểm tra ảnh trước và sau (bắt buộc ít nhất 1 ảnh mỗi loại)
        if (request.BeforePhotos == null || request.BeforePhotos.Count == 0 ||
            request.AfterPhotos == null || request.AfterPhotos.Count == 0)
        {
            throw new ArgumentException("Cần ít nhất một ảnh trước và một ảnh sau xử lý.");
        }

        var rawBefore = EvidencePhotos.Decode(request.BeforePhotos, required: true, what: "trước xử lý");
        var rawAfter = EvidencePhotos.Decode(request.AfterPhotos, required: true, what: "sau xử lý");

        var beforePhotos = rawBefore.Select(p => new EvidencePhotos.Decoded($"before_{p.FileName}", p.ContentType, p.Data)).ToList();
        var afterPhotos = rawAfter.Select(p => new EvidencePhotos.Decoded($"after_{p.FileName}", p.ContentType, p.Data)).ToList();

        // 6. Ghi dữ liệu
        var now = NowUtc;
        var actorUser = await dbContext.Users.FindAsync(new object[] { actor.UserId }, ct);
        var staffName = actorUser?.FullName ?? (actor.IsManager ? "Quản lý cơ sở" : "Nhân viên cơ sở");

        // S06: loại ảnh riêng cho hồ sơ quá hạn — không trùng ownerId với biên bản trả kho (InspectionId).
        EvidencePhotos.Attach(dbContext, beforePhotos, EvidencePhotos.OverdueBefore, c.OverdueCaseId, actor.UserId, now);
        EvidencePhotos.Attach(dbContext, afterPhotos, EvidencePhotos.OverdueAfter, c.OverdueCaseId, actor.UserId, now);

        SetUnitStatus(c.Contract.Unit, unitStatus, actor.UserId, $"Xử lý đồ quá hạn · QH-{c.OverdueCaseId:D4}");

        var recordData = new OverdueRemovalRecordData
        {
            Staff = staffName,
            Inventory = inventory,
            Location = location,
            PerformedAt = rawPerformedAt,
            SavedAt = now.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            UnitStatus = unitStatus,
            OriginalNotes = c.Notes
        };

        c.Notes = JsonSerializer.Serialize(recordData);
        c.Status = "RESOLVED";
        c.ResolvedAt = now;

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = actor.UserId,
            Action = "OVERDUE_REMOVAL_RECORDED",
            EntityType = "OVERDUE_CASE",
            EntityId = c.OverdueCaseId,
            NewValue = JsonSerializer.Serialize(new
            {
                caseId = c.OverdueCaseId,
                contractId = c.ContractId,
                unitStatus,
                inventory,
                location,
                performedAt = rawPerformedAt
            }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var allUrls = await OverduePhotosAsync([c.OverdueCaseId], ct);

        return MapToOverdueCaseDto(c, allUrls);
    }

    /// <summary>S06: gộp ảnh trước/sau của hồ sơ quá hạn (tên tệp giữ tiền tố before_/after_ để giao diện tách nhóm).</summary>
    private async Task<Dictionary<long, List<EvidencePhotoDto>>> OverduePhotosAsync(ICollection<long> caseIds, CancellationToken ct)
    {
        var before = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.OverdueBefore, caseIds, ct);
        var after = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.OverdueAfter, caseIds, ct);
        foreach (var (id, list) in after)
        {
            if (before.TryGetValue(id, out var existing)) existing.AddRange(list);
            else before[id] = list;
        }
        return before;
    }

    /// <summary>Ánh xạ thực thể OverdueCase sang OverdueCaseDto cho API response.</summary>
    private static OverdueCaseDto MapToOverdueCaseDto(
        OverdueCase c,
        Dictionary<long, List<EvidencePhotoDto>> allPhotos,
        OpsRules.ContractOverdueCalculation? calc = null)
    {
        OverdueRemovalRecordDto? recordDto = null;
        var notesList = new List<string>();

        if ((c.Status is "DONE" or "RESOLVED") && !string.IsNullOrWhiteSpace(c.Notes))
        {
            try
            {
                var recordData = JsonSerializer.Deserialize<OverdueRemovalRecordData>(c.Notes);
                if (recordData != null)
                {
                    allPhotos.TryGetValue(c.OverdueCaseId, out var photos);
                    var bPhotos = (photos ?? []).Where(p => p.Caption != null && p.Caption.StartsWith("before_")).Select(p => new EvidencePhotoDto(p.Url, p.Caption!.StartsWith("before_") ? p.Caption[7..] : p.Caption)).ToList();
                    var aPhotos = (photos ?? []).Where(p => p.Caption != null && p.Caption.StartsWith("after_")).Select(p => new EvidencePhotoDto(p.Url, p.Caption!.StartsWith("after_") ? p.Caption[6..] : p.Caption)).ToList();

                    recordDto = new OverdueRemovalRecordDto(
                        recordData.Staff,
                        recordData.Inventory,
                        recordData.Location,
                        recordData.PerformedAt,
                        recordData.SavedAt,
                        recordData.UnitStatus,
                        bPhotos,
                        aPhotos
                    );

                    if (!string.IsNullOrWhiteSpace(recordData.OriginalNotes))
                    {
                        notesList.AddRange(recordData.OriginalNotes.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
                    }
                }
            }
            catch
            {
                notesList.AddRange(c.Notes.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
            }
        }
        else if (!string.IsNullOrWhiteSpace(c.Notes))
        {
            notesList.AddRange(c.Notes.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        string dtoStatus;
        if (recordDto != null || c.Status == "RESOLVED")
        {
            dtoStatus = "DONE";
        }
        else if (c.AssignedStaffId.HasValue)
        {
            dtoStatus = "ASSIGNED";
        }
        else
        {
            dtoStatus = c.Status;
        }

        return new OverdueCaseDto(
            $"QH-{c.OverdueCaseId:D4}",
            c.Contract.Unit.FacilityId,
            $"HĐ-{c.Contract.ContractId:D4}",
            c.Contract.Unit.UnitNumber,
            c.Contract.Customer.FullName,
            c.Contract.DepositAmount,
            c.Contract.EndDate.ToString("yyyy-MM-dd"),
            dtoStatus,
            c.AssignedStaff?.FullName,
            c.AssignedStaffId,
            calc?.DisposalDay ?? 20,
            notesList,
            recordDto,
            calc?.OverdueDays,
            calc?.OverdueFee,
            calc?.RemainingDeposit,
            calc?.RatePerDay,
            calc?.DepletionDay,
            calc?.PolicyScope
        );
    }

    /// <summary>Phân tích chuỗi "QH-xxxx" thành ID số nguyên.</summary>
    private static long ParseCaseId(string? raw)
    {
        var t = (raw ?? string.Empty).Trim();
        if (t.StartsWith("QH-", StringComparison.OrdinalIgnoreCase))
        {
            t = t[3..];
        }
        if (long.TryParse(t, out var id)) return id;
        throw new ArgumentException("Mã hồ sơ quá hạn không hợp lệ.");
    }

    /// <summary>Dữ liệu JSON lưu trữ nội dung biên bản xử lý đồ quá hạn trong cột Notes của OverdueCase.</summary>
    private sealed class OverdueRemovalRecordData
    {
        public string Staff { get; set; } = string.Empty;
        public string Inventory { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string PerformedAt { get; set; } = string.Empty;
        public string SavedAt { get; set; } = string.Empty;
        public string UnitStatus { get; set; } = string.Empty;
        public string? OriginalNotes { get; set; }
    }
}
