using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Quản lý vận hành kinh doanh: cơ sở (UC19), chính sách (UC20), khung giá / phí / giảm giá và bảng giá (UC21).
/// Mọi thay đổi ghi activity_logs (BR13). Không sửa ngược giá đã chốt trong reservation/contract (BR14).
/// </summary>
public partial class OperationsService(AppDbContext dbContext) : IOperationsService
{
    // =====================================================================
    // UC19 — Cơ sở
    // =====================================================================

    public async Task<IReadOnlyList<OpsFacilityDto>> GetFacilitiesAsync(string? status, string? search, CancellationToken ct = default)
    {
        var query = dbContext.Facilities.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpperInvariant();
            query = query.Where(f => f.Status == s);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(f => f.Name.Contains(term) || f.Address.Contains(term));
        }

        var facilities = await query.OrderBy(f => f.Name).ToListAsync(ct);
        return await ToFacilityDtosAsync(facilities, ct);
    }

    public async Task<OpsFacilityDto?> GetFacilityAsync(long facilityId, CancellationToken ct = default)
    {
        var facility = await dbContext.Facilities.AsNoTracking().FirstOrDefaultAsync(f => f.FacilityId == facilityId, ct);
        if (facility == null) return null;
        return (await ToFacilityDtosAsync([facility], ct))[0];
    }

    public async Task<FacilitySaveResult> CreateFacilityAsync(UpsertFacilityRequest request, long userId, CancellationToken ct = default)
    {
        var input = ValidateFacility(request);
        var status = NormalizeFacilityStatus(request.Status) ?? "ACTIVE";
        var now = DateTime.UtcNow;

        var facility = new Facility
        {
            Name = input.Name,
            Address = input.Address,
            ContactPhone = input.Phone,
            OpeningTime = input.Opening,
            ClosingTime = input.Closing,
            Latitude = input.Latitude,
            Longitude = input.Longitude,
            Status = status,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Facilities.Add(facility);
        await dbContext.SaveChangesAsync(ct);

        Log(userId, "FACILITY_CREATE", "FACILITY", facility.FacilityId, null, FacilitySnapshot(facility));
        await dbContext.SaveChangesAsync(ct);

        var warnings = await FacilityWarningsAsync(facility, ct);
        return new FacilitySaveResult((await ToFacilityDtosAsync([facility], ct))[0], warnings);
    }

    public async Task<FacilitySaveResult> UpdateFacilityAsync(long facilityId, UpsertFacilityRequest request, long userId, CancellationToken ct = default)
    {
        var facility = await dbContext.Facilities.FirstOrDefaultAsync(f => f.FacilityId == facilityId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy cơ sở với ID: {facilityId}");

        var input = ValidateFacility(request);
        var before = FacilitySnapshot(facility);

        facility.Name = input.Name;
        facility.Address = input.Address;
        facility.ContactPhone = input.Phone;
        facility.OpeningTime = input.Opening;
        facility.ClosingTime = input.Closing;
        facility.Latitude = input.Latitude;
        facility.Longitude = input.Longitude;
        facility.UpdatedAt = DateTime.UtcNow;

        var newStatus = NormalizeFacilityStatus(request.Status);
        if (newStatus != null && newStatus != facility.Status)
        {
            await EnsureStatusChangeAllowedAsync(facility, newStatus, ct);
            facility.Status = newStatus;
        }

        Log(userId, "FACILITY_UPDATE", "FACILITY", facility.FacilityId, before, FacilitySnapshot(facility));
        await dbContext.SaveChangesAsync(ct);

        var warnings = await FacilityWarningsAsync(facility, ct);
        return new FacilitySaveResult((await ToFacilityDtosAsync([facility], ct))[0], warnings);
    }

    public async Task<FacilitySaveResult> ChangeFacilityStatusAsync(long facilityId, ChangeFacilityStatusRequest request, long userId, CancellationToken ct = default)
    {
        var status = NormalizeFacilityStatus(request.Status)
            ?? throw new ArgumentException("Trạng thái phải là ACTIVE, INACTIVE hoặc TEMPORARILY_CLOSED.");

        var facility = await dbContext.Facilities.FirstOrDefaultAsync(f => f.FacilityId == facilityId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy cơ sở với ID: {facilityId}");

        if (facility.Status == status)
        {
            throw new InvalidOperationException("Cơ sở đã ở trạng thái này.");
        }

        await EnsureStatusChangeAllowedAsync(facility, status, ct);

        var oldStatus = facility.Status;
        facility.Status = status;
        facility.UpdatedAt = DateTime.UtcNow;

        Log(userId, "FACILITY_STATUS_CHANGE", "FACILITY", facility.FacilityId,
            new { Status = oldStatus },
            new { Status = status, Reason = request.Reason?.Trim() });
        await dbContext.SaveChangesAsync(ct);

        var warnings = await FacilityWarningsAsync(facility, ct);
        return new FacilitySaveResult((await ToFacilityDtosAsync([facility], ct))[0], warnings);
    }

    /// <summary>
    /// INACTIVE (ngừng hẳn) chỉ khi không còn hợp đồng / đơn đặt chỗ đang xử lý.
    /// TEMPORARILY_CLOSED luôn được phép: chặn đặt mới nhưng vẫn xử lý khách hiện tại (UC19 A1).
    /// </summary>
    private async Task EnsureStatusChangeAllowedAsync(Facility facility, string newStatus, CancellationToken ct)
    {
        if (newStatus != "INACTIVE") return;

        var contractStatuses = OpsRules.OpenContractStatuses.Append("DRAFT").ToArray();
        var openContracts = await dbContext.RentalContracts
            .CountAsync(c => c.Unit.FacilityId == facility.FacilityId && contractStatuses.Contains(c.Status), ct);
        var openReservations = await dbContext.Reservations
            .CountAsync(r => r.FacilityId == facility.FacilityId && OpsRules.OpenReservationStatuses.Contains(r.Status), ct);

        if (openContracts > 0 || openReservations > 0)
        {
            throw new OperationConflictException(
                $"Cơ sở còn {openContracts} hợp đồng và {openReservations} đơn đặt chỗ đang xử lý nên chưa thể ngừng hoạt động. " +
                "Hãy chuyển sang Tạm đóng (TEMPORARILY_CLOSED) để chặn đặt mới mà vẫn phục vụ khách hiện tại.",
                new { openContracts, openReservations });
        }
    }

    private async Task<List<OpsFacilityDto>> ToFacilityDtosAsync(List<Facility> facilities, CancellationToken ct)
    {
        var ids = facilities.Select(f => f.FacilityId).ToList();
        var today = OpsRules.TodayUtc;

        var units = await dbContext.StorageUnits.AsNoTracking()
            .Where(u => ids.Contains(u.FacilityId))
            .Select(u => new { u.FacilityId, u.Status })
            .ToListAsync(ct);

        var pricedTypes = await dbContext.RentalRates.AsNoTracking()
            .Where(r => ids.Contains(r.FacilityId)
                        && r.Status == "ACTIVE"
                        && r.EffectiveFrom <= today
                        && (r.EffectiveTo == null || r.EffectiveTo >= today))
            .Select(r => new { r.FacilityId, r.UnitTypeId })
            .Distinct()
            .ToListAsync(ct);

        var staff = await dbContext.UserFacilities.AsNoTracking()
            .Where(uf => ids.Contains(uf.FacilityId) && uf.Status == "ACTIVE")
            .Select(uf => new { uf.FacilityId, uf.UserId })
            .Distinct()
            .ToListAsync(ct);

        return facilities.Select(f =>
        {
            var own = units.Where(u => u.FacilityId == f.FacilityId).ToList();
            var inUse = own.Count(u => OpsRules.UnitInUseStatuses.Contains(u.Status));
            var operable = own.Count - own.Count(u => OpsRules.UnitUnavailableStatuses.Contains(u.Status));

            return new OpsFacilityDto(
                f.FacilityId,
                f.Name,
                f.Address,
                f.ContactPhone,
                f.OpeningTime?.ToString("HH:mm"),
                f.ClosingTime?.ToString("HH:mm"),
                f.Status,
                own.Count,
                inUse,
                operable,
                OpsRules.OccupancyRate(inUse, operable),
                pricedTypes.Count(r => r.FacilityId == f.FacilityId),
                staff.Count(s => s.FacilityId == f.FacilityId),
                f.CreatedAt,
                f.UpdatedAt,
                f.Latitude,
                f.Longitude);
        }).ToList();
    }

    /// <summary>Cảnh báo không chặn lưu: tên gần giống (UC19 A3), mở cơ sở thiếu cấu hình (UC19 A2).</summary>
    private async Task<IReadOnlyList<string>> FacilityWarningsAsync(Facility facility, CancellationToken ct)
    {
        var warnings = new List<string>();

        var key = NameKey(facility.Name);
        var others = await dbContext.Facilities.AsNoTracking()
            .Where(f => f.FacilityId != facility.FacilityId)
            .Select(f => f.Name)
            .ToListAsync(ct);
        var similar = others.Where(n =>
        {
            var k = NameKey(n);
            return k == key || (key.Length >= 6 && k.Length >= 6 && (k.Contains(key) || key.Contains(k)));
        }).ToList();
        if (similar.Count > 0)
        {
            warnings.Add($"Tên gần giống cơ sở đã có: {string.Join(", ", similar)}. Vui lòng kiểm tra để tránh tạo trùng.");
        }

        if (facility.Status == "ACTIVE")
        {
            var today = OpsRules.TodayUtc;
            var hasRate = await dbContext.RentalRates.AnyAsync(r => r.FacilityId == facility.FacilityId
                && r.Status == "ACTIVE" && r.EffectiveFrom <= today && (r.EffectiveTo == null || r.EffectiveTo >= today), ct);
            var hasUnit = await dbContext.StorageUnits.AnyAsync(u => u.FacilityId == facility.FacilityId, ct);
            var hasStaff = await dbContext.UserFacilities.AnyAsync(uf => uf.FacilityId == facility.FacilityId && uf.Status == "ACTIVE", ct);

            if (!hasRate) warnings.Add("Cơ sở chưa có bảng giá đang áp dụng nên khách chưa đặt chỗ được.");
            if (!hasUnit) warnings.Add("Cơ sở chưa có ô kho nào. Quản lý cơ sở cần khai báo ô kho.");
            if (!hasStaff) warnings.Add("Cơ sở chưa có nhân sự được phân công. Quản trị hệ thống cần phân công nhân viên/quản lý.");
        }

        return warnings;
    }

    private sealed record FacilityInput(string Name, string Address, string? Phone, TimeOnly? Opening, TimeOnly? Closing,
        decimal? Latitude, decimal? Longitude);

    private static FacilityInput ValidateFacility(UpsertFacilityRequest request)
    {
        var name = request.Name?.Trim() ?? "";
        var address = request.Address?.Trim() ?? "";

        if (name.Length == 0) throw new ArgumentException("Tên cơ sở không được để trống.");
        if (name.Length > 150) throw new ArgumentException("Tên cơ sở tối đa 150 ký tự.");
        if (address.Length == 0) throw new ArgumentException("Địa chỉ không được để trống.");
        if (address.Length > 255) throw new ArgumentException("Địa chỉ tối đa 255 ký tự.");

        string? phone = null;
        if (!string.IsNullOrWhiteSpace(request.ContactPhone))
        {
            phone = PhoneSeparators().Replace(request.ContactPhone.Trim(), "");
            if (!PhonePattern().IsMatch(phone))
            {
                throw new ArgumentException("Số điện thoại liên hệ không hợp lệ (8–15 chữ số, có thể bắt đầu bằng +).");
            }
        }

        var opening = ParseTime(request.OpeningTime, "Giờ mở cửa");
        var closing = ParseTime(request.ClosingTime, "Giờ đóng cửa");

        if (opening.HasValue != closing.HasValue)
        {
            throw new ArgumentException("Cần nhập cả giờ mở cửa và giờ đóng cửa, hoặc để trống cả hai.");
        }
        if (opening.HasValue && closing.HasValue && opening.Value >= closing.Value)
        {
            throw new ArgumentException("Giờ mở cửa phải trước giờ đóng cửa.");
        }

        var (latitude, longitude) = ValidateCoordinates(request.Latitude, request.Longitude);

        return new FacilityInput(name, address, phone, opening, closing, latitude, longitude);
    }

    // Toạ độ ghim bản đồ: nhập cả hai hoặc để trống cả hai; phải nằm trong khung lãnh thổ Việt Nam
    // (vĩ độ 8–24, kinh độ 102–110) để bắt lỗi nhập ngược hai ô. Làm tròn 6 chữ số thập phân (~0,1 m).
    private static (decimal? Latitude, decimal? Longitude) ValidateCoordinates(decimal? latitude, decimal? longitude)
    {
        if (latitude is null && longitude is null) return (null, null);
        if (latitude is null || longitude is null)
            throw new ArgumentException("Cần nhập cả vĩ độ và kinh độ, hoặc để trống cả hai.");
        if (latitude < 8m || latitude > 24m || longitude < 102m || longitude > 110m)
            throw new ArgumentException("Toạ độ phải nằm trong Việt Nam (vĩ độ 8–24, kinh độ 102–110). Kiểm tra có nhập ngược hai ô không.");
        return (Math.Round(latitude.Value, 6), Math.Round(longitude.Value, 6));
    }

    private static TimeOnly? ParseTime(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        string[] formats = ["HH:mm", "H:mm", "HH:mm:ss"];
        if (TimeOnly.TryParseExact(value.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
        {
            return t;
        }
        throw new ArgumentException($"{label} phải có dạng HH:mm (ví dụ 07:00).");
    }

    private static string? NormalizeFacilityStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;
        var s = status.Trim().ToUpperInvariant();
        return OpsRules.FacilityStatuses.Contains(s)
            ? s
            : throw new ArgumentException("Trạng thái phải là ACTIVE, INACTIVE hoặc TEMPORARILY_CLOSED.");
    }

    private static string NameKey(string name)
    {
        var normalized = name.Trim().ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(ch)) sb.Append(ch);
        }
        return sb.ToString();
    }

    private static object FacilitySnapshot(Facility f) => new
    {
        f.Name,
        f.Address,
        f.ContactPhone,
        OpeningTime = f.OpeningTime?.ToString("HH:mm"),
        ClosingTime = f.ClosingTime?.ToString("HH:mm"),
        f.Status,
        f.Latitude,
        f.Longitude
    };

    [GeneratedRegex(@"[\s.\-()]")]
    private static partial Regex PhoneSeparators();

    [GeneratedRegex(@"^\+?\d{8,15}$")]
    private static partial Regex PhonePattern();

    // =====================================================================
    // UC20 / UC21 — Chính sách
    // =====================================================================

    public async Task<IReadOnlyList<PolicyDto>> GetPoliciesAsync(PolicyQuery query, CancellationToken ct = default)
    {
        var q = PolicyQueryable();

        if (!string.IsNullOrWhiteSpace(query.PolicyType))
        {
            var type = query.PolicyType.Trim().ToUpperInvariant();
            q = q.Where(p => p.PolicyType == type);
        }
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToUpperInvariant();
            q = q.Where(p => p.Status == status);
        }
        if (query.FacilityId.HasValue) q = q.Where(p => p.FacilityId == query.FacilityId);
        if (query.UnitTypeId.HasValue) q = q.Where(p => p.UnitTypeId == query.UnitTypeId);

        var policies = await q
            .OrderBy(p => p.PolicyType)
            .ThenByDescending(p => p.Status == "ACTIVE")
            .ThenByDescending(p => p.EffectiveFrom)
            .ToListAsync(ct);

        return policies.Select(ToPolicyDto).ToList();
    }

    public async Task<PolicyDto?> GetPolicyAsync(long policyId, CancellationToken ct = default)
    {
        var policy = await PolicyQueryable().FirstOrDefaultAsync(p => p.PolicyId == policyId, ct);
        return policy == null ? null : ToPolicyDto(policy);
    }

    public async Task<PolicyDto> CreatePolicyAsync(UpsertPolicyRequest request, long userId, CancellationToken ct = default)
    {
        var input = await ValidatePolicyAsync(request, strict: false, ct);
        var now = DateTime.UtcNow;

        var policy = new Policy
        {
            CreatedBy = userId,
            Status = "DRAFT",
            CreatedAt = now,
            UpdatedAt = now
        };
        ApplyPolicyInput(policy, input);

        dbContext.Policies.Add(policy);
        await dbContext.SaveChangesAsync(ct);

        Log(userId, "POLICY_CREATE", "POLICY", policy.PolicyId, null, PolicySnapshot(policy));
        await dbContext.SaveChangesAsync(ct);

        return (await GetPolicyAsync(policy.PolicyId, ct))!;
    }

    public async Task<PolicyDto> UpdatePolicyAsync(long policyId, UpsertPolicyRequest request, long userId, CancellationToken ct = default)
    {
        var policy = await dbContext.Policies.FirstOrDefaultAsync(p => p.PolicyId == policyId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy chính sách với ID: {policyId}");

        if (policy.Status != "DRAFT")
        {
            throw new InvalidOperationException(
                "Chỉ sửa được chính sách ở trạng thái Nháp. Muốn thay chính sách đang áp dụng, hãy tạo phiên bản mới " +
                "rồi kích hoạt với replaceExisting=true; bản cũ được giữ lại trong lịch sử (UC20 A2).");
        }

        var input = await ValidatePolicyAsync(request, strict: false, ct);
        var before = PolicySnapshot(policy);

        ApplyPolicyInput(policy, input);
        policy.UpdatedAt = DateTime.UtcNow;

        Log(userId, "POLICY_UPDATE", "POLICY", policy.PolicyId, before, PolicySnapshot(policy));
        await dbContext.SaveChangesAsync(ct);

        return (await GetPolicyAsync(policy.PolicyId, ct))!;
    }

    public async Task<ActivatePolicyResult> ActivatePolicyAsync(long policyId, bool replaceExisting, long userId, CancellationToken ct = default)
    {
        var policy = await dbContext.Policies.FirstOrDefaultAsync(p => p.PolicyId == policyId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy chính sách với ID: {policyId}");

        if (policy.Status == "ACTIVE") throw new InvalidOperationException("Chính sách đang được áp dụng.");
        if (policy.Status == "EXPIRED") throw new InvalidOperationException("Chính sách đã hết hiệu lực, không thể kích hoạt lại. Hãy tạo phiên bản mới.");

        var today = OpsRules.TodayUtc;
        if (policy.EffectiveTo.HasValue && policy.EffectiveTo.Value < today)
        {
            throw new InvalidOperationException("Ngày kết thúc hiệu lực đã qua, không thể kích hoạt.");
        }

        // Kiểm tra đầy đủ tham số trước khi áp dụng (UC20 A3: thiếu tham số thì giữ DRAFT)
        await ValidatePolicyAsync(ToRequest(policy), strict: true, ct);

        // Xung đột cùng mức ưu tiên = cùng loại + cùng phạm vi (BR20) + khoảng hiệu lực giao nhau
        var sameScope = await dbContext.Policies
            .Where(p => p.PolicyId != policy.PolicyId
                        && p.Status == "ACTIVE"
                        && p.PolicyType == policy.PolicyType
                        && p.FacilityId == policy.FacilityId
                        && p.UnitTypeId == policy.UnitTypeId)
            .ToListAsync(ct);
        var conflicts = sameScope
            .Where(p => OpsRules.Overlaps(p.EffectiveFrom, p.EffectiveTo, policy.EffectiveFrom, policy.EffectiveTo))
            .ToList();

        if (conflicts.Count > 0 && !replaceExisting)
        {
            throw new OperationConflictException(
                "Đã có chính sách cùng loại và cùng phạm vi đang áp dụng trong khoảng thời gian này. " +
                "Gửi lại với replaceExisting=true để kết thúc hiệu lực bản cũ và áp dụng bản mới.",
                new { conflictingPolicyIds = conflicts.Select(c => c.PolicyId).ToList() });
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var old in conflicts)
        {
            var before = PolicySnapshot(old);
            if (old.EffectiveFrom >= policy.EffectiveFrom)
            {
                // Bản cũ chưa kịp bắt đầu trước bản mới → thay thế hoàn toàn
                old.Status = "INACTIVE";
            }
            else
            {
                old.EffectiveTo = policy.EffectiveFrom.AddDays(-1);
                if (old.EffectiveTo.Value < today) old.Status = "EXPIRED";
            }
            old.UpdatedAt = now;
            Log(userId, "POLICY_SUPERSEDE", "POLICY", old.PolicyId, before, PolicySnapshot(old));
        }

        var activateBefore = PolicySnapshot(policy);
        policy.Status = "ACTIVE";
        policy.UpdatedAt = now;
        Log(userId, "POLICY_ACTIVATE", "POLICY", policy.PolicyId, activateBefore, PolicySnapshot(policy));

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var ids = conflicts.Select(c => c.PolicyId).ToList();
        var superseded = (await PolicyQueryable().Where(p => ids.Contains(p.PolicyId)).ToListAsync(ct))
            .Select(ToPolicyDto).ToList();

        return new ActivatePolicyResult((await GetPolicyAsync(policy.PolicyId, ct))!, superseded);
    }

    public async Task<PolicyDto> DeactivatePolicyAsync(long policyId, long userId, CancellationToken ct = default)
    {
        var policy = await dbContext.Policies.FirstOrDefaultAsync(p => p.PolicyId == policyId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy chính sách với ID: {policyId}");

        if (policy.Status is "INACTIVE" or "EXPIRED")
        {
            throw new InvalidOperationException("Chính sách đã không còn hiệu lực.");
        }

        var before = PolicySnapshot(policy);
        policy.Status = "INACTIVE";
        policy.UpdatedAt = DateTime.UtcNow;

        Log(userId, "POLICY_DEACTIVATE", "POLICY", policy.PolicyId, before, PolicySnapshot(policy));
        await dbContext.SaveChangesAsync(ct);

        return (await GetPolicyAsync(policy.PolicyId, ct))!;
    }

    public async Task DeleteDraftPolicyAsync(long policyId, long userId, CancellationToken ct = default)
    {
        var policy = await dbContext.Policies.FirstOrDefaultAsync(p => p.PolicyId == policyId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy chính sách với ID: {policyId}");

        if (policy.Status != "DRAFT")
        {
            throw new InvalidOperationException("Chỉ xoá được chính sách Nháp. Chính sách đã áp dụng phải giữ lại để truy vết; hãy ngừng áp dụng thay vì xoá.");
        }

        Log(userId, "POLICY_DELETE_DRAFT", "POLICY", policy.PolicyId, PolicySnapshot(policy), null);
        dbContext.Policies.Remove(policy);
        await dbContext.SaveChangesAsync(ct);
    }

    private sealed record PolicyInput(
        string Name, string Type, string CalculationType, decimal? Value, decimal? Min, decimal? Max,
        string Rule, long? FacilityId, long? UnitTypeId, DateOnly From, DateOnly? To);

    private async Task<PolicyInput> ValidatePolicyAsync(UpsertPolicyRequest request, bool strict, CancellationToken ct)
    {
        var name = request.PolicyName?.Trim() ?? "";
        var rule = request.RuleDescription?.Trim() ?? "";
        var type = request.PolicyType?.Trim().ToUpperInvariant() ?? "";
        var calc = request.CalculationType?.Trim().ToUpperInvariant() ?? "";

        if (name.Length == 0) throw new ArgumentException("Tên chính sách không được để trống.");
        if (name.Length > 150) throw new ArgumentException("Tên chính sách tối đa 150 ký tự.");
        if (rule.Length == 0) throw new ArgumentException("Mô tả điều kiện áp dụng không được để trống.");
        if (!OpsRules.PolicyTypes.Contains(type))
        {
            throw new ArgumentException($"Loại chính sách phải là một trong: {string.Join(", ", OpsRules.PolicyTypes)}.");
        }
        if (!OpsRules.CalculationTypes.Contains(calc))
        {
            throw new ArgumentException("Cách tính phải là FIXED, PERCENTAGE, RANGE hoặc RULE.");
        }
        if (type == "PRICE_RANGE" && calc != "RANGE")
        {
            throw new ArgumentException("Khung giá (PRICE_RANGE) phải dùng cách tính RANGE với giá tối thiểu và tối đa.");
        }

        decimal? value = request.Value, min = request.MinValue, max = request.MaxValue;

        if (value < 0 || min < 0 || max < 0) throw new ArgumentException("Giá trị không được âm.");

        switch (calc)
        {
            case "FIXED":
                if (strict && value == null) throw new ArgumentException("Cách tính FIXED cần nhập giá trị (VND).");
                min = null; max = null;
                break;
            case "PERCENTAGE":
                if (strict && value == null) throw new ArgumentException("Cách tính PERCENTAGE cần nhập phần trăm.");
                if (value > 100) throw new ArgumentException("Phần trăm phải nằm trong khoảng 0–100.");
                min = null; max = null;
                break;
            case "RANGE":
                if (strict && (min == null || max == null)) throw new ArgumentException("Cách tính RANGE cần nhập giá trị tối thiểu và tối đa.");
                if (min.HasValue && max.HasValue && min > max) throw new ArgumentException("Giá trị tối thiểu không được lớn hơn tối đa.");
                value = null;
                break;
            case "RULE":
                // BR23: RULE là hướng dẫn cho người có quyền đánh giá, không lưu tham số để tự thực thi
                value = null; min = null; max = null;
                break;
        }

        if (request.EffectiveTo.HasValue && request.EffectiveTo.Value < request.EffectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu.");
        }

        if (request.FacilityId.HasValue && !await dbContext.Facilities.AnyAsync(f => f.FacilityId == request.FacilityId, ct))
        {
            throw new ArgumentException("Cơ sở áp dụng không tồn tại.");
        }
        if (request.UnitTypeId.HasValue && !await dbContext.UnitTypes.AnyAsync(t => t.UnitTypeId == request.UnitTypeId, ct))
        {
            throw new ArgumentException("Loại kho áp dụng không tồn tại.");
        }

        return new PolicyInput(name, type, calc, value, min, max, rule, request.FacilityId, request.UnitTypeId,
            request.EffectiveFrom, request.EffectiveTo);
    }

    private static void ApplyPolicyInput(Policy policy, PolicyInput input)
    {
        policy.PolicyName = input.Name;
        policy.PolicyType = input.Type;
        policy.CalculationType = input.CalculationType;
        policy.Value = input.Value;
        policy.MinValue = input.Min;
        policy.MaxValue = input.Max;
        policy.RuleDescription = input.Rule;
        policy.FacilityId = input.FacilityId;
        policy.UnitTypeId = input.UnitTypeId;
        policy.EffectiveFrom = input.From;
        policy.EffectiveTo = input.To;
    }

    private static UpsertPolicyRequest ToRequest(Policy p) => new(
        p.PolicyName, p.PolicyType, p.CalculationType ?? "", p.Value, p.MinValue, p.MaxValue,
        p.RuleDescription, p.FacilityId, p.UnitTypeId, p.EffectiveFrom, p.EffectiveTo);

    private IQueryable<Policy> PolicyQueryable() => dbContext.Policies
        .AsNoTracking()
        .Include(p => p.Facility)
        .Include(p => p.UnitType)
        .Include(p => p.CreatedByUser);

    private static PolicyDto ToPolicyDto(Policy p) => new(
        p.PolicyId,
        p.PolicyName,
        p.PolicyType,
        p.CalculationType,
        p.Value,
        p.MinValue,
        p.MaxValue,
        p.RuleDescription,
        (p.FacilityId, p.UnitTypeId) switch
        {
            (null, null) => "GLOBAL",
            (not null, null) => "FACILITY",
            (null, not null) => "UNIT_TYPE",
            _ => "FACILITY_UNIT_TYPE"
        },
        p.FacilityId,
        p.Facility?.Name,
        p.UnitTypeId,
        p.UnitType?.TypeName,
        p.EffectiveFrom,
        p.EffectiveTo,
        p.Status,
        p.CreatedBy,
        p.CreatedByUser?.FullName ?? "",
        p.CreatedAt,
        p.UpdatedAt);

    private static object PolicySnapshot(Policy p) => new
    {
        p.PolicyName,
        p.PolicyType,
        p.CalculationType,
        p.Value,
        p.MinValue,
        p.MaxValue,
        p.RuleDescription,
        p.FacilityId,
        p.UnitTypeId,
        EffectiveFrom = p.EffectiveFrom.ToString("yyyy-MM-dd"),
        EffectiveTo = p.EffectiveTo?.ToString("yyyy-MM-dd"),
        p.Status
    };

    // =====================================================================
    // UC21 — Bảng giá
    // =====================================================================

    public async Task<IReadOnlyList<OpsRateDto>> GetRatesAsync(long? facilityId, long? unitTypeId, bool includeHistory, CancellationToken ct = default)
    {
        var today = OpsRules.TodayUtc;

        var query = dbContext.RentalRates.AsNoTracking().AsQueryable();
        if (facilityId.HasValue) query = query.Where(r => r.FacilityId == facilityId);
        if (unitTypeId.HasValue) query = query.Where(r => r.UnitTypeId == unitTypeId);
        if (!includeHistory)
        {
            // Giá đang áp dụng và giá đã lên lịch cho tương lai
            query = query.Where(r => r.Status == "ACTIVE" && (r.EffectiveTo == null || r.EffectiveTo >= today));
        }

        return await query
            .OrderBy(r => r.Facility.Name)
            .ThenBy(r => r.UnitType.Area)
            .ThenByDescending(r => r.EffectiveFrom)
            .Select(r => new OpsRateDto(
                r.RateId,
                r.FacilityId,
                r.Facility.Name,
                r.UnitTypeId,
                r.UnitType.TypeName,
                r.MonthlyRate,
                r.EffectiveFrom,
                r.EffectiveTo,
                r.Status,
                r.Status == "ACTIVE" && r.EffectiveFrom <= today && (r.EffectiveTo == null || r.EffectiveTo >= today)))
            .ToListAsync(ct);
    }

    public async Task<OpsRateDto> SetRateAsync(SetRateRequest request, long userId, CancellationToken ct = default)
    {
        if (request.MonthlyRate <= 0) throw new ArgumentException("Giá thuê tháng phải lớn hơn 0.");
        if (request.MonthlyRate % 1000 != 0) throw new ArgumentException("Giá thuê tháng phải là bội số của 1.000 VND.");

        var today = OpsRules.TodayUtc;
        var from = request.EffectiveFrom ?? today;
        if (from < today)
        {
            throw new ArgumentException("Không đặt giá có hiệu lực trong quá khứ; giá đã chốt cho khách không bị sửa ngược (BR14).");
        }

        var facility = await dbContext.Facilities.AsNoTracking().FirstOrDefaultAsync(f => f.FacilityId == request.FacilityId, ct)
            ?? throw new ArgumentException("Cơ sở không tồn tại.");
        var unitType = await dbContext.UnitTypes.AsNoTracking().FirstOrDefaultAsync(t => t.UnitTypeId == request.UnitTypeId, ct)
            ?? throw new ArgumentException("Loại kho không tồn tại.");

        // Giá phải nằm trong khung PRICE_RANGE đang áp dụng (UC21 bước 5)
        var range = await OpsRules.FindApplicablePolicyAsync(dbContext, "PRICE_RANGE", facility.FacilityId, unitType.UnitTypeId, from, ct);
        if (range != null
            && ((range.MinValue.HasValue && request.MonthlyRate < range.MinValue.Value)
                || (range.MaxValue.HasValue && request.MonthlyRate > range.MaxValue.Value)))
        {
            throw new ArgumentException(
                $"Giá {request.MonthlyRate:N0} VND nằm ngoài khung giá \"{range.PolicyName}\" " +
                $"({range.MinValue?.ToString("N0") ?? "—"} – {range.MaxValue?.ToString("N0") ?? "—"} VND).");
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(ct);

        var existing = await dbContext.RentalRates
            .Where(r => r.FacilityId == facility.FacilityId
                        && r.UnitTypeId == unitType.UnitTypeId
                        && r.Status == "ACTIVE"
                        && (r.EffectiveTo == null || r.EffectiveTo >= from))
            .ToListAsync(ct);

        foreach (var old in existing)
        {
            var before = RateSnapshot(old);
            if (old.EffectiveFrom >= from)
            {
                // Giá đã lên lịch từ cùng ngày hoặc sau đó → thay bằng giá mới
                old.Status = "INACTIVE";
            }
            else
            {
                // BR19: kết thúc giá cũ ngay trước ngày giá mới bắt đầu, không để hai giá chồng nhau
                old.EffectiveTo = from.AddDays(-1);
                if (old.EffectiveTo.Value < today) old.Status = "EXPIRED";
            }
            Log(userId, "RATE_SUPERSEDE", "RENTAL_RATE", old.RateId, before, RateSnapshot(old));
        }

        var rate = new RentalRate
        {
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            SetBy = userId,
            MonthlyRate = request.MonthlyRate,
            EffectiveFrom = from,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        dbContext.RentalRates.Add(rate);
        await dbContext.SaveChangesAsync(ct);

        Log(userId, "RATE_SET", "RENTAL_RATE", rate.RateId, null, RateSnapshot(rate));
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new OpsRateDto(
            rate.RateId, facility.FacilityId, facility.Name, unitType.UnitTypeId, unitType.TypeName,
            rate.MonthlyRate, rate.EffectiveFrom, rate.EffectiveTo, rate.Status, rate.EffectiveFrom <= today);
    }

    private static object RateSnapshot(RentalRate r) => new
    {
        r.FacilityId,
        r.UnitTypeId,
        r.MonthlyRate,
        EffectiveFrom = r.EffectiveFrom.ToString("yyyy-MM-dd"),
        EffectiveTo = r.EffectiveTo?.ToString("yyyy-MM-dd"),
        r.Status
    };

    // =====================================================================
    // Audit (BR13)
    // =====================================================================

    private void Log(long userId, string action, string entityType, long? entityId, object? oldValue, object? newValue)
    {
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValue = oldValue == null ? null : JsonSerializer.Serialize(oldValue),
            NewValue = newValue == null ? null : JsonSerializer.Serialize(newValue),
            LoggedAt = DateTime.UtcNow
        });
    }
}
