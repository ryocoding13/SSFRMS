using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class RenewalService(AppDbContext dbContext, IPayOSGateway gateway) : IRenewalService
{
    public async Task<IReadOnlyList<RenewalDto>> GetContractRenewalsAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var ownsContract = await dbContext.RentalContracts
            .AnyAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct);

        if (!ownsContract)
        {
            return [];
        }

        return await dbContext.ContractRenewals
            .AsNoTracking()
            .Where(r => r.ContractId == contractId)
            .OrderByDescending(r => r.RequestedAt)
            .Select(r => new RenewalDto(
                r.RenewalId,
                r.ContractId,
                r.OldEndDate,
                r.NewEndDate,
                r.RenewalPeriodMonths,
                r.OldMonthlyRate,
                r.NewMonthlyRate,
                r.RenewalAmount,
                r.Status,
                r.RequestedAt,
                r.ApprovedAt,
                r.PaymentDeadlineAt,
                r.AppliedAt,
                r.ExpiredAt,
                r.Payments.Where(p => p.PaymentType == "RENEWAL").Select(p => (long?)p.PaymentId).FirstOrDefault(),
                r.PolicyVersion,
                r.AcceptedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<RenewalDto> RequestRenewalAsync(long customerId, long contractId, CreateRenewalRequest request, CancellationToken ct = default)
    {
        if (request.RenewalPeriodMonths <= 0)
        {
            throw new ArgumentException("Thời gian gia hạn phải lớn hơn 0 tháng.");
        }

        var contract = await dbContext.RentalContracts
            .Include(c => c.Unit)
            .Where(c => c.ContractId == contractId && c.CustomerId == customerId)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Không tìm thấy hợp đồng hợp lệ.");

        if (contract.Status != "ACTIVE" && contract.Status != "EXPIRING")
        {
            throw new InvalidOperationException($"Chỉ hợp đồng ở trạng thái 'ACTIVE' mới có thể gia hạn. Trạng thái hiện tại: {contract.Status}");
        }

        // Vietnam time now
        var vnToday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        if (contract.EndDate <= vnToday)
        {
            throw new InvalidOperationException("Hợp đồng đã đến hoặc quá ngày hết hạn, không thể gửi yêu cầu gia hạn.");
        }

        // Check if there is already a pending or approved renewal open
        var hasOpenRenewal = await dbContext.ContractRenewals
            .AnyAsync(r => r.ContractId == contractId && (r.Status == "PENDING" || r.Status == "APPROVED"), ct);

        if (hasOpenRenewal)
        {
            throw new InvalidOperationException("Hợp đồng đã có yêu cầu gia hạn đang chờ xử lý hoặc chờ thanh toán.");
        }

        // Policy consent verification
        int? consentVersion = null;
        DateTime? consentAcceptedAt = null;
        if (request.PolicyVersion.HasValue)
        {
            if (request.Accepted != true)
            {
                throw new ArgumentException("Bạn phải đồng ý với chính sách cho thuê để gửi yêu cầu gia hạn.");
            }

            var currentPolicy = await dbContext.RentalPolicyVersions
                .OrderByDescending(v => v.Version)
                .FirstOrDefaultAsync(v => v.IsCurrent, ct);

            var expectedVersion = currentPolicy?.Version ?? 1;
            if (request.PolicyVersion.Value != expectedVersion)
            {
                throw new InvalidOperationException("Phiên bản chính sách không còn hiệu lực. Vui lòng tải lại trang để chấp thuận bản mới nhất.");
            }

            consentVersion = expectedVersion;
            consentAcceptedAt = DateTime.UtcNow;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var activeRate = await dbContext.RentalRates
            .Where(r => r.FacilityId == contract.Unit.FacilityId 
                     && r.UnitTypeId == contract.Unit.UnitTypeId 
                     && r.EffectiveFrom <= today 
                     && (r.EffectiveTo == null || r.EffectiveTo >= today))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var newRate = activeRate?.MonthlyRate ?? contract.AgreedMonthlyRate;
        var oldEndDate = contract.EndDate;
        var newEndDate = oldEndDate.AddMonths(request.RenewalPeriodMonths);
        var renewalAmount = newRate * request.RenewalPeriodMonths;

        var renewal = new ContractRenewal
        {
            ContractId = contract.ContractId,
            OldEndDate = oldEndDate,
            NewEndDate = newEndDate,
            RenewalPeriodMonths = request.RenewalPeriodMonths,
            OldMonthlyRate = contract.AgreedMonthlyRate,
            NewMonthlyRate = newRate,
            RenewalAmount = renewalAmount,
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow,
            PolicyVersion = consentVersion,
            AcceptedAt = consentAcceptedAt,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ContractRenewals.Add(renewal);
        await dbContext.SaveChangesAsync(ct);

        if (consentVersion.HasValue)
        {
            var policyVer = await dbContext.RentalPolicyVersions
                .FirstOrDefaultAsync(v => v.Version == consentVersion.Value, ct);

            dbContext.PolicyConsents.Add(new PolicyConsent
            {
                CustomerId = customerId,
                PolicyVersionId = policyVer?.PolicyVersionId ?? 1,
                RenewalId = renewal.RenewalId,
                ContractId = contract.ContractId,
                AcceptedAt = consentAcceptedAt!.Value,
                Channel = "WEB_CUSTOMER"
            });
            await dbContext.SaveChangesAsync(ct);
        }

        return new RenewalDto(
            renewal.RenewalId,
            renewal.ContractId,
            renewal.OldEndDate,
            renewal.NewEndDate,
            renewal.RenewalPeriodMonths,
            renewal.OldMonthlyRate,
            renewal.NewMonthlyRate,
            renewal.RenewalAmount,
            renewal.Status,
            renewal.RequestedAt,
            renewal.ApprovedAt,
            renewal.PaymentDeadlineAt,
            renewal.AppliedAt,
            renewal.ExpiredAt,
            null,
            renewal.PolicyVersion,
            renewal.AcceptedAt
        );
    }

    public async Task<RenewalDto> SelectCounterPaymentAsync(long customerId, long renewalId, CancellationToken ct = default)
    {
        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract)
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId && r.Contract.CustomerId == customerId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn của bạn.");

        if (renewal.Status != "APPROVED")
        {
            throw new InvalidOperationException($"Chỉ yêu cầu gia hạn ở trạng thái 'APPROVED' mới có thể chọn thanh toán tại quầy. Trạng thái hiện tại: {renewal.Status}");
        }

        var now = DateTime.UtcNow;
        if (renewal.PaymentDeadlineAt.HasValue && now >= renewal.PaymentDeadlineAt.Value)
        {
            throw new InvalidOperationException("Yêu cầu gia hạn đã hết hạn thanh toán.");
        }

        // Cancel any open PayOS link
        var payment = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL" && p.Status == "PENDING")
            ?? throw new InvalidOperationException("Không tìm thấy khoản thanh toán gia hạn chờ xử lý.");

        var openCheckouts = await dbContext.PaymentCheckouts
            .Where(c => c.PaymentId == payment.PaymentId && c.Status == "PENDING")
            .ToListAsync(ct);

        foreach (var c in openCheckouts)
        {
            try
            {
                await gateway.CancelAsync(c.OrderCode);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Chưa xác nhận huỷ được link PayOS. Vui lòng thử lại trước khi đổi sang thanh toán tại quầy.", ex);
            }
            c.Status = "CANCELLED";
            c.UpdatedAt = now;
        }

        payment.PaymentMethod = "CASH";
        payment.UpdatedAt = now;

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = customerId,
            EntityType = "RENEWAL",
            EntityId = renewal.RenewalId,
            Action = "COUNTER_PAYMENT_SELECTED",
            NewValue = JsonSerializer.Serialize(new { renewal.RenewalId, payment.PaymentId, payment.Amount }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);

        return new RenewalDto(
            renewal.RenewalId,
            renewal.ContractId,
            renewal.OldEndDate,
            renewal.NewEndDate,
            renewal.RenewalPeriodMonths,
            renewal.OldMonthlyRate,
            renewal.NewMonthlyRate,
            renewal.RenewalAmount,
            renewal.Status,
            renewal.RequestedAt,
            renewal.ApprovedAt,
            renewal.PaymentDeadlineAt,
            renewal.AppliedAt,
            renewal.ExpiredAt,
            payment.PaymentId,
            renewal.PolicyVersion,
            renewal.AcceptedAt
        );
    }

    public async Task<IReadOnlyList<CounterRenewalDto>> GetCounterRenewalsAsync(long userId, CancellationToken ct = default)
    {
        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct);

        if (userFacility == null) return [];

        var facilityId = userFacility.FacilityId;
        var now = DateTime.UtcNow;

        var renewals = await dbContext.ContractRenewals
            .AsNoTracking()
            .Include(r => r.Contract).ThenInclude(c => c.Customer)
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .Include(r => r.Payments)
            .Where(r => r.Contract.Unit.FacilityId == facilityId
                     && (r.Status == "APPROVED" || (r.Status == "PAID" && r.AppliedAt >= now.AddDays(-1)))
                     && r.Payments.Any(p => p.PaymentType == "RENEWAL" && p.PaymentMethod == "CASH"))
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);

        var list = new List<CounterRenewalDto>();
        foreach (var r in renewals)
        {
            var p = r.Payments.FirstOrDefault(x => x.PaymentType == "RENEWAL");
            if (p == null) continue;

            // Only show if not expired
            if (r.Status == "APPROVED" && r.PaymentDeadlineAt.HasValue && r.PaymentDeadlineAt.Value <= now)
            {
                continue;
            }

            list.Add(new CounterRenewalDto(
                Id: $"GHQ-{r.RenewalId:D4}",
                RenewalId: r.RenewalId,
                PaymentId: p.PaymentId,
                ContractId: $"HĐ-{r.ContractId:D4}",
                ContractCode: $"HĐ-{r.ContractId:D4}",
                FacilityId: facilityId,
                Unit: r.Contract.Unit?.UnitNumber ?? "—",
                Customer: r.Contract.Customer?.FullName ?? "—",
                Amount: r.RenewalAmount,
                Months: r.RenewalPeriodMonths,
                PaymentDeadlineAt: r.PaymentDeadlineAt,
                Status: r.Status == "PAID" ? "PAID" : "PENDING"
            ));
        }

        return list;
    }

    public async Task CollectCounterRenewalAsync(long userId, string id, CancellationToken ct = default)
    {
        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.");

        var renewalId = FacilityOpsStateStore.ParseIdNumber(id);
        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");

        if (renewal.Contract.Unit.FacilityId != userFacility.FacilityId)
        {
            throw new UnauthorizedAccessException("Yêu cầu gia hạn không thuộc cơ sở do bạn phụ trách.");
        }

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{renewal.ContractId}", ct);

        var success = await RenewalSettlement.RecordAsync(
            dbContext,
            renewal.ContractId,
            renewal.RenewalId,
            "CASH",
            $"CASH:{userId}:{DateTime.UtcNow.Ticks}",
            userId,
            ct
        );

        if (!success)
        {
            throw new InvalidOperationException("Không thể xác nhận thu tiền (đã thanh toán hoặc quá hạn thanh toán).");
        }

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<RenewalDto> ApproveRenewalAsync(long userId, long renewalId, CancellationToken ct = default)
    {
        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");

        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.");

        if (renewal.Contract.Unit.FacilityId != userFacility.FacilityId)
        {
            throw new UnauthorizedAccessException("Yêu cầu gia hạn không thuộc cơ sở do bạn phụ trách.");
        }

        if (renewal.Status != "PENDING")
        {
            throw new InvalidOperationException("Yêu cầu này đã được xử lý.");
        }

        var contract = renewal.Contract;
        if (contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE"))
        {
            throw new InvalidOperationException("Hợp đồng không còn hiệu lực để gia hạn.");
        }

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{contract.ContractId}", ct);

        var now = DateTime.UtcNow;
        var vnToday = DateOnly.FromDateTime(now.AddHours(7));

        // Re-check rate at approval time
        var activeRate = await dbContext.RentalRates
            .Where(r => r.FacilityId == contract.Unit.FacilityId
                     && r.UnitTypeId == contract.Unit.UnitTypeId
                     && r.EffectiveFrom <= vnToday
                     && (r.EffectiveTo == null || r.EffectiveTo >= vnToday))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var newRate = activeRate?.MonthlyRate ?? contract.AgreedMonthlyRate;
        renewal.NewMonthlyRate = newRate;
        renewal.RenewalAmount = newRate * renewal.RenewalPeriodMonths;

        // Payment deadline: min(now + 24h, 00:00 contract expiry date in Vietnam time)
        var contractExpiryVn = renewal.OldEndDate.ToDateTime(TimeOnly.MinValue);
        var contractExpiryUtc = contractExpiryVn.AddHours(-7);
        var deadline = now.AddHours(24);
        if (contractExpiryUtc < deadline)
        {
            deadline = contractExpiryUtc;
        }

        renewal.PaymentDeadlineAt = deadline;
        renewal.Status = "APPROVED";
        renewal.ApprovedBy = userId;
        renewal.ApprovedAt = now;
        // EndDate remains OldEndDate!

        // Ensure single RENEWAL payment
        var payment = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL");
        if (payment == null)
        {
            payment = new Payment
            {
                ContractId = contract.ContractId,
                RenewalId = renewal.RenewalId,
                PaymentType = "RENEWAL",
                Amount = renewal.RenewalAmount,
                Currency = "VND",
                PaymentMethod = "BANK_TRANSFER",
                DueDate = renewal.OldEndDate,
                Status = "PENDING",
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.Payments.Add(payment);
        }
        else
        {
            payment.Amount = renewal.RenewalAmount;
            payment.Status = "PENDING";
            payment.UpdatedAt = now;
        }

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            EntityType = "RENEWAL",
            EntityId = renewal.RenewalId,
            Action = "RENEWAL_APPROVED",
            NewValue = JsonSerializer.Serialize(new
            {
                renewal.RenewalId,
                contractId = contract.ContractId,
                amount = renewal.RenewalAmount,
                paymentDeadlineAt = deadline,
                newEndDate = renewal.NewEndDate.ToString("yyyy-MM-dd")
            }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new RenewalDto(
            renewal.RenewalId,
            renewal.ContractId,
            renewal.OldEndDate,
            renewal.NewEndDate,
            renewal.RenewalPeriodMonths,
            renewal.OldMonthlyRate,
            renewal.NewMonthlyRate,
            renewal.RenewalAmount,
            renewal.Status,
            renewal.RequestedAt,
            renewal.ApprovedAt,
            renewal.PaymentDeadlineAt,
            renewal.AppliedAt,
            renewal.ExpiredAt,
            payment.PaymentId,
            renewal.PolicyVersion,
            renewal.AcceptedAt
        );
    }

    public async Task RejectRenewalAsync(long userId, long renewalId, string reason, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Nhập lý do từ chối để gửi cho khách hàng.");
        }

        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");

        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.");

        if (renewal.Contract.Unit.FacilityId != userFacility.FacilityId)
        {
            throw new UnauthorizedAccessException("Yêu cầu gia hạn không thuộc cơ sở do bạn phụ trách.");
        }

        if (renewal.Status != "PENDING")
        {
            throw new InvalidOperationException("Yêu cầu này đã được xử lý.");
        }

        var now = DateTime.UtcNow;
        renewal.Status = "REJECTED";
        renewal.ApprovedBy = userId;
        renewal.ApprovedAt = now;

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            EntityType = "RENEWAL",
            EntityId = renewal.RenewalId,
            Action = "RENEWAL_REJECTED",
            NewValue = JsonSerializer.Serialize(new { renewal.RenewalId, reason }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task ExpirePendingRenewalsAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var expiredRenewals = await dbContext.ContractRenewals
            .Include(r => r.Payments)
            .Where(r => r.Status == "APPROVED" && r.PaymentDeadlineAt.HasValue && r.PaymentDeadlineAt.Value <= now)
            .ToListAsync(ct);

        foreach (var r in expiredRenewals)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{r.ContractId}", ct);

            r.Status = "EXPIRED";
            r.ExpiredAt = now;

            foreach (var p in r.Payments.Where(p => p.PaymentType == "RENEWAL" && p.Status == "PENDING"))
            {
                p.Status = "FAILED";
                p.UpdatedAt = now;

                var checkouts = await dbContext.PaymentCheckouts
                    .Where(c => c.PaymentId == p.PaymentId && c.Status == "PENDING")
                    .ToListAsync(ct);

                foreach (var c in checkouts)
                {
                    c.Status = "EXPIRED";
                    c.UpdatedAt = now;
                }
            }

            dbContext.ActivityLogs.Add(new ActivityLog
            {
                EntityType = "RENEWAL",
                EntityId = r.RenewalId,
                Action = "RENEWAL_EXPIRED",
                NewValue = JsonSerializer.Serialize(new { r.RenewalId, r.ContractId, reason = "PAYMENT_DEADLINE_EXCEEDED" }),
                LoggedAt = now
            });

            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
    }
}
