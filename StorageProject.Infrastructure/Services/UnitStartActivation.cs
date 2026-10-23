using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// F12/M02 · Ô kho đang giữ chỗ (RESERVED) chuyển sang đang thuê (OCCUPIED) khi đến ngày bắt đầu của hợp đồng
/// (giờ Việt Nam, D27: "đã sử dụng" tính từ StartDate). Nhận chìa khóa không đổi trạng thái ô (D26).
/// Chạy lặp lại an toàn: ô đã OCCUPIED không bị đụng tới và không ghi lịch sử thêm.
/// </summary>
public static class UnitStartActivation
{
    public static async Task<int> ActivateAsync(AppDbContext db, CancellationToken ct = default)
    {
        var today = OpsRules.TodayLocal;
        var contracts = await db.RentalContracts.Include(c => c.Unit)
            .Where(c => (c.Status == "ACTIVE" || c.Status == "EXPIRING") && c.StartDate <= today && c.Unit.Status == "RESERVED")
            .OrderBy(c => c.ContractId).Take(200).ToListAsync(ct);
        if (contracts.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var c in contracts)
        {
            // Thay đổi tự động ghi theo khách của hợp đồng (khóa ngoại user), giống ContractProvisioning.
            db.UnitStatusHistories.Add(new UnitStatusHistory
            {
                Unit = c.Unit, ChangedBy = c.CustomerId, OldStatus = "RESERVED", NewStatus = "OCCUPIED",
                ChangedAt = now, Reason = $"Đến ngày bắt đầu thuê của hợp đồng #{c.ContractId}"
            });
            c.Unit.Status = "OCCUPIED";
            c.Unit.UpdatedAt = now;
        }
        await db.SaveChangesAsync(ct);
        return contracts.Count;
    }
}
