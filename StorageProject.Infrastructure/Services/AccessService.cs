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

public class AccessService(AppDbContext dbContext, AccessQrOptions options) : IAccessService
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

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
            contract.StartDate.ToString("yyyy-MM-dd")
        );
    }

    public async Task<ScanResultDto> ScanAsync(string? rawCode, string? ipAddress, CancellationToken ct = default, string? unitNumber = null)
    {
        if (string.IsNullOrWhiteSpace(rawCode))
        {
            return await LogAndDenyAsync(null, null, null, null, "Chưa nhận được mã. Đưa mã QR vào máy quét hoặc nhập mã dự phòng.", ipAddress, ct);
        }

        var cleaned = rawCode.Trim();
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
            if (digitsOnly.Length == 6 && digitsOnly.All(char.IsDigit) && !string.IsNullOrWhiteSpace(unitNumber))
            {
                var candidates = await dbContext.RentalContracts
                    .Include(c => c.Customer)
                    .Include(c => c.Unit)
                    .Include(c => c.HandoverRecord)
                    .Include(c => c.AccessCredentials)
                    .Where(c => c.Unit.UnitNumber == unitNumber && c.AccessCredentials.Any(a => a.Status == "ACTIVE" && a.CredentialType != "KEY"))
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

        if (!string.IsNullOrWhiteSpace(unitNumber) && contract.Unit.UnitNumber != unitNumber)
            return await LogAndDenyAsync(null, null, null, null, "Mã không đúng ô kho.", ipAddress, ct);
        var scannedUnit = contract.Unit.UnitNumber;
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

        if (contract.StartDate > vnToday)
            return await LogAndDenyAsync(contract.ContractId, scannedUnit, customerName, contractCode, "Chưa đến ngày bắt đầu hợp đồng.", ipAddress, ct);
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
            NewValue = JsonSerializer.Serialize(new { result = "OPEN", unit = scannedUnit, reason = (string?)null }),
            IpAddress = ipAddress,
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);

        return new ScanResultDto("OPEN", scannedUnit, customerName, contractCode, now, null);
    }

    private static AccessCredential? LatestCredential(RentalContract contract, bool pin)
    {
        var items = contract.AccessCredentials.Where(c => c.CredentialType != "KEY");
        var prefix = pin ? "PIN-" : "QR-";
        var matching = items.Where(c => (c.CredentialReference ?? "").StartsWith(prefix));
        return matching.OrderByDescending(c => c.IssuedAt).ThenByDescending(c => c.CredentialId).FirstOrDefault()
            ?? items.Where(c => !(c.CredentialReference ?? "").StartsWith("QR-") && !(c.CredentialReference ?? "").StartsWith("PIN-"))
                .OrderByDescending(c => c.IssuedAt).ThenByDescending(c => c.CredentialId).FirstOrDefault();
    }

    private (string Code, string BackupCode) ComputeCodes(long contractId, long credentialId, DateTime issuedAt)
    {
        var rawData = $"{contractId}:{credentialId}:{issuedAt.ToUniversalTime():O}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(options.Secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawData));

        var hex = Convert.ToHexString(hash)[..8].ToUpperInvariant();
        var code = $"SSQR-{contractId}-{hex}";

        var uintVal = BitConverter.ToUInt32(hash, 0);
        var backupCode = (uintVal % 1000000).ToString("D6");

        return (code, backupCode);
    }

    private static string FormatContractCode(RentalContract c) =>
        $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";

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
            NewValue = JsonSerializer.Serialize(new { result = "DENIED", unit = scannedUnit, reason }),
            IpAddress = ipAddress,
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);

        return new ScanResultDto("DENIED", scannedUnit, customerName, contractCode, now, reason);
    }
}
