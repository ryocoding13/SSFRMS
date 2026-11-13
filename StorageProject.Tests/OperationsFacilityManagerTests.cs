using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class OperationsFacilityManagerTests : IAsyncDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _db;
    private readonly OperationsService _opsService;
    private readonly Role _managerRole;
    private readonly Role _staffRole;

    public OperationsFacilityManagerTests()
    {
        _conn = new SqliteConnection("Data Source=:memory:");
        _conn.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_conn)
            .Options;

        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();

        _managerRole = new Role { RoleName = "MANAGER", Description = "Quản lý cơ sở" };
        _staffRole = new Role { RoleName = "STAFF", Description = "Nhân viên cơ sở" };
        _db.Roles.AddRange(_managerRole, _staffRole);
        _db.SaveChanges();

        _opsService = new OperationsService(_db);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _conn.DisposeAsync();
    }

    [Fact]
    public async Task GetFacilitiesAsync_WithValidManager_ReturnsManagerNameAndId()
    {
        var facility = new Facility
        {
            Name = "SafeSpace Nguyễn Lương Bằng",
            Address = "123 Nguyễn Lương Bằng, Quận 7",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var manager = new User
        {
            Username = "manager01",
            FullName = "Nguyễn Văn An",
            Email = "manager01@safespace.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(manager);
        await _db.SaveChangesAsync();

        _db.UserRoles.Add(new UserRole { UserId = manager.UserId, RoleId = _managerRole.RoleId, AssignedAt = DateTime.UtcNow });
        _db.UserFacilities.Add(new UserFacility
        {
            UserId = manager.UserId,
            FacilityId = facility.FacilityId,
            Status = "ACTIVE",
            AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var facilities = await _opsService.GetFacilitiesAsync(null, null);
        var f = Assert.Single(facilities, x => x.FacilityId == facility.FacilityId);

        Assert.Equal("Nguyễn Văn An", f.ManagerName);
        Assert.Equal(manager.UserId, f.ManagerId);
        Assert.NotNull(f.Managers);
        var mgr = Assert.Single(f.Managers);
        Assert.Equal(manager.UserId, mgr.UserId);
        Assert.Equal("Nguyễn Văn An", mgr.FullName);
    }

    [Fact]
    public async Task GetFacilitiesAsync_WithoutManager_ReturnsNullManagerNameAndEmptyList()
    {
        var facility = new Facility
        {
            Name = "SafeSpace Chưa Quản Lý",
            Address = "456 Lê Văn Lương, Quận 7",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var staff = new User
        {
            Username = "staff01",
            FullName = "Trần Thị Bích",
            Email = "staff01@safespace.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(staff);
        await _db.SaveChangesAsync();

        _db.UserRoles.Add(new UserRole { UserId = staff.UserId, RoleId = _staffRole.RoleId, AssignedAt = DateTime.UtcNow });
        _db.UserFacilities.Add(new UserFacility
        {
            UserId = staff.UserId,
            FacilityId = facility.FacilityId,
            Status = "ACTIVE",
            AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var facilities = await _opsService.GetFacilitiesAsync(null, null);
        var f = Assert.Single(facilities, x => x.FacilityId == facility.FacilityId);

        Assert.Null(f.ManagerName);
        Assert.Null(f.ManagerId);
        Assert.NotNull(f.Managers);
        Assert.Empty(f.Managers);
        Assert.Equal(1, f.AssignedStaff); // Staff vẫn được đếm vào AssignedStaff
    }

    [Fact]
    public async Task GetFacilitiesAsync_WithInactiveOrEndedAssignment_DoesNotCountAsCurrentManager()
    {
        var facility = new Facility
        {
            Name = "SafeSpace Hết Hạn Phân Công",
            Address = "789 Huỳnh Tấn Phát, Quận 7",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var endedManager = new User
        {
            Username = "ended_mgr",
            FullName = "Lê Hoàng Cũ",
            Email = "ended_mgr@safespace.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var lockedManager = new User
        {
            Username = "locked_mgr",
            FullName = "Phạm Khóa",
            Email = "locked_mgr@safespace.vn",
            PasswordHash = "hash",
            Status = "LOCKED", // Tài khoản bị khóa
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var futureManager = new User
        {
            Username = "future_mgr",
            FullName = "Võ Tương Lai",
            Email = "future_mgr@safespace.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.AddRange(endedManager, lockedManager, futureManager);
        await _db.SaveChangesAsync();

        _db.UserRoles.AddRange(
            new UserRole { UserId = endedManager.UserId, RoleId = _managerRole.RoleId, AssignedAt = DateTime.UtcNow },
            new UserRole { UserId = lockedManager.UserId, RoleId = _managerRole.RoleId, AssignedAt = DateTime.UtcNow },
            new UserRole { UserId = futureManager.UserId, RoleId = _managerRole.RoleId, AssignedAt = DateTime.UtcNow }
        );

        _db.UserFacilities.AddRange(
            // Phân công đã kết thúc
            new UserFacility
            {
                UserId = endedManager.UserId,
                FacilityId = facility.FacilityId,
                Status = "ENDED",
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-60)),
                AssignedTo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
                CreatedAt = DateTime.UtcNow
            },
            // Phân công ACTIVE nhưng tài khoản bị LOCKED
            new UserFacility
            {
                UserId = lockedManager.UserId,
                FacilityId = facility.FacilityId,
                Status = "ACTIVE",
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                CreatedAt = DateTime.UtcNow
            },
            // Phân công tương lai (chưa đến ngày nhận nhiệm vụ)
            new UserFacility
            {
                UserId = futureManager.UserId,
                FacilityId = facility.FacilityId,
                Status = "ACTIVE",
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                CreatedAt = DateTime.UtcNow
            }
        );
        await _db.SaveChangesAsync();

        var facilities = await _opsService.GetFacilitiesAsync(null, null);
        var f = Assert.Single(facilities, x => x.FacilityId == facility.FacilityId);

        Assert.Null(f.ManagerName);
        Assert.Null(f.ManagerId);
        Assert.Empty(f.Managers!);
    }

    [Fact]
    public async Task GetFacilitiesAsync_WithMultipleRolesOrEmptyName_FormatsCorrectly()
    {
        var facility = new Facility
        {
            Name = "SafeSpace Đa Vai Trò",
            Address = "111 Nguyễn Hữu Thọ, Nhà Bè",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var manager = new User
        {
            Username = "multi_role",
            FullName = "   ", // Tên rỗng -> fallback "Quản lý #{UserId}"
            Email = "multi_role@safespace.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(manager);
        await _db.SaveChangesAsync();

        // Gán cả 2 vai trò: MANAGER và STAFF
        _db.UserRoles.AddRange(
            new UserRole { UserId = manager.UserId, RoleId = _managerRole.RoleId, AssignedAt = DateTime.UtcNow },
            new UserRole { UserId = manager.UserId, RoleId = _staffRole.RoleId, AssignedAt = DateTime.UtcNow }
        );

        _db.UserFacilities.Add(new UserFacility
        {
            UserId = manager.UserId,
            FacilityId = facility.FacilityId,
            Status = "ACTIVE",
            AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var facilities = await _opsService.GetFacilitiesAsync(null, null);
        var f = Assert.Single(facilities, x => x.FacilityId == facility.FacilityId);

        // Deduplicate: chỉ xuất hiện 1 lần và fallback Quản lý #{UserId}
        Assert.Equal($"Quản lý #{manager.UserId}", f.ManagerName);
        Assert.Equal(manager.UserId, f.ManagerId);
        Assert.NotNull(f.Managers);
        var mgr = Assert.Single(f.Managers);
        Assert.Equal($"Quản lý #{manager.UserId}", mgr.FullName);
    }
}
