using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ xử lý bàn giao kho (HandoverService) thực thi IHandoverService.
/// Theo quyết định D26: luồng bàn giao kích hoạt hợp đồng cũ đã bị loại bỏ;
/// mã truy cập được cấp tự động sau khi thanh toán và chìa khóa vật lý nhận tại quầy.
/// </summary>
public class HandoverService(AppDbContext dbContext) : IHandoverService
{
    /// <summary>
    /// Phương thức xác nhận bàn giao phía khách hàng cũ (đã vô hiệu hóa theo D26).
    /// Luôn từ chối kích hoạt để tránh hồi quy nghiệp vụ.
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="handoverId">ID biên bản bàn giao.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <exception cref="InvalidOperationException">Luôn ném ra thông báo luồng bàn giao đã được bỏ theo D26.</exception>
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
