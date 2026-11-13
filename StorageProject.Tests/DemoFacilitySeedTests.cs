using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;
using Xunit;

namespace StorageProject.Tests;

// #60: dữ liệu demo theo từng cơ sở — đủ tài khoản (họ tên thật), đúng phân công; customer01 là khách duy nhất,
// thuê 1–6 hợp đồng đang hiệu lực ở mỗi cơ sở (khác nhau giữa các cơ sở); chạy lại không trùng.
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
    public async Task Each_facility_gets_staff_manager_one_customer_with_contracts_and_seed_is_idempotent()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();

        await DbSeeder.SeedAsync(db);
        var users = await db.Users.CountAsync();
        var reservations = await db.Reservations.CountAsync();
        var contractCount = await db.RentalContracts.CountAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var countsSeen = new List<int>();
        var renter = await db.Users.SingleAsync(u => u.Username == DbSeeder.DemoCustomerUsername);
        var customerIds = await db.UserRoles.Where(ur => ur.Role.RoleName == "CUSTOMER").Select(ur => ur.UserId).Distinct().ToListAsync();
        Assert.Equal(new[] { renter.UserId }, customerIds); // cả hệ thống chỉ 1 khách hàng
        foreach (var gone in new[] { "staff01", "staff02", "manager01", "customer02" })
            Assert.False(await db.Users.AnyAsync(u => u.Username == gone)); // D61: bỏ tài khoản cũ

        foreach (var (name, code) in DbSeeder.DemoFacilityCodes)
        {
            var facility = await db.Facilities.SingleAsync(f => f.Name == name);
            foreach (var username in new[] { $"Staff_{code}", $"Manager_{code}" })
            {
                var user = await db.Users.SingleAsync(u => u.Username == username);
                Assert.Equal(username.StartsWith("Staff_") ? DbSeeder.DemoStaffNames[code].Staff : DbSeeder.DemoStaffNames[code].Manager, user.FullName);
                var scopes = await db.UserFacilities.Where(uf => uf.UserId == user.UserId && uf.Status == "ACTIVE").ToListAsync();
                Assert.Single(scopes); // mỗi quản lý / nhân viên demo phụ trách đúng 1 cơ sở
                Assert.Equal(facility.FacilityId, scopes[0].FacilityId);
            }
            Assert.False(await db.Users.AnyAsync(u => u.Username == $"Customer{code}01")); // bỏ khách riêng từng cơ sở
            var contracts = await db.RentalContracts.Include(c => c.Unit)
                .Where(c => c.CustomerId == renter.UserId && c.Unit.FacilityId == facility.FacilityId).ToListAsync();
            Assert.Equal(DbSeeder.DemoFacilityOrderCounts[code], contracts.Count);
            Assert.InRange(contracts.Count, 1, 6); // để lại ít nhất 6/12 ô cho người dùng tự demo
            foreach (var contract in contracts)
            {
                Assert.Equal("ACTIVE", contract.Status);
                Assert.Equal(facility.FacilityId, contract.Unit.FacilityId);
                Assert.Equal("OCCUPIED", contract.Unit.Status);
                Assert.True(contract.StartDate <= today && contract.EndDate > today); // còn trong hạn
                Assert.Equal(contract.AgreedMonthlyRate, contract.DepositAmount); // cọc = 1 tháng (D27)
                Assert.Equal(2, await db.AccessCredentials.CountAsync(a => a.ContractId == contract.ContractId && a.CredentialType == "ACCESS_CODE"));
            }
            countsSeen.Add(contracts.Count);
        }
        Assert.True(countsSeen.Distinct().Count() > 1); // các cơ sở có số đơn khác nhau
        Assert.False(await db.Reservations.AnyAsync(r => r.CustomerId == renter.UserId && r.Status != "UNIT_ASSIGNED"));
        Assert.Equal(DbSeeder.DemoFacilityOrderCounts.Values.Sum(), contractCount);

        // Các kỳ thuê của cùng một ô không chồng nhau
        var running = await db.RentalContracts.Where(c => c.Status == "ACTIVE").ToListAsync();
        Assert.Equal(running.Count, running.Select(c => c.UnitId).Distinct().Count());

        await DbSeeder.SeedAsync(db); // chạy lại
        Assert.Equal(users, await db.Users.CountAsync());
        Assert.Equal(reservations, await db.Reservations.CountAsync());
        Assert.Equal(contractCount, await db.RentalContracts.CountAsync());
    }
}
