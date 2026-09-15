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

        handover.CustomerConfirmed = true;

        // If staff already confirmed, or now both confirmed, complete handover
        if (handover.StaffConfirmed)
        {
            handover.Status = "COMPLETED";
            handover.HandoverAt = DateTime.UtcNow;

            // Activate contract
            handover.Contract.Status = "ACTIVE";
            handover.Contract.ActivatedAt = DateTime.UtcNow;

            // Update Unit status
            if (handover.Contract.Unit != null)
            {
                handover.Contract.Unit.Status = "OCCUPIED";
            }
        }

        await dbContext.SaveChangesAsync(ct);
    }
}
