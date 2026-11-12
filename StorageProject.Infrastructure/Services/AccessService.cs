using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ quản lý kiểm soát ra vào ô kho tự quản (Access Control Service - UC13 / D26 / D33).
/// Quản lý việc cấp phát và xác thực mã mở cửa thông minh (mã QR có chữ ký HMAC và mã PIN 6 số dự phòng),
/// kiểm tra điều kiện hợp đồng có hiệu lực (không cho phép mở trước ngày bắt đầu hoặc sau khi trả kho/quá hạn).
/// </summary>
public class AccessService(AppDbContext dbContext, AccessQrOptions options) : IAccessService
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    /// <summary>
    /// Lấy thông tin mã QR và mã PIN dự phòng để mở cửa ô kho cho khách hàng có hợp đồng hợp lệ.
    /// </summary>
    /// <param name="customerId">ID của khách hàng sở hữu hợp đồng.</param>
    /// <param name="contractId">ID hợp đồng thuê kho.</param>
    /// <param name="ct">Token hủy bất đồng bộ.</param>
    /// <returns>DTO chứa mã QR, mã PIN 6 số, số ô kho và thông tin hiệu lực.</returns>
    /// <exception cref="KeyNotFoundException">Khi không tìm thấy hợp đồng hoặc không đúng chủ sở hữu.</exception>
    /// <exception cref="InvalidOperationException">Khi hợp đồng đã trả kho, chưa đến ngày bắt đầu hoặc mã bị thu hồi.</exception>
    public async Task<AccessQrDto> GetQrAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var contract = await dbContext.RentalContracts
            .Include(c => c.Customer)
            .Include(c => c.Unit).ThenInclude(u => u.UnitType)
            .Include(c => c.Unit).ThenInclude(u => u.Facility)
            .Include(c => c.HandoverRecord)
            .Include(c => c.AccessCredentials)
            .FirstOrDefaultAsync(c => c.ContractId == contractId, ct);

        if (contract == null || contract.CustomerId != customerId)
        {
            throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
        }

        if (contract.Status is "RETURN_PENDING" or "COMPLETED" or "TERMINATED" or "CANCELLED"
            || (contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE")))
        {
            throw new InvalidOperationException("Hợp đồng đã trả kho hoặc hết hiệu lực, mã mở cửa không còn dùng được.");
        }

        // #59 (thay L13): khách xem được QR/PIN trước ngày thuê, nhưng máy quét chỉ mở từ 00:00 ngày bắt đầu (giờ VN).
        var usableNow = OpsRules.TodayLocal >= contract.StartDate;

        var latestCred = LatestCredential(contract, false);
        if (latestCred == null || latestCred.Status != "ACTIVE")
        {
            throw new InvalidOperationException("Mã ra vào chưa được cấp hoặc đã bị thu hồi.");
        }

        var (code, _) = ComputeCodes(contract.ContractId, latestCred.CredentialId, latestCred.IssuedAt);
        var pinCred = LatestCredential(contract, true);
        var backupCode = pinCred?.Status == "ACTIVE" ? ComputeCodes(contract.ContractId, pinCred.CredentialId, pinCred.IssuedAt).BackupCode : "";

        return new AccessQrDto(
            contract.ContractId,
            code,
            backupCode,
            contract.Unit.UnitNumber,
            contract.Unit.UnitType?.TypeName ?? "Kho tự quản",
            contract.Unit.LocationDescription ?? contract.Unit.Floor ?? contract.Unit.Zone,
            contract.EndDate.ToString("yyyy-MM-dd"),
            contract.StartDate.ToString("yyyy-MM-dd"),
            usableNow,
            contract.StartDate.ToString("yyyy-MM-dd") + "T00:00:00"
        );
    }

    /// <summary>
    /// Quét và xác thực mã mở cửa (mã QR hoặc mã PIN 6 số) tại khóa thông minh hoặc đầu đọc thẻ cơ sở.
    /// </summary>
    /// <param name="rawCode">Chuỗi mã nhận được từ máy quét hoặc bàn phím số (SSQR-... hoặc mã 6 chữ số).</param>
    /// <param name="ipAddress">Địa chỉ IP của thiết bị quét.</param>
    /// <param name="ct">Token hủy bất đồng bộ.</param>
    /// <param name="unitNumber">Số ô kho (bắt buộc khi quét bằng mã PIN dự phòng để tránh trùng giữa các ô).</param>
    /// <returns>Kết quả xác thực: OPEN (mở cửa thành công) hoặc DENIED kèm lý do từ chối cụ thể.</returns>
    public async Task<ScanResultDto> ScanAsync(string? rawCode, string? ipAddress, CancellationToken ct = default, string? unitNumber = null)
    {
        if (string.IsNullOrWhiteSpace(rawCode))
        {
            return await LogAndDenyAsync(null, null, null, null, "Chưa nhận được mã. Đưa mã QR vào máy quét hoặc nhập mã dự phòng.", ipAddress, ct);
        }

        var cleaned = rawCode.Trim();
        scanMethod = cleaned.StartsWith("SSQR-", StringComparison.OrdinalIgnoreCase) ? "QR" : "PIN";
        RentalContract? contract = null;
        AccessCredential? latestCred = null;

        var qrMatch = Regex.Match(cleaned, @"^SSQR-(\d+)-([A-Fa-f0-9]{8})$", RegexOptions.IgnoreCase);
        if (qrMatch.Success)
        {
            var contractId = long.TryParse(qrMatch.Groups[1].Value, out var parsedId) ? parsedId : 0;
            var hex = qrMatch.Groups[2].Value;

            contract = await dbContext.RentalContracts
                .Include(c => c.Customer)
                .Include(c => c.Unit)
                .Include(c => c.HandoverRecord)
                .Include(c => c.AccessCredentials)
                .FirstOrDefaultAsync(c => c.ContractId == contractId, ct);

            if (contract == null)
            {
                return await LogAndDenyAsync(null, null, null, null, "Mã không đúng. Kiểm tra lại mã trên ứng dụng hoặc mã dự phòng.", ipAddress, ct);
            }

            latestCred = LatestCredential(contract, false);
            if (latestCred == null)
            {
                return await LogAndDenyAsync(contract.ContractId, contract.Unit.UnitNumber, contract.Customer.FullName, FormatContractCode(contract), "Kho chưa được bàn giao cho khách.", ipAddress, ct);
            }

            var (expectedCode, _) = ComputeCodes(contract.ContractId, latestCred.CredentialId, latestCred.IssuedAt);
            if (!expectedCode.EndsWith($"-{hex}", StringComparison.OrdinalIgnoreCase))
            {
                return await LogAndDenyAsync(contract.ContractId, contract.Unit.UnitNumber, contract.Customer.FullName, FormatContractCode(contract), "Mã không đúng. Kiểm tra lại mã trên ứng dụng hoặc mã dự phòng.", ipAddress, ct);
            }
        }
        else
        {
            var digitsOnly = Regex.Replace(cleaned, @"\s+", "");
            // D51: PIN 6 số chỉ dùng 1–9 (bàn phím máy quét không có số 0)
            if (digitsOnly.Length == 6 && digitsOnly.All(char.IsDigit) && digitsOnly.Contains('0'))
                return await LogAndDenyAsync(null, unitNumber, null, null, "Mã PIN gồm 6 số từ 1 đến 9.", ipAddress, ct);
            if (digitsOnly.Length == 6 && digitsOnly.All(char.IsDigit) && !string.IsNullOrWhiteSpace(unitNumber))
            {
                var movingIn = await RenewalUnitMove.ContractsMovingIntoAsync(dbContext, unitNumber, ct);
                var candidates = await dbContext.RentalContracts
                    .Include(c => c.Customer)
                    .Include(c => c.Unit)
                    .Include(c => c.HandoverRecord)
                    .Include(c => c.AccessCredentials)
                    // D46: hợp đồng đang chuyển sang ô này (3 ngày cuối kỳ cũ) dùng PIN hiện tại mở được ô mới.
                    .Where(c => (c.Unit.UnitNumber == unitNumber || movingIn.Contains(c.ContractId))
                                && c.AccessCredentials.Any(a => a.Status == "ACTIVE" && a.CredentialType != "KEY"))
                    .OrderByDescending(c => c.ContractId)
                    .ToListAsync(ct);

                foreach (var candidate in candidates)
                {
                    var cred = LatestCredential(candidate, true);
                    if (cred != null)
                    {
                        var (_, expectedBackup) = ComputeCodes(candidate.ContractId, cred.CredentialId, cred.IssuedAt);
                        if (expectedBackup == digitsOnly)
                        {
                            if (contract != null) return await LogAndDenyAsync(null, null, null, null, "PIN trùng giữa các cơ sở. Vui lòng quét mã QR.", ipAddress, ct);
                            contract = candidate;
                            latestCred = cred;
                        }
                    }
                }

                if (contract == null || latestCred == null)
                {
                    return await LogAndDenyAsync(null, null, null, null, "Mã không đúng. Kiểm tra lại mã trên ứng dụng hoặc mã dự phòng.", ipAddress, ct);
                }
            }
            else
            {
                return await LogAndDenyAsync(null, null, null, null, "Mã không đúng. Kiểm tra lại mã trên ứng dụng hoặc mã dự phòng.", ipAddress, ct);
            }
        }

        // D46: trong 3 ngày cuối kỳ cũ, mã hiện tại mở được cả ô mới khách đã trả tiền gia hạn sang.
        var movingTarget = !string.IsNullOrWhiteSpace(unitNumber) && contract.Unit.UnitNumber != unitNumber
                           && await RenewalUnitMove.CanOpenTargetAsync(dbContext, contract.ContractId, unitNumber, ct);
        if (!string.IsNullOrWhiteSpace(unitNumber) && contract.Unit.UnitNumber != unitNumber && !movingTarget)
            return await LogAndDenyAsync(null, null, null, null, "Mã không đúng ô kho.", ipAddress, ct);
        var scannedUnit = movingTarget ? unitNumber! : contract.Unit.UnitNumber;
        var customerName = contract.Customer.FullName;
        var contractCode = FormatContractCode(contract);
        var vnToday = DateOnly.FromDateTime(DateTime.UtcNow + VnOffset);

        // Thứ tự kiểm tra và lý do từ chối theo thiết kế C07
        // #3: Thẻ RETURNED hoặc hợp đồng đã kết thúc/trả kho
        if (latestCred.Status == "RETURNED" || contract.Status is "RETURN_PENDING" or "COMPLETED" or "TERMINATED" or "CANCELLED")
        {
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, "Mã đã hết hiệu lực — hợp đồng đã trả kho.", ipAddress, ct);
        }

        // #4: Thẻ bị thu hồi / mất / thay thế
        if (latestCred.Status is "REVOKED" or "LOST" or "REPLACED")
        {
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, "Mã đã bị thu hồi. Liên hệ nhân viên cơ sở để được cấp lại.", ipAddress, ct);
        }

        // #6: Hợp đồng không còn hiệu lực
        if (contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE"))
        {
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, "Hợp đồng không còn hiệu lực.", ipAddress, ct);
        }

        // #59: đúng câu như khách thấy trong Kho của tôi; không ghi "sau ngày …" để tránh hiểu là ngày hôm sau
        if (contract.StartDate > vnToday)
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, NotYetMessage(contract.StartDate), ipAddress, ct);
        if (latestCred.Status != "ACTIVE")
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, "Mã không còn hiệu lực.", ipAddress, ct);

        // #7: Quá hạn
        if (contract.Status == "OVERDUE" || contract.EndDate <= vnToday)
        {
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, "Hợp đồng đã quá hạn. Vui lòng gia hạn hoặc liên hệ cơ sở.", ipAddress, ct);
        }

        // Đạt toàn bộ kiểm tra -> OPEN
        var now = DateTime.UtcNow;
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = null,
            Action = "ACCESS_SCANNED",
            EntityType = "CONTRACT",
            EntityId = contract.ContractId,
            NewValue = JsonSerializer.Serialize(new { result = "OPEN", unit = scannedUnit, reason = (string?)null, method = scanMethod }),
            IpAddress = ipAddress,
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);

        return new ScanResultDto("OPEN", scannedUnit, customerName, contractCode, now, null);
    }

    /// <summary>Lấy thông tin credential gần nhất theo loại (PIN hoặc QR).</summary>
    private static AccessCredential? LatestCredential(RentalContract contract, bool pin)
    {
        var items = contract.AccessCredentials.Where(c => c.CredentialType != "KEY");
        var prefix = pin ? "PIN-" : "QR-";
        var matching = items.Where(c => (c.CredentialReference ?? "").StartsWith(prefix));
        return matching.OrderByDescending(c => c.IssuedAt).ThenByDescending(c => c.CredentialId).FirstOrDefault()
            ?? items.Where(c => !(c.CredentialReference ?? "").StartsWith("QR-") && !(c.CredentialReference ?? "").StartsWith("PIN-"))
                .OrderByDescending(c => c.IssuedAt).ThenByDescending(c => c.CredentialId).FirstOrDefault();
    }

    /// <summary>Tính toán mã QR kèm chữ ký HMAC-SHA256 và mã PIN 6 số dự phòng tương ứng.</summary>
    private (string Code, string BackupCode) ComputeCodes(long contractId, long credentialId, DateTime issuedAt)
    {
        var rawData = $"{contractId}:{credentialId}:{issuedAt.ToUniversalTime():O}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(options.Secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawData));

        var hex = Convert.ToHexString(hash)[..8].ToUpperInvariant();
        var code = $"SSQR-{contractId}-{hex}";

        // D51: PIN 6 số, mỗi số 1–9 (không có 0) để khớp bàn phím máy quét
        var backupCode = new string(Enumerable.Range(0, 6).Select(i => (char)('1' + hash[4 + i] % 9)).ToArray());

        return (code, backupCode);
    }

    /// <summary>Cách mở của lần quét đang xử lý (QR / PIN) — ghi vào nhật ký, không lưu nguyên mã.</summary>
    private string? scanMethod;

    /// <summary>#59: câu báo khi quét sớm hơn ngày bắt đầu thuê.</summary>
    public static string NotYetMessage(DateOnly start) =>
        $"Chưa đến ngày sử dụng. Có thể mở cửa từ 00:00 ngày {start:dd/MM/yyyy}.";

    /// <summary>Định dạng mã hợp đồng chuẩn hiển thị (HĐ-yyyy-xxxx).</summary>
    private static string FormatContractCode(RentalContract c) =>
        $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";

    /// <summary>Ghi log nhật ký kiểm toán và trả về kết quả từ chối mở cửa DENIED.</summary>
    private async Task<ScanResultDto> LogAndDenyAsync(
        long? contractId,
        string? scannedUnit,
        string? customerName,
        string? contractCode,
        string reason,
        string? ipAddress,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = null,
            Action = "ACCESS_SCANNED",
            EntityType = "CONTRACT",
            EntityId = contractId,
            NewValue = JsonSerializer.Serialize(new { result = "DENIED", unit = scannedUnit, reason, method = scanMethod }),
            IpAddress = ipAddress,
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);

        return new ScanResultDto("DENIED", scannedUnit, customerName, contractCode, now, reason);
    }
}
