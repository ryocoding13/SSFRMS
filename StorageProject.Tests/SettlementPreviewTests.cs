using StorageProject.Core.Policies;
using Xunit;

namespace StorageProject.Tests;

// #16 / #56 / #57 (Lượt 2): số tháng đã bắt đầu và ví dụ chuẩn "đăng ký 3 tháng, dùng 1 tháng 1 ngày".
public sealed class SettlementPreviewTests
{
    private static readonly DateOnly Start = new(2026, 9, 20);
    private static readonly DateOnly End = new(2026, 12, 20); // 3 tháng
    private const decimal Deposit = 1_150_000m;
    private const decimal Rent = 3_450_000m;

    [Theory]
    [InlineData(2026, 9, 20, 1)]   // 00:00 ngày nhận kho: tháng 1 đã bắt đầu
    [InlineData(2026, 10, 19, 1)]  // còn trong tháng 1
    [InlineData(2026, 10, 20, 2)]  // 1 tháng + 1 ngày → tính 2 tháng
    [InlineData(2026, 11, 20, 3)]
    public void Months_begun_count_from_pickup_day(int y, int m, int d, int expected) =>
        Assert.Equal(expected, RefundPolicy.MonthsBegun(Start, End, new DateOnly(y, m, d)));

    [Fact]
    public void Three_months_used_one_month_one_day_refunds_one_month_and_full_deposit_without_30_percent_hold()
    {
        var r = RefundPolicy.Calculate(new RefundInput(RefundScenario.EarlyStop, Deposit, Rent, Start, End, new DateOnly(2026, 10, 21)));
        Assert.Equal(1_150_000m, r.RentRefund);   // hoàn tiền thuê 1 tháng chưa bắt đầu
        Assert.Equal(Deposit, r.DepositRefund);   // không giữ 30% cọc (#56)
        Assert.Equal(0m, r.FixedDeduction);
        Assert.Equal(2_300_000m, r.Total);
    }

    [Fact]
    public void Early_stop_with_cleaning_and_damage_deducts_from_deposit_only()
    {
        var r = RefundPolicy.Calculate(new RefundInput(RefundScenario.EarlyStop, Deposit, Rent, Start, End, new DateOnly(2026, 11, 11),
            HygieneViolation: true, DamageFee: 200_000m));
        Assert.Equal(115_000m, r.FixedDeduction);
        Assert.Equal(200_000m, r.DamageDeduction);
        Assert.Equal(835_000m, r.DepositRefund);
        Assert.Equal(1_150_000m, r.RentRefund);
        Assert.Equal(1_985_000m, r.Total);       // khớp ví dụ trên Figma M-ĐS
    }
}
