using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Admin;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>T24: đổi vai trò trong một giao dịch (POST /api/admin/users/{id}/role-change).</summary>
public sealed class AdminRoleChangeTests
{
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        public AuthSupportHttpFixture.TestDb Db { get; private set; } = null!;
        public AdminService Service { get; private set; } = null!;
        public Role Admin { get; private set; } = null!;
        public Role Staff { get; private set; } = null!;
        public Role Manager { get; private set; } = null!;
        public Role Operations { get; private set; } = null!;
        public User Root { get; private set; } = null!;
        public User Worker { get; private set; } = null!;

        public static async Task<Fixture> Create()
        {
            var f = new Fixture();
            await f.connection.OpenAsync();
            f.Db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.connection).Options);
            await f.Db.Database.EnsureCreatedAsync();
            f.Admin = new Role { RoleName = "ADMIN", Description = "Quản trị" };
            f.Staff = new Role { RoleName = "STAFF", Description = "Nhân viên" };
            f.Manager = new Role { RoleName = "MANAGER", Description = "Quản lý cơ sở" };
            f.Operations = new Role { RoleName = "OPERATIONS", Description = "Vận hành KD" };
            f.Root = NewUser("admin");
            f.Worker = NewUser("staff01");
            f.Db.AddRange(f.Admin, f.Staff, f.Manager, f.Operations, f.Root, f.Worker);
            await f.Db.SaveChangesAsync();
            f.Db.UserRoles.AddRange(
                new UserRole { UserId = f.Root.UserId, RoleId = f.Admin.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = f.Worker.UserId, RoleId = f.Staff.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = f.Worker.UserId, RoleId = f.Operations.RoleId, AssignedAt = DateTime.UtcNow });
            await f.Db.SaveChangesAsync();
            f.Db.ChangeTracker.Clear();
            f.Service = new AdminService(f.Db);
            return f;
        }

        private static User NewUser(string username) => new()
        {
            Username = username,
            Email = $"{username}@storage.vn",
            FullName = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Test@123", 4),
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        public async Task<List<long>> RolesOf(long userId) =>
            await Db.UserRoles.AsNoTracking().Where(ur => ur.UserId == userId).Select(ur => ur.RoleId).OrderBy(id => id).ToListAsync();

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    [Fact]
    public async Task ChangeRole_ReplacesOnlyThatRole_KeepsOthers_AndLogs()
    {
        await using var f = await Fixture.Create();
        var before = await f.RolesOf(f.Worker.UserId);

        await f.Service.ChangeRoleAsync(f.Worker.UserId, new ChangeRoleRequest(f.Staff.RoleId, f.Manager.RoleId, before), f.Root.UserId);

        Assert.Equal(new[] { f.Manager.RoleId, f.Operations.RoleId }.OrderBy(id => id), await f.RolesOf(f.Worker.UserId));
        Assert.Equal(1, await f.Db.ActivityLogs.CountAsync(l => l.Action == "ROLE_CHANGE" && l.EntityId == f.Worker.UserId));
    }

    [Fact]
    public async Task ChangeRole_StaleExpectedRoles_Conflicts_AndChangesNothing()
    {
        await using var f = await Fixture.Create();
        var stale = new List<long> { f.Staff.RoleId }; // FE chưa thấy vai trò Vận hành KD vừa được gán

        await Assert.ThrowsAsync<OperationConflictException>(() =>
            f.Service.ChangeRoleAsync(f.Worker.UserId, new ChangeRoleRequest(f.Staff.RoleId, f.Manager.RoleId, stale), f.Root.UserId));
        Assert.Equal(new[] { f.Staff.RoleId, f.Operations.RoleId }.OrderBy(id => id), await f.RolesOf(f.Worker.UserId));
    }

    [Fact]
    public async Task ChangeRole_TargetAlreadyHeld_OrPreviousMissing_IsRejected()
    {
        await using var f = await Fixture.Create();
        var before = await f.RolesOf(f.Worker.UserId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Service.ChangeRoleAsync(f.Worker.UserId, new ChangeRoleRequest(f.Staff.RoleId, f.Operations.RoleId, before), f.Root.UserId));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Service.ChangeRoleAsync(f.Worker.UserId, new ChangeRoleRequest(f.Manager.RoleId, f.Admin.RoleId, before), f.Root.UserId));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Service.ChangeRoleAsync(f.Worker.UserId, new ChangeRoleRequest(f.Staff.RoleId, f.Staff.RoleId, before), f.Root.UserId));
        Assert.Equal(before, await f.RolesOf(f.Worker.UserId));
    }

    [Fact]
    public async Task ChangeRole_LastActiveAdmin_CannotLoseAdminRole()
    {
        await using var f = await Fixture.Create();
        var before = await f.RolesOf(f.Root.UserId);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Service.ChangeRoleAsync(f.Root.UserId, new ChangeRoleRequest(f.Admin.RoleId, f.Manager.RoleId, before), f.Root.UserId));
        Assert.Contains("Admin hoạt động duy nhất", ex.Message);
        Assert.Equal(before, await f.RolesOf(f.Root.UserId));
    }

    // Lượt 6b: admin không xem được IP (và thiết bị) của tài khoản khách hàng; IP nhân viên/admin vẫn hiện.
    [Fact]
    public async Task Logs_HideCustomerIp_KeepStaffIp()
    {
        await using var f = await Fixture.Create();
        var customerRole = new Role { RoleName = "CUSTOMER", Description = "Khách hàng" };
        var customer = new User { Username = "customer01", Email = "c@storage.vn", FullName = "Khách", PasswordHash = "x", Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        f.Db.AddRange(customerRole, customer);
        await f.Db.SaveChangesAsync();
        f.Db.UserRoles.Add(new UserRole { UserId = customer.UserId, RoleId = customerRole.RoleId, AssignedAt = DateTime.UtcNow });
        var now = DateTime.UtcNow;
        f.Db.LoginHistories.AddRange(
            new LoginHistory { UserId = customer.UserId, LoginAt = now, IpAddress = "113.161.24.5", DeviceInfo = "phone", LoginStatus = "SUCCESS" },
            new LoginHistory { UserId = f.Worker.UserId, LoginAt = now.AddMinutes(-1), IpAddress = "113.161.55.2", DeviceInfo = "pc", LoginStatus = "SUCCESS" });
        f.Db.ActivityLogs.AddRange(
            new ActivityLog { UserId = customer.UserId, Action = "UPDATE", EntityType = "USER", IpAddress = "113.161.24.5", LoggedAt = now },
            new ActivityLog { UserId = f.Worker.UserId, Action = "UPDATE", EntityType = "USER", IpAddress = "113.161.55.2", LoggedAt = now.AddMinutes(-1) },
            new ActivityLog { UserId = null, Action = "SYSTEM", EntityType = "JOB", IpAddress = "10.0.0.1", LoggedAt = now.AddMinutes(-2) });
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();

        var logins = (await f.Service.GetLoginHistoriesAsync(new LogQueryFilter())).Items;
        Assert.Null(logins.Single(x => x.UserId == customer.UserId).IpAddress);
        Assert.Null(logins.Single(x => x.UserId == customer.UserId).DeviceInfo);
        Assert.Equal("113.161.55.2", logins.Single(x => x.UserId == f.Worker.UserId).IpAddress);

        var acts = (await f.Service.GetActivityLogsAsync(new LogQueryFilter())).Items;
        Assert.Null(acts.Single(x => x.UserId == customer.UserId).IpAddress);
        Assert.Equal("113.161.55.2", acts.Single(x => x.UserId == f.Worker.UserId).IpAddress);
        Assert.Equal("10.0.0.1", acts.Single(x => x.UserId == null).IpAddress);
    }
}
