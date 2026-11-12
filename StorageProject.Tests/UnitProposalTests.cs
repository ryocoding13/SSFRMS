using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

// #2 (Lượt 4): hệ thống tự bố trí ô khi tạo đơn, ô khả dụng cả kỳ, không trùng đơn khác; cấp hợp đồng dùng đúng ô đó.
public sealed class UnitProposalTests
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

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Customer = null!;
        public Facility Facility = null!;
        public UnitType Type = null!;

        public async Task InitAsync(params string[] units)
        {
            await connection.OpenAsync();
            Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
            await Db.Database.EnsureCreatedAsync();
            Customer = new User { Username = "khach_l4", Email = "khach_l4@storage.vn", PasswordHash = "x", FullName = "Lê Văn An", Status = "ACTIVE" };
            Db.Users.Add(Customer);
            Facility = new Facility { Name = "SafeSpace L4", Address = "1 Test", Status = "ACTIVE" };
            Type = new UnitType { TypeName = "Kho thường 15m2", Area = 15m, Status = "ACTIVE" };
            Db.AddRange(Facility, Type);
            await Db.SaveChangesAsync();
            foreach (var u in units)
                Db.StorageUnits.Add(new StorageUnit { FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, UnitNumber = u, Status = "AVAILABLE" });
            Db.RentalRates.Add(new RentalRate { FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, SetBy = Customer.UserId,
                CreatedAt = DateTime.UtcNow, MonthlyRate = 1_150_000m, EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)), Status = "ACTIVE" });
            await Db.SaveChangesAsync();
        }

        public CreateReservationRequest Request(int days = 2, int months = 3) =>
            new(Facility.FacilityId, Type.UnitTypeId, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(days)), months);

        public ValueTask DisposeAsync()
        {
            Db.Dispose();
            connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    [Fact]
    public async Task Each_new_reservation_gets_its_own_unit_shown_before_confirmation()
    {
        await using var f = new Fixture();
        await f.InitAsync("A-101", "A-102");
        var service = new ReservationService(f.Db);

        var first = await service.CreateReservationAsync(f.Customer.UserId, f.Request());
        var second = await service.CreateReservationAsync(f.Customer.UserId, f.Request());

        Assert.Equal("A-101", first.ProposedUnitNumber);
        Assert.Equal("A-102", second.ProposedUnitNumber); // không trùng ô đã đề xuất cho đơn khác cùng kỳ
        var detail = await service.GetReservationDetailAsync(f.Customer.UserId, first.ReservationId);
        Assert.Equal("A-101", detail!.ProposedUnitNumber);
        Assert.Null(detail.AssignedUnitNumber); // chưa phân bổ chính thức trước khi thanh toán

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateReservationAsync(f.Customer.UserId, f.Request()));
    }

    [Fact]
    public async Task Non_overlapping_period_can_reuse_the_same_unit()
    {
        await using var f = new Fixture();
        await f.InitAsync("A-101");
        var service = new ReservationService(f.Db);
        var first = await service.CreateReservationAsync(f.Customer.UserId, f.Request(days: 2, months: 1));
        var later = await service.CreateReservationAsync(f.Customer.UserId, f.Request(days: 120, months: 1));
        Assert.Equal("A-101", first.ProposedUnitNumber);
        Assert.Equal("A-101", later.ProposedUnitNumber);
    }

    [Fact]
    public async Task Proposal_parse_ignores_malformed_logs()
    {
        Assert.Null(UnitProposal.Parse(null));
        Assert.Null(UnitProposal.Parse("{oops"));
        Assert.Null(UnitProposal.Parse("{\"unit\":\"A-1\"}"));
        Assert.Equal("A-1", UnitProposal.Parse("{\"unitId\":7,\"unit\":\"A-1\"}")!.UnitNumber);
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Provisioning_keeps_the_proposed_unit_when_still_free()
    {
        await using var f = new Fixture();
        await f.InitAsync("A-101", "A-102");
        var service = new ReservationService(f.Db);
        await service.CreateReservationAsync(f.Customer.UserId, f.Request());
        var second = await service.CreateReservationAsync(f.Customer.UserId, f.Request());
        var r = await f.Db.Reservations.SingleAsync(x => x.ReservationId == second.ReservationId);
        var unit = await UnitProposal.ChooseAsync(f.Db, r, default);
        Assert.Equal("A-102", unit!.UnitNumber);
    }
}
