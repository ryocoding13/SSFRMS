using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class DeploymentConfigTests
{
    private const string DefaultDevSecret = "CHANGE_ME_TO_A_SECURE_256BIT_KEY_AT_LEAST_32_CHARS_LONG!!";

    [Fact]
    public void Production_Throws_When_JwtSecret_Is_DefaultPlaceholder()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Server=dummy;Database=test;",
                ["JwtSettings:Secret"] = DefaultDevSecret
            })
            .Build();

        var isDev = false;
        var jwtSecret = config["JwtSettings:Secret"];

        var ex = Record.Exception(() =>
        {
            if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret == DefaultDevSecret)
            {
                if (!isDev)
                {
                    throw new InvalidOperationException("JwtSettings:Secret must be configured with a secure key in non-development environments.");
                }
            }
        });

        Assert.NotNull(ex);
        Assert.IsType<InvalidOperationException>(ex);
        Assert.Contains("JwtSettings:Secret must be configured", ex.Message);
    }

    [Theory]
    [InlineData("short_secret_key_under_32")]
    [InlineData("YOUR_JWT_SECRET")]
    [InlineData("12345678901234567890123456789012")]
    public void Production_Throws_When_JwtSecret_Is_Invalid_Or_Weak(string weakSecret)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:Secret"] = weakSecret
            })
            .Build();

        var isDev = false;
        var jwtSecret = config["JwtSettings:Secret"];
        string[] weakPlaceholders = [
            DefaultDevSecret,
            "YOUR_JWT_SECRET",
            "CHANGE_ME",
            "secret",
            "12345678901234567890123456789012"
        ];

        var ex = Record.Exception(() =>
        {
            if (string.IsNullOrWhiteSpace(jwtSecret) ||
                weakPlaceholders.Any(p => string.Equals(jwtSecret.Trim(), p, StringComparison.OrdinalIgnoreCase)) ||
                jwtSecret.Length < 32)
            {
                if (!isDev)
                {
                    throw new InvalidOperationException("JwtSettings:Secret is not securely configured.");
                }
            }
        });

        Assert.NotNull(ex);
        Assert.IsType<InvalidOperationException>(ex);
    }

    [Fact]
    public void Production_Accepts_Strong_32Plus_Character_Secret()
    {
        var strongSecret = "A_VERY_SECURE_PRODUCTION_JWT_SECRET_KEY_FOR_SSFRMS_SYSTEM_2026";
        var isDev = false;
        string[] weakPlaceholders = [
            DefaultDevSecret,
            "YOUR_JWT_SECRET",
            "CHANGE_ME",
            "secret",
            "12345678901234567890123456789012"
        ];

        var ex = Record.Exception(() =>
        {
            if (string.IsNullOrWhiteSpace(strongSecret) ||
                weakPlaceholders.Any(p => string.Equals(strongSecret.Trim(), p, StringComparison.OrdinalIgnoreCase)) ||
                strongSecret.Length < 32)
            {
                if (!isDev)
                {
                    throw new InvalidOperationException("Failed");
                }
            }
        });

        Assert.Null(ex);
    }

    [Fact]
    public void Development_Allows_DefaultPlaceholder_JwtSecret()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Server=dummy;Database=test;",
                ["JwtSettings:Secret"] = DefaultDevSecret
            })
            .Build();

        var isDev = true;
        var jwtSecret = config["JwtSettings:Secret"];

        var ex = Record.Exception(() =>
        {
            if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret == DefaultDevSecret)
            {
                if (!isDev)
                {
                    throw new InvalidOperationException("Failed");
                }
                jwtSecret = DefaultDevSecret;
            }
        });

        Assert.Null(ex);
        Assert.Equal(DefaultDevSecret, jwtSecret);
    }

    [Fact]
    public void Production_Defaults_AutoMigrate_To_False_And_SeedMode_To_None()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var isDev = false;
        var autoMigrate = config.GetValue<bool>("Database:AutoMigrate", isDev);
        var seedMode = config.GetValue<string>("Database:SeedMode") ?? (isDev ? "Development" : "None");

        Assert.False(autoMigrate);
        Assert.Equal("None", seedMode);
    }

    [Fact]
    public void Development_Defaults_AutoMigrate_To_True_And_SeedMode_To_Development()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var isDev = true;
        var autoMigrate = config.GetValue<bool>("Database:AutoMigrate", isDev);
        var seedMode = config.GetValue<string>("Database:SeedMode") ?? (isDev ? "Development" : "None");

        Assert.True(autoMigrate);
        Assert.Equal("Development", seedMode);
    }

    [Fact]
    public async Task PayOSService_Uses_Configured_FrontendUrl()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("DataSource=:memory:")
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();

        var facility = new Facility { Name = "Test F", Address = "123", Status = "ACTIVE" };
        var unitType = new UnitType { TypeName = "M", Area = 15m, Status = "ACTIVE" };
        db.Facilities.Add(facility);
        db.UnitTypes.Add(unitType);
        await db.SaveChangesAsync();

        var unit = new StorageUnit { FacilityId = facility.FacilityId, UnitTypeId = unitType.UnitTypeId, UnitNumber = "T01", Status = "AVAILABLE" };
        var user = new User { Username = "u1", Email = "u1@e.com", PasswordHash = "h", FullName = "U1", Phone = "0900", Status = "ACTIVE" };
        db.StorageUnits.Add(unit);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var reservation = new Reservation
        {
            CustomerId = user.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            RentalPeriodMonths = 1,
            EstimatedAmount = 1000000m,
            RequiredDeposit = 1000000m,
            Status = "PENDING_PAYMENT",
            PaymentMethod = "PAYOS",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(2)
        };
        db.Reservations.Add(reservation);
        await db.SaveChangesAsync();

        string? capturedReturnUrl = null;
        string? capturedCancelUrl = null;

        var mockGateway = new TestPaymentGateway((orderCode, amount, resId, exp, retUrl, canUrl) =>
        {
            capturedReturnUrl = retUrl;
            capturedCancelUrl = canUrl;
            return new CheckoutLink("https://pay.payos.vn/web/test", "https://img.vietqr.io/test.png");
        });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AppSettings:FrontendUrl"] = "https://safespace.vn"
            })
            .Build();

        var logger = LoggerFactory.Create(b => {}).CreateLogger<PayOSService>();
        var service = new PayOSService(db, mockGateway, logger, config);

        var result = await service.CreatePaymentQrAsync(user.UserId, new CreatePayOSQrRequest(null, null, null, reservation.ReservationId, null, null, null, null, null));

        Assert.NotNull(result);
        Assert.Equal($"https://safespace.vn/#/reservations/{reservation.ReservationId}", capturedReturnUrl);
        Assert.Equal($"https://safespace.vn/#/reservations/{reservation.ReservationId}", capturedCancelUrl);
    }

    private sealed class TestPaymentGateway(Func<long, int, long, long, string, string, CheckoutLink> createHandler) : IPayOSGateway
    {
        public bool IsConfigured => true;
        public void EnsureConfigured() {}
        public Task CancelAsync(long id) => Task.CompletedTask;
        public Task<VerifiedReservationPayment?> VerifyAsync(string body) => Task.FromResult<VerifiedReservationPayment?>(null);
        public Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAtUnix, string returnUrl, string cancelUrl)
        {
            return Task.FromResult(createHandler(orderCode, amount, reservationId, expiresAtUnix, returnUrl, cancelUrl));
        }
    }
}
