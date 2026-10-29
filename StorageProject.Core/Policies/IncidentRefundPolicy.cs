namespace StorageProject.Core.Policies;

/// <summary>
/// D32 · Sự cố do cơ sở, khách chọn kết thúc hợp đồng: hoàn 100% tiền tháng đang thuê + 100% các tháng chưa dùng
/// + 100% cọc; không chia theo ngày, không phạt dừng sớm. Tháng tính từ StartDate như <see cref="RefundPolicy.TotalMonths"/>.
/// </summary>
public static class IncidentRefundPolicy
{
    public sealed record Result(decimal CurrentMonthRent, decimal UnusedRent, decimal Deposit)
    {
        public decimal Total => CurrentMonthRent + UnusedRent + Deposit;
    }

    public static Result Calculate(DateOnly start, DateOnly end, decimal monthlyRate, decimal deposit, DateOnly today)
    {
        if (monthlyRate < 0 || deposit < 0) throw new ArgumentException("Số tiền không được âm.");
        var total = RefundPolicy.TotalMonths(start, end);
        var begun = 0;
        while (begun < total && start.AddMonths(begun) <= today) begun++;
        var current = begun > 0 ? monthlyRate : 0m;   // tháng đang thuê (đã bắt đầu) hoàn đủ 100%
        var unused = monthlyRate * (total - begun);    // các tháng nguyên chưa bắt đầu
        return new Result(current, unused, deposit);
    }
}
