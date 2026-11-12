using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;
using Xunit;

namespace StorageProject.Tests;

// #60: dữ liệu demo theo từng cơ sở — đủ tài khoản, đúng phân công, có hợp đồng đang thuê và đơn chờ thu tại quầy; chạy lại không trùng.
public sealed class DemoFacilitySeedTests
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

    [Fact]
    public async Task Each_facility_gets_staff_manager_customers_and_seed_is_idempotent()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();

        await DbSeeder.SeedAsync(db);
        var users = await db.Users.CountAsync();
        var reservations = await db.Reservations.CountAsync();
        var contracts = await db.RentalContracts.CountAsync();

        foreach (var (name, code) in DbSeeder.DemoFacilityCodes)
        {
            var facility = await db.Facilities.SingleAsync(f => f.Name == name);
            foreach (var username in new[] { $"Staff_{code}", $"Manager_{code}" })
            {
                var user = await db.Users.SingleAsync(u => u.Username == username);
                var scopes = await db.UserFacilities.Where(uf => uf.UserId == user.UserId && uf.Status == "ACTIVE").ToListAsync();
                Assert.Single(scopes); // mỗi quản lý / nhân viên demo phụ trách đúng 1 cơ sở
                Assert.Equal(facility.FacilityId, scopes[0].FacilityId);
            }
            var renter = await db.Users.SingleAsync(u => u.Username == $"Customer{code}01");
            var contract = await db.RentalContracts.Include(c => c.Unit).SingleAsync(c => c.CustomerId == renter.UserId);
            Assert.Equal("ACTIVE", contract.Status);
            Assert.Equal(facility.FacilityId, contract.Unit.FacilityId);
            Assert.Equal("OCCUPIED", contract.Unit.Status);
            Assert.Equal(contract.AgreedMonthlyRate, contract.DepositAmount); // cọc = 1 tháng (D27)
            Assert.Equal(2, await db.AccessCredentials.CountAsync(a => a.ContractId == contract.ContractId && a.CredentialType == "ACCESS_CODE"));

            var payer = await db.Users.SingleAsync(u => u.Username == $"Customer{code}02");
            var pending = await db.Reservations.SingleAsync(r => r.CustomerId == payer.UserId);
            Assert.Equal("PENDING_AT_FACILITY", pending.Status);
            Assert.Equal("AT_FACILITY", pending.PaymentMethod);
            Assert.Equal(facility.FacilityId, pending.FacilityId);
        }

        // Các kỳ thuê của cùng một ô không chồng nhau
        var running = await db.RentalContracts.Where(c => c.Status == "ACTIVE").ToListAsync();
        Assert.Equal(running.Count, running.Select(c => c.UnitId).Distinct().Count());

        await DbSeeder.SeedAsync(db); // chạy lại
        Assert.Equal(users, await db.Users.CountAsync());
        Assert.Equal(reservations, await db.Reservations.CountAsync());
        Assert.Equal(contracts, await db.RentalContracts.CountAsync());
    }
}
