using System;
using System.Collections.Generic;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// D67 (20/11/2026): sơ đồ ô tính theo ngày khách chọn, ô bảo trì không nhận đặt, giữ chỗ 24 giờ sau khi đồng ý chính sách,
/// số tháng thuê / gia hạn 1–99.
/// </summary>
public class D67UnitMapHoldTests
{
    private static readonly DateOnly Today = new(2026, 11, 20);

    private static UnitAvailability.UnitSlot Slot(string status, params UnitAvailability.Hold[] holds) =>
        new(new StorageUnit { UnitId = 1, UnitNumber = "K01", Status = status }, new List<UnitAvailability.Hold>(holds));

    [Fact]
    public void PolicyHold_Is24HoursFromAcceptance()
    {
        var accepted = new DateTime(2026, 11, 20, 14, 0, 0, DateTimeKind.Utc);
        Assert.Equal(accepted.AddHours(24), OpsRules.CalculatePolicyHoldDeadlineUtc(accepted));
        Assert.Equal(15, OpsRules.DefaultOnlineReservationHoldMinutes);
    }

    [Fact]
    public void RentalMonths_RangeIsOneToNinetyNine()
    {
        Assert.Equal(1, OpsRules.MinRentalMonths);
        Assert.Equal(99, OpsRules.MaxRentalMonths);
    }

    [Theory]
    [InlineData("MAINTENANCE")]
    [InlineData("OUT_OF_SERVICE")]
    public void MaintenanceUnit_IsNeverBookable_EvenFarInFuture(string status)
    {
        var slot = Slot(status);
        Assert.False(UnitAvailability.Bookable(slot, Today.AddMonths(6), Today.AddMonths(12), 3, Today));
        Assert.Null(UnitAvailability.FreeFrom(slot, 3, Today));
        Assert.NotNull(UnitAvailability.UnavailableReason(slot, Today.AddMonths(6), Today.AddMonths(12), 3, Today));
    }

    [Fact]
    public void FutureContract_DoesNotOccupyUnitBeforeItStarts()
    {
        // Đơn thuê từ 01/06 đến 01/12 năm sau: hôm nay ô vẫn trống, chỉ bận trong kỳ đó (cộng 3 ngày đệm).
        var hold = new UnitAvailability.Hold(10, new DateOnly(2027, 6, 1), new DateOnly(2027, 12, 1), "DRAFT");
        var slot = Slot("RESERVED", hold);

        Assert.Null(UnitAvailability.HoldAt(slot, Today, 3, Today));
        Assert.Equal(new DateOnly(2027, 6, 1), UnitAvailability.NextHoldStart(slot, Today));
        Assert.Equal(hold, UnitAvailability.HoldAt(slot, new DateOnly(2027, 7, 15), 3, Today));
        Assert.Equal(hold, UnitAvailability.HoldAt(slot, new DateOnly(2027, 12, 3), 3, Today));
        Assert.Null(UnitAvailability.HoldAt(slot, new DateOnly(2027, 12, 4), 3, Today));
    }

    [Fact]
    public void OverdueContract_StillOccupiesUnitToday()
    {
        var hold = new UnitAvailability.Hold(11, Today.AddMonths(-3), Today.AddDays(-5), "OVERDUE");
        var slot = Slot("OCCUPIED", hold);
        Assert.Equal(hold, UnitAvailability.HoldAt(slot, Today, 3, Today));
    }
}
