using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Workers;

/// <summary>
/// Phiên 3 (D40, D42) · Mỗi 5 phút:
/// - khách đồng ý hoặc quá 48 giờ chưa xác nhận khấu trừ trả kho → hệ thống tự chốt hoàn cọc theo biên bản (D40, D44);
/// - khoản hoàn tiền mặt đã duyệt quá 30 ngày chưa nhận → khách mất khoản hoàn (D44);
/// - còn ≤ 5 ngày tới ngày nhận kho mà ô chưa về Trống → đề xuất đổi kho; quá 48 giờ tự nhận ô đề xuất (D41);
/// - từ 22:00 giờ Việt Nam ghi báo cáo việc tồn cuối ngày cho quản lý từng cơ sở (một lần mỗi ngày).
/// Mốc gọi nhắc 10/20/25 ngày của hoàn tiền mặt được tính khi đọc danh sách, không cần ghi thêm.
/// </summary>
public sealed class FacilityWorkflowWorker(IServiceScopeFactory scopes, ILogger<FacilityWorkflowWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var ops = scope.ServiceProvider.GetRequiredService<IFacilityOpsService>();
                var settled = await ops.AutoSettleExpiredDeductionsAsync(stoppingToken);
                if (settled > 0) logger.LogInformation("Tự chốt hoàn cọc quá hạn xác nhận khấu trừ: {Count} hợp đồng.", settled);
                var forfeited = await ops.ForfeitExpiredCashRefundsAsync(stoppingToken);
                if (forfeited > 0) logger.LogInformation("Khoản hoàn tiền mặt quá 30 ngày chưa nhận (D44): {Count}.", forfeited);
                var conflicts = await ops.DetectUnitConflictsAsync(stoppingToken);
                if (conflicts > 0) logger.LogInformation("Đề xuất đổi kho mới (D41): {Count}.", conflicts);
                await ops.ExpireUnitConflictsAsync(stoppingToken);
                await ops.WriteDailyReportsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi trong tiến trình việc cơ sở (FacilityWorkflowWorker).");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
