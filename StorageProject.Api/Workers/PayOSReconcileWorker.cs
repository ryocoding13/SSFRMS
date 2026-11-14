using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Workers;

/// <summary>
/// Mục 61 (14/11): đối soát PayOS định kỳ 10 giây/lần.
/// Webhook PayOS không gọi được về backend chạy trên máy cá nhân (localhost), nên tiến trình này hỏi thẳng PayOS
/// các đơn đặt chỗ / khoản gia hạn còn chờ và ghi nhận thanh toán giống webhook (cấp hợp đồng, gửi email).
/// Webhook vẫn hoạt động như cũ khi backend có địa chỉ công khai; ghi nhận trùng chỉ tính một lần.
/// </summary>
public sealed class PayOSReconcileWorker(IServiceScopeFactory scopes, ILogger<PayOSReconcileWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var settled = await scope.ServiceProvider.GetRequiredService<IPayOSService>().ReconcilePendingAsync(stoppingToken);
                if (settled > 0) logger.LogInformation("Đối soát PayOS: ghi nhận {Count} khoản đã thanh toán.", settled);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                logger.LogError("Lỗi khi đối soát PayOS. Loại lỗi: {ErrorType}.", ex.GetType().Name);
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }
}
