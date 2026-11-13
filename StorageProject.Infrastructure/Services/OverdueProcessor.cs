using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// T11 · Xử lý tự động hợp đồng quá hạn hàng ngày (D32):
/// 1. Cập nhật hợp đồng sắp hết hạn (EXPIRING: trong vòng 30 ngày trước EndDate).
/// 2. Chuyển hợp đồng đã quá hạn sang OVERDUE khi qua ngày EndDate.
/// 3. Tính phí quá hạn theo chính sách OVERDUE (mặc định 5% cọc ban đầu mỗi ngày trễ), tối đa 100% cọc.
/// 4. Dừng tăng phí khi khách đã gửi yêu cầu trả kho (RETURN_PENDING).
/// 5. Tạo và cập nhật OverdueCase với các mốc: nhắc khách (ngày 10–14), xử lý đồ (ngày 20).
/// </summary>
public static class OverdueProcessor
{
    /// <summary>Độ lệch múi giờ Việt Nam (UTC+7) dùng để tính toán ngày bắt đầu quá hạn chính xác.</summary>
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    /// <summary>
    /// Thực thi tiến trình quét quá hạn tự động theo lịch định kỳ hàng ngày (Job / Worker).
    /// </summary>
    /// <param name="dbContext">DbContext truy vấn và lưu trạng thái cơ sở dữ liệu.</param>
    /// <param name="logger">Logger ghi nhật ký hệ thống (tuỳ chọn).</param>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    public static async Task ProcessDailyOverdueAsync(AppDbContext dbContext, ILogger? logger = null, CancellationToken ct = default)
    {
        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc + VnOffset);

        // 1. ACTIVE sắp hết hạn trong 30 ngày -> EXPIRING (P2: OpsRules.DefaultExpiringThresholdDays). Cập nhật có điều kiện trong một câu lệnh để không ghi đè
        //    trạng thái khách vừa đổi (ví dụ vừa gửi trả kho) giữa lúc đọc và lúc lưu (S05).
        await dbContext.RentalContracts
            .Where(c => c.Status == "ACTIVE" && c.EndDate >= today && c.EndDate <= today.AddDays(OpsRules.DefaultExpiringThresholdDays))
            .ExecuteUpdateAsync(u => u.SetProperty(c => c.Status, "EXPIRING"), ct);
        dbContext.ChangeTracker.Clear(); // ExecuteUpdate không qua tracker; đọc lại từ DB sau bước này

        await CustomerEmailDelivery.QueueRenewalRemindersAsync(dbContext, today, nowUtc, ct);

        // 2. Hợp đồng quá hạn (EndDate < today) chưa kết thúc
        var overdueIds = await dbContext.RentalContracts.AsNoTracking()
            .Where(c => c.EndDate < today
                        && c.Status != "COMPLETED"
                        && c.Status != "TERMINATED"
                        && c.Status != "CANCELLED")
            .Select(c => c.ContractId)
            .ToListAsync(ct);

        foreach (var contractId in overdueIds)
        {
            // S05: cùng khoá với đăng ký trả kho (ContractService.RegisterMoveOutAsync) nên không chạy chồng với yêu cầu
            // trả kho, và nhiều instance worker xử lý cùng một hợp đồng lần lượt (SQL Server sp_getapplock).
            dbContext.ChangeTracker.Clear();
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"move-out:{contractId}", ct);
            var contract = await dbContext.RentalContracts
                .Include(c => c.Unit)
                .Include(c => c.OverdueCases)
                .Include(c => c.ReturnInspections)
                .FirstOrDefaultAsync(c => c.ContractId == contractId, ct);
            if (contract == null || contract.Status is "COMPLETED" or "TERMINATED" or "CANCELLED")
            {
                await tx.CommitAsync(ct);
                continue;
            }

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

            // P1 / D32: Dùng chung bộ chọn policy OVERDUE và tính phí
            var calc = await OpsRules.CalculateContractOverdueAsync(dbContext, contract, calculationDate, isSettled: false, ct);
            var overdueDays = calc.OverdueDays;
            var overdueFee = calc.OverdueFee;

            if (overdueDays <= 0)
            {
                await dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                continue;
            }

            if (contract.Status == "OVERDUE")
                await CustomerEmailDelivery.QueueOverdueAsync(dbContext, contract.ContractId,
                    new OverdueEmailDetails(contract.EndDate, overdueDays, overdueFee), nowUtc, ct);

            // Tìm hồ sơ quá hạn đang mở
            var activeCase = contract.OverdueCases
                .FirstOrDefault(o => o.Status != "RESOLVED" && o.Status != "CANCELLED");

            if (activeCase == null)
            {
                var newCase = new OverdueCase
                {
                    ContractId = contract.ContractId,
                    OverdueFrom = contract.EndDate.AddDays(1),
                    GraceDeadline = contract.EndDate.AddDays(OpsRules.DefaultOverdueReminderEndDay),
                    OutstandingAmount = overdueFee,
                    Status = overdueDays >= calc.DisposalDay ? "ESCALATED" : "OPEN",
                    OpenedAt = nowUtc,
                    Notes = overdueDays >= calc.DisposalDay
                        ? $"Quá hạn ngày thứ {overdueDays}. Đạt mốc ngày 20 xử lý đồ. Phí quá hạn tối đa: {overdueFee:N0} đ."
                        : overdueDays >= OpsRules.DefaultOverdueReminderStartDay
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
                if (overdueDays >= OpsRules.DefaultOverdueDisposalDay && activeCase.Status != "ESCALATED" && activeCase.Status != "RESOLVED")
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
                else if (overdueDays >= OpsRules.DefaultOverdueReminderStartDay && overdueDays <= OpsRules.DefaultOverdueReminderEndDay && activeCase.Notes != null && !activeCase.Notes.Contains("Mốc nhắc"))
                {
                    activeCase.Notes = $"{activeCase.Notes}\n[Mốc nhắc ngày 10–14]: Cần liên hệ nhắc khách hàng.";
                }
            }

            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

        dbContext.ChangeTracker.Clear();
        logger?.LogInformation("Hoàn tất quét hợp đồng quá hạn ngày {Today}: {Count} hợp đồng đã xử lý.", today, overdueIds.Count);
    }
}
