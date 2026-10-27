using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Workers;

public class ExpiredRenewalWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<ExpiredRenewalWorker> logger) : BackgroundService
{
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
