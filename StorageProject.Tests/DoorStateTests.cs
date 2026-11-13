using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

// #47 (Lượt 4): đọc sự kiện cửa mô phỏng từ nhật ký quét mã / đóng cửa.
public sealed class DoorStateTests
{
    [Fact]
    public void Door_event_reads_unit_and_result()
    {
        Assert.Equal(("A-102", "OPEN"), FacilityOpsService.DoorEvent("{\"result\":\"OPEN\",\"unit\":\"A-102\",\"reason\":null}"));
        Assert.Equal(("A-102", (string?)null), FacilityOpsService.DoorEvent("{\"unit\":\"A-102\"}"));
        Assert.Equal(((string?)null, (string?)null), FacilityOpsService.DoorEvent("không phải json"));
        Assert.Equal(((string?)null, (string?)null), FacilityOpsService.DoorEvent(null));
    }
}

// #45 #54 (Lượt 6): trạng thái hợp đồng theo ngày hết hạn khi admin chỉnh ngày để demo.
public sealed class DemoToolsRuleTests
{
    private static readonly DateOnly Today = new(2026, 11, 12);

    [Theory]
    [InlineData(2026, 11, 9, "OVERDUE", 3)]
    [InlineData(2026, 11, 12, "OVERDUE", 0)]
    [InlineData(2026, 11, 20, "EXPIRING", 0)]
    [InlineData(2027, 2, 12, "ACTIVE", 0)]
    public void Running_status_and_overdue_days_follow_end_date(int y, int m, int d, string status, int overdue)
    {
        var end = new DateOnly(y, m, d);
        Assert.Equal(status, DemoToolsService.RunningStatus(end, Today));
        Assert.Equal(overdue, DemoToolsService.OverdueDays(end, Today));
    }
}
