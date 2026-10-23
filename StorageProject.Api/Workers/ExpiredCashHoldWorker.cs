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
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await CashHoldExpiry.ExpireAsync(db, stoppingToken);
                await UnitStartActivation.ActivateAsync(db, stoppingToken);
            } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Không xử lý được các đơn hết hạn giữ chỗ"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
