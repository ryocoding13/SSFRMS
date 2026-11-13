using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class OverdueCaseT12Tests : IAsyncDisposable
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
    private readonly FacilityOpsService _service;

    public OverdueCaseT12Tests()
    {
        _connection.Open();
        _db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        _service = new FacilityOpsService(_db);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private static readonly byte[] ValidJpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];
    private static readonly string ValidJpegBase64 = Convert.ToBase64String(ValidJpeg);

    private async Task<(Facility facility, User manager, User staff, RentalContract contract, OverdueCase overdueCase)> SetupDataAsync(int overdueDays = 25)
    {
        var facility = new Facility
        {
            Name = "SafeSpace Nguyễn Lương Bằng",
            Address = "123 NLB, Q7",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var manager = new User
        {
            Username = "manager_test",
            Email = "manager@test.com",
            FullName = "Nguyễn Quản Lý",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(manager);

        var staff = new User
        {
            Username = "staff_test",
            Email = "staff@test.com",
            FullName = "Trần Nhân Viên",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(staff);

        var customer = new User
        {
            Username = "customer_test",
            Email = "customer@test.com",
            FullName = "Lê Khách Hàng",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(customer);
        await _db.SaveChangesAsync();

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        _db.UserFacilities.Add(new UserFacility
        {
            UserId = manager.UserId,
            FacilityId = facility.FacilityId,
            AssignedFrom = today.AddDays(-30),
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        });
        _db.UserFacilities.Add(new UserFacility
        {
            UserId = staff.UserId,
            FacilityId = facility.FacilityId,
            AssignedFrom = today.AddDays(-30),
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        });

        var unitType = new UnitType
        {
            TypeName = "Kho thường",
            Description = "Mô tả",
            Area = 15,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.UnitTypes.Add(unitType);
        await _db.SaveChangesAsync();

        var unit = new StorageUnit
        {
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            UnitNumber = "K03",
            Floor = "1",
            Zone = "A",
            Status = "OCCUPIED",
            CreatedAt = DateTime.UtcNow
        };
        _db.StorageUnits.Add(unit);
        await _db.SaveChangesAsync();

        var reservation = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = today.AddDays(-60),
            ExpectedEndDate = today.AddDays(30),
            RentalPeriodMonths = 3,
            EstimatedAmount = 6000000,
            RequiredDeposit = 2000000,
            QuotedMonthlyRate = 2000000,
            Status = "CONFIRMED",
            CreatedAt = DateTime.UtcNow
        };
        _db.Reservations.Add(reservation);
        await _db.SaveChangesAsync();

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-overdueDays),
            DepositAmount = 2000000,
            AgreedMonthlyRate = 2000000,
            Status = "OVERDUE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        var overdueCase = new OverdueCase
        {
            ContractId = contract.ContractId,
            OverdueFrom = contract.EndDate.AddDays(1),
            GraceDeadline = contract.EndDate.AddDays(14),
            OutstandingAmount = 2000000,
            Status = "ESCALATED",
            OpenedAt = DateTime.UtcNow.AddDays(-overdueDays),
            Notes = $"Quá hạn ngày thứ {overdueDays}. Đạt mốc ngày 20 xử lý đồ."
        };
        _db.OverdueCases.Add(overdueCase);
        await _db.SaveChangesAsync();

        return (facility, manager, staff, contract, overdueCase);
    }

    [Fact]
    public async Task GetOverdueCasesAsync_ReturnsCasesForFacility()
    {
        var (facility, manager, staff, contract, overdueCase) = await SetupDataAsync(25);
        var actor = new OpsActor(manager.UserId, true);

        var list = await _service.GetOverdueCasesAsync(actor);

        Assert.NotEmpty(list);
        var item = list.First(x => x.Id == $"QH-{overdueCase.OverdueCaseId:D4}");
        Assert.Equal(facility.FacilityId, item.FacilityId);
        Assert.Equal("K03", item.Unit);
        Assert.Equal("Lê Khách Hàng", item.Customer);
        Assert.Equal(2000000, item.Deposit);
        Assert.Equal(20, item.RemovalDay);
        Assert.Equal("ESCALATED", item.Status);
        Assert.Null(item.Record);
    }

    [Fact]
    public async Task AssignRemovalAsync_RequiresManager_SetsStatusAssigned()
    {
        var (facility, manager, staff, contract, overdueCase) = await SetupDataAsync(25);

        // Staff calling assign throws 403
        var staffActor = new OpsActor(staff.UserId, false);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.HandleOverdueCaseActionAsync(staffActor, new OverdueCaseActionRequest(
                "ASSIGN_REMOVAL", $"QH-{overdueCase.OverdueCaseId:D4}", Assignee: staff.FullName)));

        // Manager calling assign succeeds
        var managerActor = new OpsActor(manager.UserId, true);
        var res = await _service.HandleOverdueCaseActionAsync(managerActor, new OverdueCaseActionRequest(
            "ASSIGN_REMOVAL", $"QH-{overdueCase.OverdueCaseId:D4}", Assignee: staff.FullName));

        Assert.Equal("ASSIGNED", res.Status);
        Assert.Equal(staff.FullName, res.Assignee);
        Assert.Equal(staff.UserId, res.AssigneeId);

        var reloaded = await _db.OverdueCases.FindAsync(overdueCase.OverdueCaseId);
        Assert.Equal("ESCALATED", reloaded!.Status);
        Assert.Equal(staff.UserId, reloaded.AssignedStaffId);
    }

    [Fact]
    public async Task RecordRemovalAsync_Fails_WhenBeforeDay20()
    {
        // 15 days overdue (< 20)
        var (facility, manager, staff, contract, overdueCase) = await SetupDataAsync(15);
        var actor = new OpsActor(staff.UserId, false);

        var req = new OverdueCaseActionRequest(
            "RECORD_REMOVAL",
            $"QH-{overdueCase.OverdueCaseId:D4}",
            PerformedAt: DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            Inventory: "02 thùng giấy",
            Location: "Khu tập kết A",
            UnitStatus: "INSPECTION",
            Confirmed: true,
            BeforePhotos: [new EvidencePhotoUpload("before.jpg", "image/jpeg", ValidJpegBase64)],
            AfterPhotos: [new EvidencePhotoUpload("after.jpg", "image/jpeg", ValidJpegBase64)]
        );

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.HandleOverdueCaseActionAsync(actor, req));

        Assert.Contains("20 ngày", ex.Message);
    }

    [Fact]
    public async Task RecordRemovalAsync_Fails_WhenPerformedAtInFuture()
    {
        var (facility, manager, staff, contract, overdueCase) = await SetupDataAsync(25);
        var actor = new OpsActor(staff.UserId, false);

        var req = new OverdueCaseActionRequest(
            "RECORD_REMOVAL",
            $"QH-{overdueCase.OverdueCaseId:D4}",
            PerformedAt: DateTime.UtcNow.AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            Inventory: "02 thùng giấy",
            Location: "Khu tập kết A",
            UnitStatus: "INSPECTION",
            Confirmed: true,
            BeforePhotos: [new EvidencePhotoUpload("before.jpg", "image/jpeg", ValidJpegBase64)],
            AfterPhotos: [new EvidencePhotoUpload("after.jpg", "image/jpeg", ValidJpegBase64)]
        );

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.HandleOverdueCaseActionAsync(actor, req));

        Assert.Contains("tương lai", ex.Message);
    }

    [Fact]
    public async Task RecordRemovalAsync_Fails_WhenPhotosMissing()
    {
        var (facility, manager, staff, contract, overdueCase) = await SetupDataAsync(25);
        var actor = new OpsActor(staff.UserId, false);

        var req = new OverdueCaseActionRequest(
            "RECORD_REMOVAL",
            $"QH-{overdueCase.OverdueCaseId:D4}",
            PerformedAt: DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            Inventory: "02 thùng giấy",
            Location: "Khu tập kết A",
            UnitStatus: "INSPECTION",
            Confirmed: true,
            BeforePhotos: [], // missing
            AfterPhotos: [new EvidencePhotoUpload("after.jpg", "image/jpeg", ValidJpegBase64)]
        );

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.HandleOverdueCaseActionAsync(actor, req));

        Assert.Contains("ít nhất một ảnh", ex.Message);
    }

    // D56: một bộ ảnh hiện trạng 1–10 tấm; nơi lưu giữ tự điền "Khu tạm giữ đồ quá hạn".
    [Fact]
    public async Task RecordRemovalAsync_SinglePhotoSet_AutoHoldingArea()
    {
        var (_, _, staff, _, overdueCase) = await SetupDataAsync(25);
        var actor = new OpsActor(staff.UserId, false);
        var req = new OverdueCaseActionRequest(
            "RECORD_REMOVAL",
            $"QH-{overdueCase.OverdueCaseId:D4}",
            PerformedAt: DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            Inventory: "02 thùng giấy",
            UnitStatus: "INSPECTION",
            Confirmed: true,
            Photos: [new EvidencePhotoUpload("kho.jpg", "image/jpeg", ValidJpegBase64), new EvidencePhotoUpload("khu-tam-giu.jpg", "image/jpeg", ValidJpegBase64)]);

        var res = await _service.HandleOverdueCaseActionAsync(actor, req);

        Assert.Equal("DONE", res.Status);
        Assert.Equal(FacilityOpsService.OverdueHoldingArea, res.Record!.Location);
        Assert.Equal(2, (res.Record.Photos ?? []).Count);
    }

    [Fact]
    public async Task RecordRemovalAsync_NoPhotos_Or_MoreThan10_Rejected()
    {
        var (_, _, staff, _, overdueCase) = await SetupDataAsync(25);
        var actor = new OpsActor(staff.UserId, false);
        OverdueCaseActionRequest Req(int n) => new(
            "RECORD_REMOVAL", $"QH-{overdueCase.OverdueCaseId:D4}",
            PerformedAt: DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"), Inventory: "02 thùng giấy", UnitStatus: "INSPECTION", Confirmed: true,
            Photos: Enumerable.Range(0, n).Select(i => new EvidencePhotoUpload($"a{i}.jpg", "image/jpeg", ValidJpegBase64)).ToList());

        var none = await Assert.ThrowsAsync<ArgumentException>(() => _service.HandleOverdueCaseActionAsync(actor, Req(0)));
        Assert.Contains("ít nhất một ảnh", none.Message);
        var many = await Assert.ThrowsAsync<ArgumentException>(() => _service.HandleOverdueCaseActionAsync(actor, Req(11)));
        Assert.Contains("tối đa 10", many.Message);
    }

    [Fact]
    public async Task RecordRemovalAsync_Succeeds_UpdatesUnitStatus_SavesPhotos_SetsStatusDone()
    {
        var (facility, manager, staff, contract, overdueCase) = await SetupDataAsync(25);
        var actor = new OpsActor(staff.UserId, false);

        var req = new OverdueCaseActionRequest(
            "RECORD_REMOVAL",
            $"QH-{overdueCase.OverdueCaseId:D4}",
            PerformedAt: DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            Inventory: "03 thùng carton và 01 vali",
            Location: "Khu tập kết tầng trệt",
            UnitStatus: "INSPECTION",
            Confirmed: true,
            BeforePhotos: [new EvidencePhotoUpload("truoc.jpg", "image/jpeg", ValidJpegBase64)],
            AfterPhotos: [new EvidencePhotoUpload("sau.jpg", "image/jpeg", ValidJpegBase64)]
        );

        var res = await _service.HandleOverdueCaseActionAsync(actor, req);

        Assert.Equal("DONE", res.Status);
        Assert.NotNull(res.Record);
        Assert.Equal(staff.FullName, res.Record.Staff);
        Assert.Equal("03 thùng carton và 01 vali", res.Record.Inventory);
        Assert.Equal("Khu tập kết tầng trệt", res.Record.Location);
        Assert.Equal("INSPECTION", res.Record.UnitStatus);
        Assert.NotEmpty(res.Record.BeforePhotos ?? []);
        Assert.NotEmpty(res.Record.AfterPhotos ?? []);

        // Verify storage unit status updated to INSPECTION
        var unit = await _db.StorageUnits.FindAsync(contract.UnitId);
        Assert.Equal("INSPECTION", unit!.Status);

        // Verify case resolved in DB
        var inDb = await _db.OverdueCases.FindAsync(overdueCase.OverdueCaseId);
        Assert.Equal("RESOLVED", inDb!.Status);
        Assert.NotNull(inDb.ResolvedAt);

        // Verify photos in DB
        var photos = await _db.EvidencePhotos.Where(p => p.OwnerId == overdueCase.OverdueCaseId).ToListAsync();
        Assert.Equal(2, photos.Count);
        // S06 (Phiên 3): loại ảnh riêng, không lẫn với ảnh biên bản trả kho có cùng số id.
        Assert.DoesNotContain(photos, p => p.OwnerType == EvidencePhotos.ReturnInspection);
        Assert.Contains(photos, p => p.OwnerType == EvidencePhotos.OverdueBefore && p.FileName.StartsWith("before_"));
        Assert.Contains(photos, p => p.OwnerType == EvidencePhotos.OverdueAfter && p.FileName.StartsWith("after_"));

        // Verify cannot submit again
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.HandleOverdueCaseActionAsync(actor, req));
        Assert.Contains("không gửi lại", ex.Message);
    }
}
