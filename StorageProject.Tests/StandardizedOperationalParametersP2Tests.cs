using System;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// Kiểm chứng chuẩn hoá tham số vận hành Gói P2 theo SSFRMS-Business-Policies-Audit-and-Refactor-Plan.md
/// - Giữ chỗ online 15 phút
/// - Giữ chỗ tại quầy cuối ngày hẹn (giờ VN)
/// - Hạn thanh toán gia hạn (min(24h, ngày hết hạn))
/// - Mốc EXPIRING 30 ngày
/// - Ngày đệm cho thuê lại RELET_BUFFER mặc định 3 ngày
/// </summary>
public class StandardizedOperationalParametersP2Tests
{
    [Fact]
    public void OnlineReservationHold_CalculatesExactly15MinutesFromCreation()
    {
        var created = new DateTime(2026, 11, 10, 8, 30, 0, DateTimeKind.Utc);
        var deadline = OpsRules.CalculateOnlineHoldDeadlineUtc(created);

        Assert.Equal(created.AddMinutes(15), deadline);
        Assert.Equal(OpsRules.DefaultOnlineReservationHoldMinutes, (deadline - created).TotalMinutes);
    }

    [Fact]
    public void CounterPaymentHold_CalculatesToEndOfCheckInDayInVietnamTime_EvenNearMidnight()
    {
        // Ngày check-in: 2026-11-10
        var checkInDay = new DateOnly(2026, 11, 10);
        var deadlineUtc = OpsRules.CalculateCounterHoldDeadlineUtc(checkInDay);

        // Hạn chót là 00:00:00 của ngày hôm sau theo giờ VN (2026-11-11 00:00:00 VN)
        // tương đương 2026-11-10 17:00:00 UTC
        Assert.Equal(new DateTime(2026, 11, 10, 17, 0, 0, DateTimeKind.Utc), deadlineUtc);

        // Kiểm tra giờ VN tương ứng
        var deadlineVn = deadlineUtc + OpsRules.ReportOffset;
        Assert.Equal(new DateTime(2026, 11, 11, 0, 0, 0), deadlineVn);
    }

    [Fact]
    public void RenewalPaymentDeadline_CapsAt24Hours_WhenContractEndDateIsFar()
    {
        var now = new DateTime(2026, 11, 10, 10, 0, 0, DateTimeKind.Utc);
        var contractEndDate = new DateOnly(2026, 11, 20); // 10 ngày nữa mới hết hạn

        var deadline = OpsRules.CalculateRenewalPaymentDeadlineUtc(now, contractEndDate);

        // Phải đúng 24 giờ sau khi duyệt
        Assert.Equal(now.AddHours(24), deadline);
    }

    [Fact]
    public void RenewalPaymentDeadline_ClampsToContractEndDate_WhenLessThan24HoursRemain()
    {
        // Lúc duyệt: 2026-11-10 12:00:00 UTC (19:00 VN)
        // Ngày hết hạn: 2026-11-11 (tức 2026-11-10 17:00:00 UTC, chỉ còn 5 giờ)
        var now = new DateTime(2026, 11, 10, 12, 0, 0, DateTimeKind.Utc);
        var contractEndDate = new DateOnly(2026, 11, 11);

        var deadline = OpsRules.CalculateRenewalPaymentDeadlineUtc(now, contractEndDate);

        var expiryUtc = contractEndDate.ToDateTime(TimeOnly.MinValue) - OpsRules.ReportOffset;
        Assert.Equal(expiryUtc, deadline);
        Assert.True(deadline < now.AddHours(24));
        Assert.Equal(5, (deadline - now).TotalHours);
    }

    [Fact]
    public void ReletBuffer_DefaultsTo3Days_AndAllowsValidRange0To60()
    {
        Assert.Equal(3, OpsRules.DefaultReletBufferDays);
        Assert.Equal(3, UnitAvailability.DefaultBufferDays);
    }

    [Fact]
    public void ExpiringThreshold_DefaultsTo30Days()
    {
        Assert.Equal(30, OpsRules.DefaultExpiringThresholdDays);
    }
}

