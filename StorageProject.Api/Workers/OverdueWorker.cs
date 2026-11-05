using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;

namespace StorageProject.Api.Workers;

/// <summary>
/// T11 · Tiến trình chạy ngầm quét hợp đồng quá hạn hàng ngày (D32).
/// Định kỳ kiểm tra hợp đồng đến hạn, chuyển EXPIRING/OVERDUE,
/// tính phí 5%/ngày (cap 100% cọc) và tạo/cập nhật OverdueCase.
/// </summary>
public sealed class OverdueWorker(IServiceScopeFactory scopes, ILogger<OverdueWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await OverdueProcessor.ProcessDailyOverdueAsync(db, logger, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi trong tiến trình quét hợp đồng quá hạn hàng ngày (OverdueWorker).");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
