using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class UnitLocationFloorZoneTests : IAsyncDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _db;
    private readonly ManagerService _managerService;
    private readonly User _manager;
    private readonly User _customer;
    private readonly Facility _facility;
    private readonly UnitType _normalM;
    private readonly UnitType _climateL;

    public UnitLocationFloorZoneTests()
    {
        _conn = new SqliteConnection("Data Source=:memory:");
        _conn.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_conn)
            .Options;

        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();

        var managerRole = new Role { RoleName = "MANAGER", Description = "Quản lý cơ sở" };
        var customerRole = new Role { RoleName = "CUSTOMER", Description = "Khách hàng" };
        _db.Roles.AddRange(managerRole, customerRole);
        _db.SaveChanges();

        _manager = new User
        {
            Username = "manager_loc",
            FullName = "Quản lý cơ sở",
            Email = "manager_loc@safespace.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _customer = new User
        {
            Username = "customer_loc",
            FullName = "Nguyễn Văn A",
            Email = "a@customer.vn",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.AddRange(_manager, _customer);
        _db.SaveChanges();

        _db.UserRoles.AddRange(
            new UserRole { UserId = _manager.UserId, RoleId = managerRole.RoleId, AssignedAt = DateTime.UtcNow },
            new UserRole { UserId = _customer.UserId, RoleId = customerRole.RoleId, AssignedAt = DateTime.UtcNow }
        );

        _facility = new Facility
        {
            Name = "SafeSpace Nguyễn Lương Bằng",
            Address = "123 Nguyễn Lương Bằng, Quận 7",
            ContactPhone = "0825123676",
            OpeningTime = new TimeOnly(6, 0),
            ClosingTime = new TimeOnly(22, 0),
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(_facility);
        _db.SaveChanges();

        _db.UserFacilities.Add(new UserFacility
        {
            UserId = _manager.UserId,
            FacilityId = _facility.FacilityId,
            Status = "ACTIVE",
            AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow
        });

        _normalM = new UnitType
        {
            TypeName = "Kho thường M",
            Area = 15m,
            Length = 5m,
            Width = 3m,
            Height = 3m,
            ClimateControlled = false,
            Description = "Kho thường 15m2",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _climateL = new UnitType
        {
            TypeName = "Kho lạnh L",
            Area = 30m,
            Length = 6m,
            Width = 5m,
            Height = 3m,
            ClimateControlled = true,
            Description = "Kho lạnh 30m2",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.UnitTypes.AddRange(_normalM, _climateL);
        _db.SaveChanges();

        var staffService = new StaffService(_db);
        _managerService = new ManagerService(_db, staffService);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _conn.DisposeAsync();
    }

    [Fact]
    public async Task GetLocationLayoutAsync_ReturnsStandardFloorsAndZones()
    {
        var layout = await _managerService.GetLocationLayoutAsync(_manager.UserId, _facility.FacilityId);

        Assert.Equal(_facility.FacilityId, layout.FacilityId);
        Assert.Equal(_facility.Name, layout.FacilityName);
        Assert.Contains(layout.Floors, f => f.Value == "Tầng trệt" && f.Zones.Contains("Dãy A") && f.Zones.Contains("Dãy B"));
        Assert.Contains(layout.Floors, f => f.Value == "Tầng 1" && f.Zones.Contains("Dãy A") && f.Zones.Contains("Dãy B") && f.Zones.Contains("Dãy C"));
        Assert.Contains(layout.Floors, f => f.Value == "Tầng 2" && f.Zones.Contains("Dãy A") && f.Zones.Contains("Dãy B"));
    }

    [Fact]
    public async Task CreateUnitAsync_WithValidFloorZone_SavesProperly()
    {
        var req = new CreateStorageUnitRequest
        {
            UnitNumber = "K15",
            Floor = "Tầng 1",
            Zone = "Dãy C",
            LocationDescription = "Cạnh cửa số 3",
            UnitTypeId = _climateL.UnitTypeId
        };

        var created = await _managerService.CreateUnitAsync(_manager.UserId, req);

        Assert.Equal("K15", created.Code);
        Assert.Equal("Tầng 1", created.FloorName);
        Assert.Equal("Dãy C", created.Zone);
        Assert.Equal("Cạnh cửa số 3", created.LocationDescription);
        Assert.Equal(_climateL.UnitTypeId, created.UnitTypeId);
        Assert.Equal(30m, created.Area);
        Assert.Equal("climate", created.Type);

        var fromDb = await _db.StorageUnits.FirstOrDefaultAsync(u => u.UnitNumber == "K15");
        Assert.NotNull(fromDb);
        Assert.Equal("Tầng 1", fromDb.Floor);
        Assert.Equal("Dãy C", fromDb.Zone);
        Assert.Equal("Cạnh cửa số 3", fromDb.LocationDescription);
    }

    [Fact]
    public async Task CreateUnitAsync_WithInvalidFloorOrZone_ThrowsInvalidOperationException()
    {
        var reqInvalidFloor = new CreateStorageUnitRequest
        {
            UnitNumber = "K16",
            Floor = "Tầng 99",
            Zone = "Dãy A",
            UnitTypeId = _normalM.UnitTypeId
        };
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _managerService.CreateUnitAsync(_manager.UserId, reqInvalidFloor));

        var reqInvalidZone = new CreateStorageUnitRequest
        {
            UnitNumber = "K16",
            Floor = "Tầng trệt",
            Zone = "Dãy Z",
            UnitTypeId = _normalM.UnitTypeId
        };
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _managerService.CreateUnitAsync(_manager.UserId, reqInvalidZone));
    }

    [Fact]
    public async Task UpdateUnitAsync_UpdatesFloorZoneAndClearsDescription()
    {
        var unit = new StorageUnit
        {
            FacilityId = _facility.FacilityId,
            UnitTypeId = _normalM.UnitTypeId,
            UnitNumber = "K17",
            Floor = "Tầng trệt",
            Zone = "Dãy A",
            LocationDescription = "Mô tả ban đầu",
            Status = "AVAILABLE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.StorageUnits.Add(unit);
        await _db.SaveChangesAsync();

        var updateReq = new UpdateStorageUnitRequest
        {
            Floor = "Tầng 1",
            Zone = "Dãy B",
            LocationDescription = "" // Xóa mô tả
        };

        var updated = await _managerService.UpdateUnitAsync(_manager.UserId, "K17", updateReq);

        Assert.Equal("Tầng 1", updated.FloorName);
        Assert.Equal("Dãy B", updated.Zone);
        Assert.Null(updated.LocationDescription);

        var fromDb = await _db.StorageUnits.FirstOrDefaultAsync(u => u.UnitNumber == "K17");
        Assert.NotNull(fromDb);
        Assert.Equal("Tầng 1", fromDb.Floor);
        Assert.Equal("Dãy B", fromDb.Zone);
        Assert.Null(fromDb.LocationDescription);
    }

    [Fact]
    public async Task UpdateUnitAsync_BlockChangingUnitType_WhenUnitHasActiveContract()
    {
        var unit = new StorageUnit
        {
            FacilityId = _facility.FacilityId,
            UnitTypeId = _normalM.UnitTypeId,
            UnitNumber = "K18",
            Floor = "Tầng trệt",
            Zone = "Dãy A",
            Status = "OCCUPIED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.StorageUnits.Add(unit);
        await _db.SaveChangesAsync();

        var reservation = new Reservation
        {
            CustomerId = _customer.UserId,
            FacilityId = _facility.FacilityId,
            UnitTypeId = _normalM.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(3)),
            RentalPeriodMonths = 3,
            EstimatedAmount = 4500000m,
            RequiredDeposit = 1500000m,
            QuotedMonthlyRate = 1500000m,
            Status = "CHECKED_IN",
            CreatedAt = DateTime.UtcNow
        };
        _db.Reservations.Add(reservation);
        await _db.SaveChangesAsync();

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = _customer.UserId,
            UnitId = unit.UnitId,
            StartDate = reservation.StartDate,
            EndDate = reservation.ExpectedEndDate,
            AgreedMonthlyRate = 1500000m,
            DepositAmount = 1500000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        var updateReq = new UpdateStorageUnitRequest
        {
            UnitTypeId = _climateL.UnitTypeId
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _managerService.UpdateUnitAsync(_manager.UserId, "K18", updateReq));

        Assert.Contains("đang có khách thuê", ex.Message);
    }

    [Fact]
    public async Task GetFacilityUnitsAsync_ReturnsFloorNameZoneAndDescription()
    {
        var unit = new StorageUnit
        {
            FacilityId = _facility.FacilityId,
            UnitTypeId = _climateL.UnitTypeId,
            UnitNumber = "K19",
            Floor = "Tầng trệt",
            Zone = "Dãy B",
            LocationDescription = "Gần cửa cuốn số 1",
            Status = "AVAILABLE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.StorageUnits.Add(unit);
        await _db.SaveChangesAsync();

        var units = await _managerService.GetFacilityUnitsAsync(_manager.UserId);
        var k19 = units.FirstOrDefault(u => u.Code == "K19");

        Assert.NotNull(k19);
        Assert.Equal("Tầng trệt", k19.FloorName);
        Assert.Equal("Dãy B", k19.Zone);
        Assert.Equal("Gần cửa cuốn số 1", k19.LocationDescription);
        Assert.Equal(_climateL.UnitTypeId, k19.UnitTypeId);
    }
}
