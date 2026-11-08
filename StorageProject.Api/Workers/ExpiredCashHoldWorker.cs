using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;

namespace StorageProject.Api.Workers;

/// <summary>
/// Tiến trình nền quét và xử lý đơn đặt chỗ giữ bằng tiền mặt quá hạn (ExpiredCashHoldWorker).
/// Chạy định kỳ mỗi 1 phút: huỷ đơn hết hạn giữ chỗ và tự động kích hoạt trạng thái sử dụng cho các đơn đến ngày bắt đầu.
/// </summary>
public sealed class ExpiredCashHoldWorker(IServiceScopeFactory scopes, ILogger<ExpiredCashHoldWorker> logger) : BackgroundService
{
    /// <summary>
    /// Vòng lặp thực thi chính của tiến trình nền.
    /// </summary>
    /// <param name="stoppingToken">Cờ huỷ khi ứng dụng dừng hoạt động.</param>
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
