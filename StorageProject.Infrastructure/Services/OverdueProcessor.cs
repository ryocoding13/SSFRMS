using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// T11 · Xử lý tự động hợp đồng quá hạn hàng ngày (D32):
/// 1. Cập nhật hợp đồng sắp hết hạn (EXPIRING: trong vòng 30 ngày trước EndDate).
/// 2. Chuyển hợp đồng đã quá hạn sang OVERDUE khi qua ngày EndDate.
/// 3. Tính phí quá hạn 5% cọc ban đầu mỗi ngày trễ, tối đa 100% cọc.
/// 4. Dừng tăng phí khi khách đã gửi yêu cầu trả kho (RETURN_PENDING).
/// 5. Tạo và cập nhật OverdueCase với các mốc: nhắc khách (ngày 10–14), xử lý đồ (ngày 20).
/// </summary>
public static class OverdueProcessor
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    public static async Task ProcessDailyOverdueAsync(AppDbContext dbContext, ILogger? logger = null, CancellationToken ct = default)
    {
        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc + VnOffset);

        // 1. Quét hợp đồng ACTIVE sắp hết hạn trong 30 ngày tới -> EXPIRING
        var expiringContracts = await dbContext.RentalContracts
            .Where(c => c.Status == "ACTIVE" && c.EndDate >= today && c.EndDate <= today.AddDays(30))
            .ToListAsync(ct);

        foreach (var c in expiringContracts)
        {
            c.Status = "EXPIRING";
        }

        // 2. Quét hợp đồng quá hạn (EndDate < today) chưa kết thúc
        var overdueContracts = await dbContext.RentalContracts
            .Include(c => c.OverdueCases)
            .Include(c => c.ReturnInspections)
            .Where(c => c.EndDate < today
                        && c.Status != "COMPLETED"
                        && c.Status != "TERMINATED"
                        && c.Status != "CANCELLED")
            .ToListAsync(ct);

        foreach (var contract in overdueContracts)
        {
            // Chuyển sang OVERDUE nếu chưa trả kho
            if (contract.Status is "ACTIVE" or "EXPIRING")
            {
                contract.Status = "OVERDUE";
            }

            // Tính số ngày quá hạn (D32: dừng tính khi khách gửi yêu cầu trả kho thành công)
            DateOnly calculationDate = today;
            if (contract.Status == "RETURN_PENDING")
            {
                var inspection = contract.ReturnInspections
                    .OrderBy(i => i.CreatedAt)
                    .FirstOrDefault();

                if (inspection != null)
                {
                    calculationDate = DateOnly.FromDateTime(inspection.CreatedAt + VnOffset);
                }
            }

            var overdueDays = Math.Max(0, calculationDate.DayNumber - contract.EndDate.DayNumber);
            if (overdueDays <= 0) continue;

            // Mỗi ngày trễ trừ 5% cọc ban đầu, tối đa 100% cọc
            var rawFee = Math.Round(contract.DepositAmount * 0.05m * overdueDays, 0, MidpointRounding.AwayFromZero);
            var overdueFee = Math.Min(contract.DepositAmount, rawFee);

            // Tìm hồ sơ quá hạn đang mở
            var activeCase = contract.OverdueCases
                .FirstOrDefault(o => o.Status != "RESOLVED" && o.Status != "CANCELLED");

            if (activeCase == null)
            {
                var newCase = new OverdueCase
                {
                    ContractId = contract.ContractId,
                    OverdueFrom = contract.EndDate.AddDays(1),
                    GraceDeadline = contract.EndDate.AddDays(14),
                    OutstandingAmount = overdueFee,
                    Status = overdueDays >= 20 ? "ESCALATED" : "OPEN",
                    OpenedAt = nowUtc,
                    Notes = overdueDays >= 20
                        ? $"Quá hạn ngày thứ {overdueDays}. Đạt mốc ngày 20 xử lý đồ. Phí quá hạn tối đa: {overdueFee:N0} đ."
                        : overdueDays >= 10
                            ? $"Quá hạn ngày thứ {overdueDays}. Mốc nhắc khách ngày 10–14. Phí quá hạn: {overdueFee:N0} đ."
                            : $"Quá hạn ngày thứ {overdueDays}. Phí quá hạn: {overdueFee:N0} đ."
                };

                dbContext.OverdueCases.Add(newCase);
                dbContext.ActivityLogs.Add(new ActivityLog
                {
                    Action = "OVERDUE_CASE_OPENED",
                    EntityType = "RENTAL_CONTRACT",
                    EntityId = contract.ContractId,
                    NewValue = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        contractId = contract.ContractId,
                        overdueDays,
                        overdueFee,
                        status = newCase.Status
                    }),
                    LoggedAt = nowUtc
                });
            }
            else
            {
                // Cập nhật phí quá hạn lũy kế
                activeCase.OutstandingAmount = overdueFee;

                // Mốc ngày 20: Tự động chuyển sang ESCALATED để chuẩn bị di dời đồ
                if (overdueDays >= 20 && activeCase.Status != "ESCALATED" && activeCase.Status != "RESOLVED")
                {
                    activeCase.Status = "ESCALATED";
                    activeCase.Notes = string.IsNullOrWhiteSpace(activeCase.Notes)
                        ? $"Quá hạn ngày thứ {overdueDays}. Đạt mốc ngày 20 cần xử lý đồ. Phí phạt tối đa {overdueFee:N0} đ."
                        : $"{activeCase.Notes}\n[Mốc ngày 20]: Đã đạt mốc 20 ngày xử lý đồ. Phí phạt tối đa {overdueFee:N0} đ.";

                    dbContext.ActivityLogs.Add(new ActivityLog
                    {
                        Action = "OVERDUE_CASE_ESCALATED",
                        EntityType = "RENTAL_CONTRACT",
                        EntityId = contract.ContractId,
                        NewValue = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            contractId = contract.ContractId,
                            overdueDays,
                            overdueFee,
                            reason = "REMOVAL_DAY_20"
                        }),
                        LoggedAt = nowUtc
                    });
                }
                else if (overdueDays >= 10 && overdueDays <= 14 && activeCase.Notes != null && !activeCase.Notes.Contains("Mốc nhắc"))
                {
                    activeCase.Notes = $"{activeCase.Notes}\n[Mốc nhắc ngày 10–14]: Cần liên hệ nhắc khách hàng.";
                }
            }
        }

        await dbContext.SaveChangesAsync(ct);
        logger?.LogInformation("Hoàn tất quét hợp đồng quá hạn ngày {Today}: {Count} hợp đồng đã xử lý.", today, overdueContracts.Count);
    }
}
