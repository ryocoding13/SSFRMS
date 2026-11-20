using Microsoft.EntityFrameworkCore;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// D67 (20/11/2026): quản lý chốt đối soát trả kho và xác nhận hoàn tiền trong một lệnh.
/// SQLite trong bộ nhớ — chưa thay cho kiểm SQL Server thật.
/// </summary>
public sealed partial class D32RefundEvidenceTests
{
    [Fact]
    public async Task D67_SettleWithPayout_BankTransfer_MarksRefundPaidAtOnce()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0);

        var result = await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c), null, default, payoutConfirmed: true);

        Assert.Equal(1_000_000m, result.Refund);
        Assert.Equal("PAID", result.RefundStatus);
        f.Db.ChangeTracker.Clear();
        var refund = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal("PAID", refund.Status);
        Assert.Equal("BANK_TRANSFER", refund.PaymentMethod);
        Assert.NotNull(refund.PaidAt);
        Assert.Null(refund.TransactionReference);
        Assert.True(await f.Db.ActivityLogs.AnyAsync(l => l.Action == "DEPOSIT_REFUND_TRANSFERRED" && l.EntityId == c.ContractId));
    }

    [Fact]
    public async Task D67_SettleWithPayout_Cash_HandsCashToCounter()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0, CashMoveOut(Photo(Jpeg)));

        var result = await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c), null, default, payoutConfirmed: true);

        Assert.Equal("PAID", result.RefundStatus);
        f.Db.ChangeTracker.Clear();
        var refund = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal("PAID", refund.Status);
        Assert.Equal("CASH", refund.PaymentMethod);
        Assert.True(await f.Db.ActivityLogs.AnyAsync(l => l.Action == "DEPOSIT_REFUND_CASH_PAID" && l.EntityId == c.ContractId));
    }

    [Fact]
    public async Task D67_SettleWithoutPayout_KeepsTwoStepFlow()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0);

        Assert.Equal("PENDING", (await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c))).RefundStatus);
    }
}
