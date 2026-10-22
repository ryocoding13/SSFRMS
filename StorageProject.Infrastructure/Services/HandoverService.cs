using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class HandoverService(AppDbContext dbContext) : IHandoverService
{
    public async Task ConfirmCustomerHandoverAsync(long customerId, long handoverId, CancellationToken ct = default)
    {
        var handover = await dbContext.HandoverRecords
            .Include(h => h.Contract)
                .ThenInclude(c => c.Unit)
            .FirstOrDefaultAsync(h => h.HandoverId == handoverId && h.Contract.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy biên bản bàn giao phù hợp.");

        // The old customer activation endpoint cannot activate or extend a contract.
        throw new InvalidOperationException("Chức năng bàn giao đã được bỏ. Hợp đồng và mã ra vào được cấp tự động sau thanh toán; chìa khóa nhận tại quầy.");
    }
}
