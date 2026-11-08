using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Workers;

/// <summary>
/// Tiến trình nền quét các yêu cầu gia hạn hợp đồng hết hạn thanh toán (ExpiredRenewalWorker).
/// Chạy định kỳ mỗi 1 phút: chuyển trạng thái yêu cầu gia hạn PENDING quá hạn thanh toán sang EXPIRED.
/// </summary>
public class ExpiredRenewalWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<ExpiredRenewalWorker> logger) : BackgroundService
{
    /// <summary>
    /// Vòng lặp thực thi chính của tiến trình nền.
    /// </summary>
    /// <param name="stoppingToken">Cờ huỷ khi ứng dụng dừng hoạt động.</param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var renewalService = scope.ServiceProvider.GetRequiredService<IRenewalService>();
                await renewalService.ExpirePendingRenewalsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Lỗi khi quét yêu cầu gia hạn hết hạn.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
