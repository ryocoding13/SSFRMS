using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class RateManagementW5Tests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
            {
                if (p.GetDefaultValueSql() != null) p.SetDefaultValueSql(null);
            }
        }
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User OperatorUser = null!;
        public Facility Facility = null!;
        public UnitType UnitType = null!;

        public async Task InitAsync()
        {
            await Connection.OpenAsync();
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(Connection)
                .Options;

            Db = new TestDb(options);
            await Db.Database.EnsureCreatedAsync();

            OperatorUser = new User
            {
                Username = "ops_w5",
                Email = "ops_w5@storage.vn",
                PasswordHash = "hash",
                FullName = "Quản lý Vận hành W5",
                Status = "ACTIVE"
            };
            Db.Users.Add(OperatorUser);
            await Db.SaveChangesAsync();

            Facility = new Facility
            {
                Name = "SafeSpace Cơ Sở W5",
                Address = "456 Đường Test W5",
                Status = "ACTIVE"
            };
            Db.Facilities.Add(Facility);

            UnitType = new UnitType
            {
                TypeName = "Kho Lạnh 15m2",
                Area = 15m,
                Status = "ACTIVE"
            };
            Db.UnitTypes.Add(UnitType);

            await Db.SaveChangesAsync();
        }

        public ValueTask DisposeAsync()
        {
            Db.Dispose();
            Connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    [Fact]
    public void ComputeRateRevisionToken_EmptyList_ReturnsEmpty()
    {
        var token = OpsRules.ComputeRateRevisionToken([]);
        Assert.Equal("EMPTY", token);
    }

    [Fact]
    public void ComputeRateRevisionToken_ConsistentHash_ChangesOnRateChange()
    {
        var rates1 = new List<(long RateId, decimal MonthlyRate, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string Status)>
        {
            (1, 1_500_000m, new DateOnly(2026, 11, 1), null, "ACTIVE")
        };
        var token1 = OpsRules.ComputeRateRevisionToken(rates1);

        var rates2 = new List<(long RateId, decimal MonthlyRate, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string Status)>
        {
            (1, 1_500_000m, new DateOnly(2026, 11, 1), null, "ACTIVE")
        };
        var token2 = OpsRules.ComputeRateRevisionToken(rates2);
        Assert.Equal(token1, token2);

        // Đổi giá -> token đổi
        var rates3 = new List<(long RateId, decimal MonthlyRate, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string Status)>
        {
            (1, 1_600_000m, new DateOnly(2026, 11, 1), null, "ACTIVE")
        };
        var token3 = OpsRules.ComputeRateRevisionToken(rates3);
        Assert.NotEqual(token1, token3);
    }

    [Fact]
    public async Task SetRate_OptimisticConcurrency_StaleToken_ThrowsOperationConflictException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new OperationsService(f.Db);

        // Lấy token ban đầu khi chưa có giá
        var initialRates = await service.GetRatesAsync(f.Facility.FacilityId, f.UnitType.UnitTypeId, false);
        Assert.Empty(initialRates);

        // Editor 1 đặt giá ban đầu với ExpectedRevisionToken = "EMPTY"
        var req1 = new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 1_500_000m, OpsRules.TodayLocal, ExpectedRevisionToken: "EMPTY");
        var result1 = await service.SetRateAsync(req1, f.OperatorUser.UserId);
        Assert.NotNull(result1.RevisionToken);
        Assert.NotEqual("EMPTY", result1.RevisionToken);

        // Editor 2 dùng token cũ "EMPTY" cố đặt giá khác -> Phải ném OperationConflictException (409 Conflict)
        var req2 = new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 1_600_000m, OpsRules.TodayLocal, ExpectedRevisionToken: "EMPTY");
        var ex = await Assert.ThrowsAsync<OperationConflictException>(() =>
            service.SetRateAsync(req2, f.OperatorUser.UserId));

        Assert.Contains("cập nhật bởi người khác", ex.Message);
    }

    [Fact]
    public async Task SetRate_NoOverlappingActiveIntervals_WhenFutureRateScheduled()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new OperationsService(f.Db);
        var today = OpsRules.TodayLocal;

        // 1. Đặt giá áp dụng từ hôm nay
        await service.SetRateAsync(new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 1_500_000m, today), f.OperatorUser.UserId);

        // 2. Lên lịch giá mới sau 10 ngày
        var futureDate = today.AddDays(10);
        await service.SetRateAsync(new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 1_800_000m, futureDate), f.OperatorUser.UserId);

        // Kiểm tra toàn bộ rates ACTIVE trong DB
        var activeRates = await f.Db.RentalRates
            .Where(r => r.FacilityId == f.Facility.FacilityId && r.UnitTypeId == f.UnitType.UnitTypeId && r.Status == "ACTIVE")
            .OrderBy(r => r.EffectiveFrom)
            .ToListAsync();

        Assert.Equal(2, activeRates.Count);

        // Rate 1 phải kết thúc đúng 1 ngày trước rate 2
        Assert.Equal(today, activeRates[0].EffectiveFrom);
        Assert.Equal(futureDate.AddDays(-1), activeRates[0].EffectiveTo);

        // Rate 2 bắt đầu từ futureDate và chưa kết thúc
        Assert.Equal(futureDate, activeRates[1].EffectiveFrom);
        Assert.Null(activeRates[1].EffectiveTo);

        // Tuyệt đối không giao nhau
        Assert.False(OpsRules.Overlaps(activeRates[0].EffectiveFrom, activeRates[0].EffectiveTo, activeRates[1].EffectiveFrom, activeRates[1].EffectiveTo));
    }

    [Fact]
    public async Task SetRate_IdempotentRetry_DoesNotCreateDuplicate()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new OperationsService(f.Db);
        var today = OpsRules.TodayLocal;

        var req = new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 1_500_000m, today);

        var first = await service.SetRateAsync(req, f.OperatorUser.UserId);
        var second = await service.SetRateAsync(req, f.OperatorUser.UserId);

        Assert.Equal(first.RateId, second.RateId);
        Assert.Equal(first.MonthlyRate, second.MonthlyRate);

        var count = await f.Db.RentalRates.CountAsync(r => r.FacilityId == f.Facility.FacilityId && r.UnitTypeId == f.UnitType.UnitTypeId);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task SetRate_PastEffectiveDate_ThrowsArgumentException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new OperationsService(f.Db);
        var pastDate = OpsRules.TodayLocal.AddDays(-1);

        var req = new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 1_500_000m, pastDate);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.SetRateAsync(req, f.OperatorUser.UserId));
        Assert.Contains("Không đặt giá có hiệu lực trong quá khứ", ex.Message);
    }

    [Fact]
    public async Task SetRate_OutsidePriceRange_ThrowsArgumentException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new OperationsService(f.Db);
        var today = OpsRules.TodayLocal;

        // Thêm chính sách PRICE_RANGE: 1.000.000 - 3.000.000
        f.Db.Policies.Add(new Policy
        {
            PolicyName = "Khung giá kho tiêu chuẩn",
            PolicyType = "PRICE_RANGE",
            CalculationType = "RANGE",
            RuleDescription = "Khung giá cho thuê kho tiêu chuẩn 15m2",
            MinValue = 1_000_000m,
            MaxValue = 3_000_000m,
            EffectiveFrom = today.AddDays(-10),
            Status = "ACTIVE",
            CreatedBy = f.OperatorUser.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await f.Db.SaveChangesAsync();

        // Đặt giá 3.500.000 > MaxValue 3.000.000
        var req = new SetRateRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId, 3_500_000m, today);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.SetRateAsync(req, f.OperatorUser.UserId));
        Assert.Contains("nằm ngoài khung giá", ex.Message);
    }
}
