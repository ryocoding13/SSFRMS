using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class ContractService(AppDbContext dbContext) : IContractService
{
    public async Task<IReadOnlyList<ContractSummaryDto>> GetMyContractsAsync(long customerId, CancellationToken ct = default)
    {
        return await dbContext.RentalContracts
            .AsNoTracking()
            .Include(c => c.Unit)
                .ThenInclude(u => u.Facility)
            .Include(c => c.Unit)
                .ThenInclude(u => u.UnitType)
            .Where(c => c.CustomerId == customerId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new ContractSummaryDto(
                c.ContractId,
                c.ReservationId,
                c.UnitId,
                c.Unit.UnitNumber,
                c.Unit.Facility.Name,
                c.Unit.UnitType.TypeName,
                c.StartDate,
                c.EndDate,
                c.AgreedMonthlyRate,
                c.DepositAmount,
                c.Status,
                c.ActivatedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<ContractDetailDto?> GetContractDetailAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var c = await dbContext.RentalContracts
            .AsNoTracking()
            .Include(x => x.Unit)
                .ThenInclude(u => u.Facility)
            .Include(x => x.Unit)
                .ThenInclude(u => u.UnitType)
            .Include(x => x.Payments)
            .Include(x => x.ContractRenewals)
            .Include(x => x.HandoverRecord)
            .Where(x => x.ContractId == contractId && x.CustomerId == customerId)
            .FirstOrDefaultAsync(ct);

        if (c == null) return null;

        var handover = c.HandoverRecord;

        var handoverDto = handover == null ? null : new HandoverSummaryDto(
            handover.HandoverId,
            handover.Status,
            handover.ScheduledAt,
            handover.HandoverAt,
            handover.CustomerConfirmed,
            handover.StaffConfirmed
        );

        var payments = c.Payments
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentDto(
                p.PaymentId,
                p.ContractId,
                p.RenewalId,
                p.PaymentType,
                p.Amount,
                p.Currency,
                p.PaymentMethod,
                p.TransactionReference,
                p.DueDate,
                p.PaidAt,
                p.Status,
                p.CreatedAt
            ))
            .ToList();

        var renewals = c.ContractRenewals
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
            .ToList();

        return new ContractDetailDto(
            c.ContractId,
            c.ReservationId,
            c.UnitId,
            c.Unit.UnitNumber,
            c.Unit.Facility.Name,
            c.Unit.UnitType.TypeName,
            c.StartDate,
            c.EndDate,
            c.AgreedMonthlyRate,
            c.DepositAmount,
            c.Status,
            c.TerminationReason,
            c.CreatedAt,
            c.ActivatedAt,
            c.CompletedAt,
            handoverDto,
            payments,
            renewals
        );
    }
}
