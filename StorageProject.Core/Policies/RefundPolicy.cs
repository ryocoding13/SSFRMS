namespace StorageProject.Core.Policies;

/// <summary>Tình huống tính hoàn tiền theo chính sách cọc D27.</summary>
public enum RefundScenario
{
    /// <summary>Huỷ đơn đã thanh toán trước ngày bắt đầu thuê.</summary>
    CancelBeforeStart,
    /// <summary>Dừng thuê sau ngày bắt đầu, trước ngày kết thúc hợp đồng (Move-out).</summary>
    EarlyStop,
    /// <summary>Trả kho khi hết hạn hợp đồng.</summary>
    NormalReturn
}

public sealed record RefundInput(
    RefundScenario Scenario,
    decimal Deposit,
    decimal RentPaid,
    DateOnly StartDate,
    DateOnly EndDate,
    DateOnly Today,
    bool HygieneViolation = false,
    bool Overdue = false,
    decimal DamageFee = 0,
    decimal OverdueFee = 0);

public sealed record RefundResult(
    decimal RentRefund,
    decimal DepositRefund,
    decimal FixedDeduction,
    decimal DamageDeduction,
    decimal OverdueDeduction,
    decimal Debt)
{
    public decimal Total => RentRefund + DepositRefund;
}

/// <summary>
/// D27 — công thức hoàn cọc và hoàn thuê. Hàm thuần, không đọc cơ sở dữ liệu.
/// Huỷ trước StartDate: phí 10% cọc, hoàn 100% tiền thuê + 90% cọc.
/// Dừng sớm sau StartDate: giữ 30% cọc; tháng đang chạy tính đủ, tháng chưa bắt đầu được hoàn tiền thuê.
/// Trả kho bình thường: hoàn đủ cọc; vi phạm vệ sinh hoặc quá hạn trừ cố định 10% cọc.
/// Hư hỏng và phí quá hạn trừ thêm vào cọc còn lại; không đủ thì hoàn 0 và phần thiếu ghi thành công nợ.
/// </summary>
public static class RefundPolicy
{
    public const decimal CancelFeeRate = 0.10m;
    public const decimal EarlyStopKeepRate = 0.30m;
    public const decimal HygieneFeeRate = 0.10m;

    public static RefundResult Calculate(RefundInput i)
    {
        if (i.Deposit < 0 || i.RentPaid < 0 || i.DamageFee < 0 || i.OverdueFee < 0)
            throw new ArgumentException("Số tiền không được âm.");

        if (i.Scenario == RefundScenario.CancelBeforeStart)
        {
            var fee = Money(i.Deposit * CancelFeeRate);
            return new RefundResult(i.RentPaid, i.Deposit - fee, fee, 0, 0, 0);
        }

        var fixedDeduction = i.Scenario == RefundScenario.EarlyStop
            ? Money(i.Deposit * EarlyStopKeepRate)
            : i.HygieneViolation || i.Overdue ? Money(i.Deposit * HygieneFeeRate) : 0m;

        var rentRefund = i.Scenario == RefundScenario.EarlyStop
            ? UnusedRent(i.RentPaid, i.StartDate, i.EndDate, i.Today)
            : 0m;

        var remaining = i.Deposit - fixedDeduction;
        var damage = Math.Min(remaining, i.DamageFee);
        remaining -= damage;
        var overdue = Math.Min(remaining, i.OverdueFee);
        remaining -= overdue;
        var debt = (i.DamageFee - damage) + (i.OverdueFee - overdue);
        return new RefundResult(rentRefund, remaining, fixedDeduction, damage, overdue, debt);
    }

    /// <summary>Số tháng thuê (làm tròn lên) giữa hai ngày; tối thiểu 1.</summary>
    public static int TotalMonths(DateOnly start, DateOnly end)
    {
        var m = 0;
        while (start.AddMonths(m) < end) m++;
        return Math.Max(1, m);
    }

    /// <summary>Hoàn tiền thuê của các tháng chưa bắt đầu (tháng hiện tại tính đủ, không hoàn).</summary>
    public static decimal UnusedRent(decimal rentPaid, DateOnly start, DateOnly end, DateOnly today)
    {
        var total = TotalMonths(start, end);
        var begun = 0;
        while (begun < total && start.AddMonths(begun) <= today) begun++;
        return Money(rentPaid * (total - begun) / total);
    }

    /// <summary>
    /// Phí quá hạn theo tham số chính sách OVERDUE (B02): PERCENTAGE = % tiền thuê tháng mỗi ngày trễ,
    /// FIXED = số tiền cố định mỗi ngày trễ. Thiếu hoặc không hỗ trợ cách tính thì báo lỗi, không tự đặt mức phí.
    /// </summary>
    public static decimal OverdueFeeFor(string? calculationType, decimal? value, decimal baseAmount, int overdueDays, decimal? maxCap = null)
    {
        if (overdueDays <= 0) return 0;
        if (value is not decimal v || v < 0)
            throw new InvalidOperationException("Chưa cấu hình chính sách phí quá hạn (B02). Cần cấu hình trước khi tính hoàn cọc.");
        var fee = calculationType switch
        {
            "DEPOSIT_PERCENT_PER_DAY" => Math.Min(baseAmount, Money(baseAmount * v / 100m * overdueDays)),
            "PERCENTAGE" => Money(baseAmount * v / 100m * overdueDays),
            "FIXED" => Money(v * overdueDays),
            _ => throw new InvalidOperationException("Chính sách phí quá hạn (B02) phải tính theo % tiền cọc mỗi ngày, % tiền thuê tháng hoặc số tiền cố định mỗi ngày.")
        };
        if (maxCap.HasValue && maxCap.Value >= 0)
        {
            fee = Math.Min(fee, maxCap.Value);
        }
        return fee;
    }

    private static decimal Money(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);
}
