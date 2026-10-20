using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;

namespace StorageProject.Api.Workers;

public sealed class ExpiredCashHoldWorker(IServiceScopeFactory scopes, ILogger<ExpiredCashHoldWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do {
            try {
                using var scope = scopes.CreateScope();
                await CashHoldExpiry.ExpireAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), stoppingToken);
            } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Không xử lý được các đơn hết hạn giữ chỗ"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
