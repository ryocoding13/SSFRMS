using Microsoft.EntityFrameworkCore;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// Mục 61 (14/11): backend chạy localhost không nhận được webhook PayOS; đối soát bằng cách hỏi thẳng PayOS.
/// </summary>
public sealed partial class CheckoutTests
{
    [Fact] public async Task StatusPollingReconcilesPaidPayosOrderWithoutWebhook() {
        await using var f = await Fixture.Create();
        var before = await f.PayOS.GetReservationPaymentStatusAsync(f.Order.ReservationId);
        Assert.False(before!.IsPaid); // PayOS chưa nhận tiền → vẫn chờ, không ghi gì
        Assert.Empty(await f.Db.Payments.ToListAsync());

        f.Gateway.Polled = new(12345, 4000000);
        await Task.Delay(TimeSpan.FromSeconds(5.1)); // hỏi PayOS tối đa 1 lần / 5 giây / đơn
        var after = await f.PayOS.GetReservationPaymentStatusAsync(f.Order.ReservationId);
        Assert.True(after!.IsPaid);
        Assert.Equal(4000000, (await f.Db.Payments.ToListAsync()).Sum(p => p.Amount));
        Assert.Single(await f.Db.RentalContracts.ToListAsync());
        Assert.Single(await f.Db.ActivityLogs.Where(l => l.Action == "CONTRACT_EMAIL_QUEUED").ToListAsync());

        // Webhook về muộn sau khi đã đối soát: không ghi tiền lần hai
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        Assert.Equal(4000000, (await f.Db.Payments.ToListAsync()).Sum(p => p.Amount));
        Assert.Single(await f.Db.RentalContracts.ToListAsync());
    }

    [Fact] public async Task ReconcileWorkerSettlesPendingOrdersOnceAndIgnoresWrongAmount() {
        await using var f = await Fixture.Create();
        f.Gateway.Polled = new(12345, 1); // số tiền lệch → không ghi nhận
        Assert.Equal(0, await f.PayOS.ReconcilePendingAsync());
        Assert.Empty(await f.Db.Payments.ToListAsync());

        f.Gateway.Polled = new(12345, 4000000);
        Assert.Equal(1, await f.PayOS.ReconcilePendingAsync());
        var polls = f.Gateway.Polls;
        Assert.Equal(0, await f.PayOS.ReconcilePendingAsync()); // đơn đã trả không còn trong danh sách chờ
        Assert.Equal(polls, f.Gateway.Polls);
        Assert.Equal(2, await f.Db.Payments.CountAsync());
    }
}
