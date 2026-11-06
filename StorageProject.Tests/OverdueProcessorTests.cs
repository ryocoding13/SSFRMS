using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class OverdueProcessorTests : IAsyncDisposable
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
                if (p.GetDefaultValueSql() != null) p.SetDefaultValueSql(null);
        }
    }

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AppDbContext _db;

    public OverdueProcessorTests()
    {
        _connection.Open();
        _db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<(User customer, Facility facility, StorageUnit unit, Reservation reservation)> SetupBaseAsync()
    {
        var customer = new User
        {
            Username = "customer_test",
            Email = "customer@test.com",
            FullName = "Khách Hàng Test",
            PasswordHash = "hashed",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(customer);

        var facility = new Facility
        {
            Name = "SafeSpace Test Facility",
            Address = "123 Đường Test",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var unitType = new UnitType
        {
            TypeName = "Kho Tiêu Chuẩn",
            Area = 10,
            ClimateControlled = false,
            CreatedAt = DateTime.UtcNow
        };
        _db.UnitTypes.Add(unitType);
        await _db.SaveChangesAsync();

        var unit = new StorageUnit
        {
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            UnitNumber = "A-101",
            Status = "OCCUPIED",
            CreatedAt = DateTime.UtcNow
        };
        _db.StorageUnits.Add(unit);

        var reservation = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).AddMonths(1)),
            RentalPeriodMonths = 1,
            EstimatedAmount = 1_000_000m,
            RequiredDeposit = 1_000_000m,
            QuotedMonthlyRate = 1_000_000m,
            Status = "CONFIRMED",
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        };
        _db.Reservations.Add(reservation);
        await _db.SaveChangesAsync();

        return (customer, facility, unit, reservation);
    }

    [Fact]
    public async Task ProcessDailyOverdue_TransitionsActiveToExpiring_WhenWithin30Days()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(15), // Hết hạn trong 15 ngày tới
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var updated = await _db.RentalContracts.FindAsync(contract.ContractId);
        Assert.NotNull(updated);
        Assert.Equal("EXPIRING", updated.Status);
    }

    [Fact]
    public async Task ProcessDailyOverdue_TransitionsToOverdue_AndCreatesCase_With5PercentPerDay()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-5), // Đã quá hạn 5 ngày
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var updated = await _db.RentalContracts.Include(c => c.OverdueCases).FirstOrDefaultAsync(c => c.ContractId == contract.ContractId);
        Assert.NotNull(updated);
        Assert.Equal("OVERDUE", updated.Status);

        var activeCase = Assert.Single(updated.OverdueCases);
        // 5 ngày * 5% cọc = 25% * 1.000.000 = 250.000 đ
        Assert.Equal(250_000m, activeCase.OutstandingAmount);
        Assert.Equal("OPEN", activeCase.Status);
        Assert.Equal(contract.EndDate.AddDays(1), activeCase.OverdueFrom);
    }

    [Fact]
    public async Task ProcessDailyOverdue_EscalatesCase_WhenOverdue20Days_AndCapsAt100PercentDeposit()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-22), // Đã quá hạn 22 ngày (> 20 ngày)
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "OVERDUE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var updated = await _db.RentalContracts.Include(c => c.OverdueCases).FirstOrDefaultAsync(c => c.ContractId == contract.ContractId);
        Assert.NotNull(updated);

        var activeCase = Assert.Single(updated.OverdueCases);
        // Phí cap tối đa ở 100% cọc: 1.000.000 đ (dù 22 ngày * 5% = 110%)
        Assert.Equal(1_000_000m, activeCase.OutstandingAmount);
        Assert.Equal("ESCALATED", activeCase.Status);
        Assert.Contains("ngày 20", activeCase.Notes);
    }

    [Fact]
    public async Task ProcessDailyOverdue_IsIdempotent_DoesNotDuplicateOverdueCaseOrFees()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-4), // Quá hạn 4 ngày
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "OVERDUE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        // Chạy lần 1
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        // Chạy lần 2
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var cases = await _db.OverdueCases.Where(o => o.ContractId == contract.ContractId).ToListAsync();
        Assert.Single(cases);
        Assert.Equal(200_000m, cases[0].OutstandingAmount); // 4 ngày * 5% = 20% = 200.000
    }

    [Fact]
    public async Task ProcessDailyOverdue_StopsCalculatingFee_WhenReturnPending()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-10), // Hết hạn 10 ngày trước
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "RETURN_PENDING", // Khách đã gửi trả kho ở ngày thứ 2 quá hạn
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        // Biên bản trả kho được tạo 8 ngày trước (tức là trễ đúng 2 ngày sau EndDate)
        var inspection = new ReturnInspection
        {
            ContractId = contract.ContractId,
            StaffId = customer.UserId,
            Status = "SCHEDULED",
            CreatedAt = DateTime.UtcNow.AddDays(-8)
        };
        _db.ReturnInspections.Add(inspection);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var activeCase = await _db.OverdueCases.SingleAsync(o => o.ContractId == contract.ContractId);
        // D32: Dừng tính phí tại ngày gửi trả kho (2 ngày trễ * 5% = 10% = 100.000 đ), không tính đến 10 ngày (50%)
        Assert.Equal(100_000m, activeCase.OutstandingAmount);
    }

    [Fact]
    public async Task ProcessDailyOverdue_UsesRateFromActiveOverduePolicy()
    {
        // S05 (Phiên 2): tỷ lệ lấy từ chính sách OVERDUE (B02) thay vì ghi cứng 5%.
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        _db.Policies.Add(new Policy
        {
            CreatedBy = customer.UserId, PolicyName = "Quá hạn thử 3%", PolicyType = "OVERDUE",
            CalculationType = "DEPOSIT_PERCENT_PER_DAY", Value = 3m, RuleDescription = "Thử",
            EffectiveFrom = today.AddDays(-1), Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
            StartDate = today.AddDays(-60), EndDate = today.AddDays(-5), DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        await OverdueProcessor.ProcessDailyOverdueAsync(_db); // chạy lại không tạo trùng hồ sơ

        var cases = await _db.OverdueCases.Where(o => o.ContractId == contract.ContractId).ToListAsync();
        var c = Assert.Single(cases);
        Assert.Equal(150_000m, c.OutstandingAmount); // 5 ngày × 3% × 1.000.000
    }
}
