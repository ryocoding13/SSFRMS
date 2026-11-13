using StorageProject.Infrastructure.Services;

namespace StorageProject.Api.Workers;

public sealed class CustomerEmailWorker(
    IServiceScopeFactory scopes, CustomerEmailWakeup wakeup, ILogger<CustomerEmailWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<CustomerEmailDelivery>().DeliverPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                logger.LogError("Không xử lý được hàng đợi email SafeSpace. Loại lỗi: {ErrorType}.", ex.GetType().Name);
            }
            try
            {
                await wakeup.WaitAsync(TimeSpan.FromSeconds(30), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
        } while (!stoppingToken.IsCancellationRequested);
    }
}
