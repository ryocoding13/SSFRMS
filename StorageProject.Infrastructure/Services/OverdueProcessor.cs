using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// T11 · Xử lý tự động hợp đồng quá hạn hàng ngày (D32 / B02 / B09):
/// 1. Cập nhật hợp đồng sắp hết hạn (EXPIRING: trong vòng 30 ngày trước EndDate).
/// 2. Chuyển hợp đồng đã quá hạn sang OVERDUE khi qua ngày EndDate.
/// 3. Tính phí quá hạn theo chính sách OVERDUE (B02: DEPOSIT_PERCENT_PER_DAY), tối đa 100% cọc.
/// 4. Dừng tăng phí khi khách đã gửi yêu cầu trả kho (RETURN_PENDING).
/// 5. Tạo và cập nhật OverdueCase với các mốc: nhắc khách (ngày 10–14), xử lý đồ (ngày 20).
/// 6. Đồng thời bảo vệ tính toàn vẹn với CheckoutTransaction khóa theo từng hợp đồng.
/// </summary>
public static class OverdueProcessor
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    public static async Task ProcessDailyOverdueAsync(AppDbContext dbContext, ILogger? logger = null, CancellationToken ct = default)
    {
        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc + VnOffset);

        // 1. ACTIVE sắp hết hạn trong 30 ngày -> EXPIRING. Cập nhật có điều kiện trong một câu lệnh để không ghi đè
        //    trạng thái khách vừa đổi (ví dụ vừa gửi trả kho) giữa lúc đọc và lúc lưu (S05).
        await dbContext.RentalContracts
            .Where(c => c.Status == "ACTIVE" && c.EndDate >= today && c.EndDate <= today.AddDays(30))
            .ExecuteUpdateAsync(u => u.SetProperty(c => c.Status, "EXPIRING"), ct);
        dbContext.ChangeTracker.Clear(); // ExecuteUpdate không qua tracker; đọc lại từ DB sau bước này

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

            var overdueDays = Math.Max(0, calculationDate.DayNumber - contract.EndDate.DayNumber);
            if (overdueDays <= 0)
            {
                await dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                continue;
            }

            // S05 / D32: tỷ lệ lấy từ chính sách OVERDUE đang áp dụng (B02), không ghi cứng; tối đa 100% cọc.
            var policy = await OpsRules.FindApplicablePolicyAsync(dbContext, "OVERDUE", contract.Unit.FacilityId, contract.Unit.UnitTypeId, today, ct);
            decimal overdueFee;
            if (policy?.Value is decimal)
            {
                overdueFee = StorageProject.Core.Policies.RefundPolicy.OverdueFeeFor(policy.CalculationType, policy.Value,
                    contract.DepositAmount, overdueDays, maxCap: contract.DepositAmount);
            }
            else
            {
                logger?.LogWarning("Chưa có chính sách OVERDUE cho hợp đồng {ContractId}; dùng mặc định {Rate}%/ngày theo D32.", contract.ContractId, OpsRules.DefaultOverdueRatePerDay);
                overdueFee = StorageProject.Core.Policies.RefundPolicy.OverdueFeeFor("DEPOSIT_PERCENT_PER_DAY", OpsRules.DefaultOverdueRatePerDay,
                    contract.DepositAmount, overdueDays, maxCap: contract.DepositAmount);
            }

            int removalDay = (policy?.MaxValue.HasValue == true && policy.MaxValue.Value > 0)
                ? (int)policy.MaxValue.Value
                : OpsRules.DefaultOverdueDisposalDay;
            int reminderDayStart = (policy?.MinValue.HasValue == true && policy.MinValue.Value > 0)
                ? (int)policy.MinValue.Value
                : OpsRules.DefaultOverdueReminderStartDay;
            int reminderDayEnd = OpsRules.DefaultOverdueReminderEndDay;

            // Tìm hồ sơ quá hạn đang mở
            var activeCase = contract.OverdueCases
                .FirstOrDefault(o => o.Status != "RESOLVED" && o.Status != "CANCELLED");

            if (activeCase == null)
            {
                var newCase = new OverdueCase
                {
                    ContractId = contract.ContractId,
                    OverdueFrom = contract.EndDate.AddDays(1),
                    GraceDeadline = contract.EndDate.AddDays(reminderDayEnd),
                    OutstandingAmount = overdueFee,
                    Status = overdueDays >= removalDay ? "ESCALATED" : "OPEN",
                    OpenedAt = nowUtc,
                    Notes = overdueDays >= removalDay
                        ? $"Quá hạn ngày thứ {overdueDays}. Đạt mốc ngày {removalDay} xử lý đồ. Phí quá hạn tối đa: {overdueFee:N0} đ."
                        : overdueDays >= reminderDayStart
                            ? $"Quá hạn ngày thứ {overdueDays}. Mốc nhắc khách ngày {reminderDayStart}–{reminderDayEnd}. Phí quá hạn: {overdueFee:N0} đ."
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

                if (overdueDays >= removalDay && activeCase.Status != "ESCALATED" && activeCase.Status != "RESOLVED")
                {
                    activeCase.Status = "ESCALATED";
                    activeCase.Notes = string.IsNullOrWhiteSpace(activeCase.Notes)
                        ? $"Quá hạn ngày thứ {overdueDays}. Đạt mốc ngày {removalDay} cần xử lý đồ. Phí phạt tối đa {overdueFee:N0} đ."
                        : $"{activeCase.Notes}\n[Mốc ngày {removalDay}]: Đã đạt mốc {removalDay} ngày xử lý đồ. Phí phạt tối đa {overdueFee:N0} đ.";

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
                            reason = $"REMOVAL_DAY_{removalDay}"
                        }),
                        LoggedAt = nowUtc
                    });
                }
                else if (overdueDays >= reminderDayStart && overdueDays <= reminderDayEnd && activeCase.Notes != null && !activeCase.Notes.Contains("Mốc nhắc"))
                {
                    activeCase.Notes = $"{activeCase.Notes}\n[Mốc nhắc ngày {reminderDayStart}–{reminderDayEnd}]: Cần liên hệ nhắc khách hàng.";
                }
            }

            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

dbContext.ChangeTracker.Clear();
        logger?.LogInformation("Hoàn tất quét hợp đồng quá hạn ngày {Today}: {Count} hợp đồng đã xử lý.", today, overdueIds.Count);
    }
}
