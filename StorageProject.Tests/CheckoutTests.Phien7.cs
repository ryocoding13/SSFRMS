using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

// Phiên 7 · Đơn chờ thanh toán trực tuyến quá hạn giữ chỗ được tiến trình nền chuyển EXPIRED.
public sealed partial class CheckoutTests
{
    [Fact] public async Task UnpaidExpiry_ExpiresOnlyOverdueUnpaidOnlineOrders() {
        await using var f = await Fixture.Create();
        Assert.Equal(0, await UnpaidReservationExpiry.ExpireAsync(f.Db)); // còn trong 15 phút giữ chỗ
        Assert.Equal("PENDING_PAYMENT", f.Order.Status);

        var reported = new Reservation { CustomerId = f.Order.CustomerId, FacilityId = f.Order.FacilityId, UnitTypeId = f.Order.UnitTypeId,
            StartDate = f.Order.StartDate, ExpectedEndDate = f.Order.ExpectedEndDate, RentalPeriodMonths = 3, EstimatedAmount = 3000000,
            RequiredDeposit = 1000000, QuotedMonthlyRate = 1000000, Status = "PENDING_VERIFICATION",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-30), CreatedAt = DateTime.UtcNow };
        f.Db.Reservations.Add(reported);
        f.Order.ExpiresAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();

        Assert.Equal(1, await UnpaidReservationExpiry.ExpireAsync(f.Db));
        await f.Db.Entry(f.Order).ReloadAsync(); await f.Db.Entry(reported).ReloadAsync();
        Assert.Equal("EXPIRED", f.Order.Status);
        Assert.NotNull(f.Order.CancelledAt);
        Assert.Equal(UnpaidReservationExpiry.Reason, f.Order.CancellationReason);
        Assert.Equal("PENDING_VERIFICATION", reported.Status); // đã báo chuyển khoản: nhân viên đối chiếu, không tự huỷ
        Assert.Equal(1, await f.Db.ActivityLogs.CountAsync(l => l.Action == "RESERVATION_PAYMENT_EXPIRED" && l.EntityId == f.Order.ReservationId));
        Assert.Equal(0, await UnpaidReservationExpiry.ExpireAsync(f.Db)); // chạy lại không ghi thêm
        Assert.Empty(await f.Db.Payments.ToListAsync());
    }

    [Fact] public async Task UnpaidExpiry_LatePayosWebhookIsFlaggedForReviewNotRecordedAsPaid() {
        await using var f = await Fixture.Create();
        f.Order.ExpiresAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        await UnpaidReservationExpiry.ExpireAsync(f.Db);

        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null)); // đúng số tiền nhưng đơn đã hết hạn
        await f.Db.Entry(f.Order).ReloadAsync();
        Assert.Equal("EXPIRED", f.Order.Status);
        Assert.Null(f.Order.PaidAt);
        Assert.Empty(await f.Db.Payments.ToListAsync());
        Assert.True(await f.Db.ActivityLogs.AnyAsync(l => l.Action == "PAYMENT_REVIEW_REQUIRED" && l.EntityId == f.Order.ReservationId));
    }

    [Fact] public async Task UnpaidExpiry_CustomerReportingTransferAfterExpiryStillGetsExpiredError() {
        await using var f = await Fixture.Create();
        f.Order.ExpiresAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        await UnpaidReservationExpiry.ExpireAsync(f.Db);
        await Assert.ThrowsAsync<ReservationExpiredException>(() =>
            new ReservationService(f.Db).ConfirmTransferAsync(f.Order.CustomerId, f.Order.ReservationId));
    }
}
