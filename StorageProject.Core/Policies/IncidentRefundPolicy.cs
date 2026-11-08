namespace StorageProject.Core.Policies;

/// <summary>
/// D32 · Sự cố do cơ sở, khách chọn kết thúc hợp đồng: hoàn 100% tiền tháng đang thuê + 100% các tháng chưa dùng
/// + 100% cọc; không chia theo ngày, không phạt dừng sớm. Tháng tính từ StartDate như <see cref="RefundPolicy.TotalMonths"/>.
/// </summary>
public static class IncidentRefundPolicy
{
    /// <summary>
    /// Kết quả tính toán hoàn tiền khi kết thúc hợp đồng do sự cố cơ sở.
    /// </summary>
    /// <param name="CurrentMonthRent">Tiền thuê tháng hiện tại (được hoàn đủ 100%).</param>
    /// <param name="UnusedRent">Tiền thuê các tháng nguyên chưa bắt đầu (hoàn đủ 100%).</param>
    /// <param name="Deposit">Tiền cọc ban đầu (hoàn 100%, không phạt huỷ sớm).</param>
    public sealed record Result(decimal CurrentMonthRent, decimal UnusedRent, decimal Deposit)
    {
        /// <summary>Tổng số tiền khách được nhận hoàn.</summary>
        public decimal Total => CurrentMonthRent + UnusedRent + Deposit;
    }

    /// <summary>
    /// Tính toán các khoản hoàn tiền khi khách hàng chọn kết thúc hợp đồng do sự cố cơ sở theo D34.
    /// </summary>
    /// <param name="start">Ngày bắt đầu hợp đồng.</param>
    /// <param name="end">Ngày kết thúc hợp đồng.</param>
    /// <param name="monthlyRate">Đơn giá thuê hàng tháng.</param>
    /// <param name="deposit">Tiền cọc ban đầu.</param>
    /// <param name="today">Ngày phát sinh xử lý sự cố.</param>
    /// <returns>Đối tượng <see cref="Result"/> chứa chi tiết 3 khoản tiền hoàn.</returns>
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
