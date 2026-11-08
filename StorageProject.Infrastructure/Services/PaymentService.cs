using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ tra cứu thông tin thanh toán (PaymentService) thực thi IPaymentService.
/// Cung cấp lịch sử thanh toán theo hợp đồng hoặc chi tiết từng giao dịch thanh toán của khách hàng.
/// </summary>
public class PaymentService(AppDbContext dbContext) : IPaymentService
{
    /// <summary>
    /// Lấy danh sách các khoản thanh toán gắn liền với hợp đồng thuê của khách hàng.
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="contractId">ID hợp đồng thuê.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Danh sách các khoản thanh toán.</returns>
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
                p.CreatedAt,
                p.Renewal != null ? p.Renewal.PaymentDeadlineAt : null
            ))
            .ToListAsync(ct);
    }

    /// <summary>
    /// Lấy thông tin chi tiết của một khoản thanh toán thuộc sở hữu của khách hàng.
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="paymentId">ID khoản thanh toán.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Chi tiết khoản thanh toán hoặc null nếu không tìm thấy.</returns>
    public async Task<PaymentDto?> GetPaymentByIdAsync(long customerId, long paymentId, CancellationToken ct = default)
    {
        var p = await dbContext.Payments
            .AsNoTracking()
            .Include(x => x.Contract)
            .Include(x => x.Renewal)
            .Where(x => x.PaymentId == paymentId && ((x.ContractId != null && x.Contract.CustomerId == customerId) || (x.ReservationId != null && x.Reservation.CustomerId == customerId)))
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
            p.CreatedAt,
            p.Renewal?.PaymentDeadlineAt
        );
    }
}
