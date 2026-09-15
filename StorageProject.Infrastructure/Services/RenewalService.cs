using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class RenewalService(AppDbContext dbContext) : IRenewalService
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
                r.ApprovedAt
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

        if (contract.Status != "ACTIVE")
        {
            throw new InvalidOperationException($"Chỉ hợp đồng ở trạng thái 'ACTIVE' mới có thể gia hạn. Trạng thái hiện tại: {contract.Status}");
        }

        // Check if there is already a pending renewal
        var hasPendingRenewal = await dbContext.ContractRenewals
            .AnyAsync(r => r.ContractId == contractId && (r.Status == "PENDING_PAYMENT" || r.Status == "PENDING_APPROVAL"), ct);

        if (hasPendingRenewal)
        {
            throw new InvalidOperationException("Hợp đồng đã có yêu cầu gia hạn đang chờ xử lý.");
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
            Status = "PENDING_PAYMENT",
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ContractRenewals.Add(renewal);
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
            renewal.ApprovedAt
        );
    }
}
