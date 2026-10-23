using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using StorageProject.IntegrationTests.Infrastructure;
using Xunit;

namespace StorageProject.IntegrationTests.Tests;

public sealed class PaymentConcurrencyAndLockTests(SqlServerFixture fixture) : IClassFixture<SqlServerFixture>
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    [Fact]
    public async Task DuplicatePaymentConfirmation_IsIdempotent_AndDoesNotDuplicatePayments()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var customer = await db.Users.FirstAsync(u => u.Username == "customer01");
        var facility = await db.Facilities.FirstAsync();
        var unitType = await db.UnitTypes.FirstAsync();

        var orderCode = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 100 + Random.Shared.Next(100);
        var reservation = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = Today.AddDays(2),
            ExpectedEndDate = Today.AddMonths(2),
            RentalPeriodMonths = 2,
            QuotedMonthlyRate = 1200000,
            RequiredDeposit = 1200000,
            EstimatedAmount = 2400000,
            Status = "PENDING_PAYMENT",
            PaymentMethod = "PAYOS",
            OrderCode = orderCode,
            ExpiresAt = DateTime.UtcNow.AddHours(2),
            CreatedAt = DateTime.UtcNow
        };

        db.Reservations.Add(reservation);
        await db.SaveChangesAsync();

        var fakeGateway = new FakePayOSGateway
        {
            NextVerifiedPayment = new VerifiedReservationPayment(orderCode, 3600000) // 2400000 + 1200000
        };

        var payService = new PayOSService(db, fakeGateway, NullLogger<PayOSService>.Instance);

        // Lần xác nhận đầu tiên
        var firstResult = await payService.ProcessWebhookAsync("{}", null);
        Assert.True(firstResult);

        // Lần xác nhận thứ hai (re-delivery của cùng webhook)
        var secondResult = await payService.ProcessWebhookAsync("{}", null);
        Assert.True(secondResult);

        // Kiểm tra trong SQL Server thật
        await using var verifyDb = fixture.CreateContext();
        var payments = await verifyDb.Payments
            .Where(p => p.ReservationId == reservation.ReservationId)
            .ToListAsync();

        // Chỉ có đúng 2 bản ghi: 1 RENT và 1 DEPOSIT, không bị nhân đôi
        Assert.Equal(2, payments.Count);
        Assert.Contains(payments, p => p.PaymentType == "RENT" && p.Amount == 2400000);
        Assert.Contains(payments, p => p.PaymentType == "DEPOSIT" && p.Amount == 1200000);

        var updatedOrder = await verifyDb.Reservations.SingleAsync(r => r.ReservationId == reservation.ReservationId);
        Assert.NotNull(updatedOrder.PaidAt);
    }

    [Fact]
    public async Task ConcurrentUnitAllocation_UsesAppLock_AndPreventsDoubleAllocation()
    {
        if (!fixture.IsAvailable) return;

        await using var setupDb = fixture.CreateContext();

        var customer = await setupDb.Users.FirstAsync(u => u.Username == "customer01");
        var manager = await setupDb.Users.FirstAsync(u => u.Username == "manager01");
        var facility = await setupDb.Facilities.FirstAsync();
        var unitType = await setupDb.UnitTypes.FirstAsync();

        var testUnitNumber = $"K-CONCURRENT-{Guid.NewGuid():N}"[..10];
        var unit = new StorageUnit
        {
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            UnitNumber = testUnitNumber,
            Status = "AVAILABLE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        setupDb.StorageUnits.Add(unit);

        // Tạo 2 đơn đặt phòng khác nhau cho cùng cơ sở và cùng loại kho
        var res1 = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = Today.AddDays(1),
            ExpectedEndDate = Today.AddMonths(1),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 1000000,
            RequiredDeposit = 1000000,
            EstimatedAmount = 1000000,
            Status = "PENDING_AT_FACILITY",
            PaymentMethod = "AT_FACILITY",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            CreatedAt = DateTime.UtcNow
        };

        var res2 = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = Today.AddDays(1),
            ExpectedEndDate = Today.AddMonths(1),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 1000000,
            RequiredDeposit = 1000000,
            EstimatedAmount = 1000000,
            Status = "PENDING_AT_FACILITY",
            PaymentMethod = "AT_FACILITY",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            CreatedAt = DateTime.UtcNow
        };

        setupDb.Reservations.AddRange(res1, res2);
        await setupDb.SaveChangesAsync();

        // Sử dụng 2 DbContext kết nối SQL Server riêng biệt mô phỏng 2 luồng request cạnh tranh
        await using var db1 = fixture.CreateContext();
        await using var db2 = fixture.CreateContext();

        var task1 = Task.Run(async () =>
        {
            try
            {
                await ReservationAllocation.AllocateAsync(db1, manager.UserId, facility.FacilityId, res1.ReservationId, testUnitNumber, default);
                return (Success: true, Error: (string?)null);
            }
            catch (Exception ex)
            {
                return (Success: false, Error: ex.Message);
            }
        });

        var task2 = Task.Run(async () =>
        {
            try
            {
                await ReservationAllocation.AllocateAsync(db2, manager.UserId, facility.FacilityId, res2.ReservationId, testUnitNumber, default);
                return (Success: true, Error: (string?)null);
            }
            catch (Exception ex)
            {
                return (Success: false, Error: ex.Message);
            }
        });

        var results = await Task.WhenAll(task1, task2);

        // Một bên phải thành công, một bên phải thất bại do khoá sp_getapplock và ràng buộc khả dụng
        var successCount = results.Count(r => r.Success);
        var failureCount = results.Count(r => !r.Success);

        Assert.Equal(1, successCount);
        Assert.Equal(1, failureCount);

        // Kiểm tra tính toàn vẹn trong SQL Server thật
        await using var verifyDb = fixture.CreateContext();
        var assignments = await verifyDb.UnitAssignments
            .Where(a => a.Unit.UnitNumber == testUnitNumber && a.Status == "ACTIVE")
            .ToListAsync();

        // Chỉ duy nhất 1 bản ghi UnitAssignment cho ô kho này
        Assert.Single(assignments);

        var finalUnit = await verifyDb.StorageUnits.SingleAsync(u => u.UnitNumber == testUnitNumber);
        Assert.Equal("RESERVED", finalUnit.Status);
    }
}
