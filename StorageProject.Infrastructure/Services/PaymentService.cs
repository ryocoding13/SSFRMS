using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class PaymentService(AppDbContext dbContext) : IPaymentService
{
    public async Task<IReadOnlyList<PaymentDto>> GetContractPaymentsAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        // Verify customer owns the contract
        var ownsContract = await dbContext.RentalContracts
            .AnyAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct);

        if (!ownsContract)
        {
            return [];
        }

        return await dbContext.Payments
            .AsNoTracking()
            .Where(p => p.ContractId == contractId)
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
            .ToListAsync(ct);
    }

    public async Task<PaymentDto?> GetPaymentByIdAsync(long customerId, long paymentId, CancellationToken ct = default)
    {
        var p = await dbContext.Payments
            .AsNoTracking()
            .Include(x => x.Contract)
            .Where(x => x.PaymentId == paymentId && x.Contract.CustomerId == customerId)
            .FirstOrDefaultAsync(ct);

        if (p == null) return null;

        return new PaymentDto(
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
        );
    }
}
