using StorageProject.Core.Policies;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>Phiên 2 (05/11/2026): các sửa nhỏ L11, D40, D38/L22, L14.</summary>
public class Phien2FixTests
{
    [Theory]
    [InlineData("Đạt · không còn đồ", "Đạt tiêu chuẩn", "Đã nhận đủ chìa", 3)]
    [InlineData("Đạt · còn ít đồ", "Đạt tiêu chuẩn", "Đã nhận đủ chìa", 3)]
    [InlineData("Đạt · còn ít đồ", "Chưa đạt tiêu chuẩn vệ sinh", "Đã nhận đủ chìa", 2)]
    [InlineData("Chưa đạt · còn nhiều đồ", "Chưa đạt tiêu chuẩn vệ sinh", "Đã nhận đủ chìa", 1)]
    [InlineData("Trống", "Sạch", "Đủ", 0)] // biên bản ghi tay kiểu cũ không tự được coi là đạt
    public void InspectionStandard_counts_only_passed_choices(string items, string walls, string keys, int expected) =>
        Assert.Equal(expected, InspectionStandard.PassedCount(items, walls, keys));

    [Fact]
    public void Cancel_fee_is_zero_and_refunds_full_rent_and_deposit()
    {
        Assert.Equal(0.00m, RefundPolicy.CancelFeeRate);
        var r = RefundPolicy.Calculate(new RefundInput(RefundScenario.CancelBeforeStart, 1_140_000m, 1_140_000m,
            new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1), new DateOnly(2026, 9, 20)));
        Assert.Equal(0m, r.FixedDeduction);
        Assert.Equal(2_280_000m, r.Total); // D49: 100% tiền thuê + 100% tiền cọc
    }

    [Theory]
    [InlineData("DRAFT")]
    [InlineData("CANCELLED")]
    [InlineData("COMPLETED")]
    [InlineData("TERMINATED")]
    public void Ticket_is_blocked_for_unpaid_or_ended_contracts(string status) =>
        Assert.Contains(status, SupportTicketService.ClosedContractStatuses);

    [Theory]
    [InlineData("ACTIVE")]
    [InlineData("EXPIRING")]
    [InlineData("OVERDUE")]
    [InlineData("RETURN_PENDING")]
    public void Ticket_is_allowed_for_paid_contracts_including_before_start(string status) =>
        Assert.DoesNotContain(status, SupportTicketService.ClosedContractStatuses);
}
