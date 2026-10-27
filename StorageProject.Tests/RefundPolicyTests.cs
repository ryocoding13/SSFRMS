using StorageProject.Core.Policies;
using Xunit;

namespace StorageProject.Tests;

// D27 — công thức hoàn cọc và hoàn thuê (hàm thuần, không cần cơ sở dữ liệu).
public sealed class RefundPolicyTests
{
    private static readonly DateOnly Start = new(2026, 11, 1);
    private static readonly DateOnly End = new(2027, 2, 1);
    private const decimal Deposit = 1_000_000m;
    private const decimal Rent = 3_000_000m; // 3 tháng

    private static RefundResult Calc(RefundScenario scenario, DateOnly today, bool hygiene = false,
        bool overdue = false, decimal damage = 0, decimal overdueFee = 0) =>
        RefundPolicy.Calculate(new RefundInput(scenario, Deposit, Rent, Start, End, today, hygiene, overdue, damage, overdueFee));

    [Fact]
    public void Cancel_before_start_charges_10_percent_of_deposit_and_refunds_all_rent()
    {
        var r = Calc(RefundScenario.CancelBeforeStart, new DateOnly(2026, 10, 25));
        Assert.Equal(100_000m, r.FixedDeduction);
        Assert.Equal(900_000m, r.DepositRefund);
        Assert.Equal(Rent, r.RentRefund);
        Assert.Equal(3_900_000m, r.Total);
        Assert.Equal(0m, r.Debt);
    }

    [Fact]
    public void Early_stop_keeps_30_percent_deposit_and_refunds_months_not_yet_begun()
    {
        // 15/12: tháng 1 và tháng 2 đã bắt đầu, tháng 3 (từ 01/01) chưa bắt đầu.
        var r = Calc(RefundScenario.EarlyStop, new DateOnly(2026, 12, 15));
        Assert.Equal(300_000m, r.FixedDeduction);
        Assert.Equal(700_000m, r.DepositRefund);
        Assert.Equal(1_000_000m, r.RentRefund);
        Assert.Equal(1_700_000m, r.Total);
    }

    [Fact]
    public void Early_stop_in_last_month_refunds_no_rent()
    {
        var r = Calc(RefundScenario.EarlyStop, new DateOnly(2027, 1, 10));
        Assert.Equal(0m, r.RentRefund);
        Assert.Equal(700_000m, r.DepositRefund);
    }

    [Fact]
    public void Early_stop_damage_beyond_remaining_deposit_gives_zero_refund_and_records_debt()
    {
        var r = Calc(RefundScenario.EarlyStop, new DateOnly(2026, 12, 15), damage: 800_000m);
        Assert.Equal(700_000m, r.DamageDeduction);
        Assert.Equal(0m, r.DepositRefund);
        Assert.Equal(100_000m, r.Debt);
        Assert.Equal(1_000_000m, r.Total); // vẫn hoàn tiền thuê tháng chưa bắt đầu
    }

    [Fact]
    public void Clean_on_time_return_refunds_full_deposit()
    {
        var r = Calc(RefundScenario.NormalReturn, End);
        Assert.Equal(Deposit, r.DepositRefund);
        Assert.Equal(0m, r.FixedDeduction);
        Assert.Equal(0m, r.RentRefund);
    }

    [Fact]
    public void Hygiene_violation_deducts_fixed_10_percent()
    {
        var r = Calc(RefundScenario.NormalReturn, End, hygiene: true);
        Assert.Equal(100_000m, r.FixedDeduction);
        Assert.Equal(900_000m, r.DepositRefund);
    }

    [Fact]
    public void Overdue_return_deducts_fixed_10_percent_plus_overdue_fee()
    {
        var r = Calc(RefundScenario.NormalReturn, End.AddDays(3), overdue: true, overdueFee: 150_000m);
        Assert.Equal(100_000m, r.FixedDeduction);
        Assert.Equal(150_000m, r.OverdueDeduction);
        Assert.Equal(750_000m, r.DepositRefund);
    }

    [Fact]
    public void Damage_and_overdue_are_deducted_from_remaining_deposit()
    {
        var r = Calc(RefundScenario.NormalReturn, End.AddDays(3), hygiene: true, overdue: true, damage: 200_000m, overdueFee: 150_000m);
        Assert.Equal(550_000m, r.DepositRefund);
        Assert.Equal(0m, r.Debt);
    }

    [Fact]
    public void Damage_over_deposit_zero_refund_and_shortfall_is_debt()
    {
        var r = Calc(RefundScenario.NormalReturn, End, damage: 1_200_000m);
        Assert.Equal(0m, r.DepositRefund);
        Assert.Equal(200_000m, r.Debt);
    }

    [Fact]
    public void Total_months_rounds_up_and_unused_rent_is_full_before_start()
    {
        Assert.Equal(3, RefundPolicy.TotalMonths(Start, End));
        Assert.Equal(3, RefundPolicy.TotalMonths(Start, new DateOnly(2027, 1, 31)));
        Assert.Equal(Rent, RefundPolicy.UnusedRent(Rent, Start, End, new DateOnly(2026, 10, 1)));
    }

    [Fact]
    public void Overdue_fee_follows_policy_parameter_and_never_invents_a_default()
    {
        Assert.Equal(300_000m, RefundPolicy.OverdueFeeFor("PERCENTAGE", 5m, 2_000_000m, 3));
        Assert.Equal(100_000m, RefundPolicy.OverdueFeeFor("FIXED", 50_000m, 2_000_000m, 2));
        Assert.Equal(0m, RefundPolicy.OverdueFeeFor(null, null, 2_000_000m, 0));
        Assert.Throws<InvalidOperationException>(() => RefundPolicy.OverdueFeeFor(null, null, 2_000_000m, 2));
        Assert.Throws<InvalidOperationException>(() => RefundPolicy.OverdueFeeFor("RULE", 5m, 2_000_000m, 2));
    }

    [Fact]
    public void Overdue_fee_deposit_percent_per_day_calculates_5_percent_and_caps_at_100_percent_deposit()
    {
        const decimal initialDeposit = 1_150_000m;
        // 1 ngày: 5% * 1.150.000 = 57.500
        Assert.Equal(57_500m, RefundPolicy.OverdueFeeFor("DEPOSIT_PERCENT_PER_DAY", 5m, initialDeposit, 1));
        // 3 ngày: 172.500
        Assert.Equal(172_500m, RefundPolicy.OverdueFeeFor("DEPOSIT_PERCENT_PER_DAY", 5m, initialDeposit, 3));
        // 20 ngày: 100% = 1.150.000
        Assert.Equal(initialDeposit, RefundPolicy.OverdueFeeFor("DEPOSIT_PERCENT_PER_DAY", 5m, initialDeposit, 20));
        // 25 ngày: vượt 100% cọc -> dừng ở 100% cọc (1.150.000)
        Assert.Equal(initialDeposit, RefundPolicy.OverdueFeeFor("DEPOSIT_PERCENT_PER_DAY", 5m, initialDeposit, 25));
    }
}
