using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class FacilityManagementW6Tests
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
        public User CustomerUser = null!;
        public Facility Facility = null!;
        public UnitType UnitType = null!;
        public StorageUnit StorageUnit = null!;
        public RentalRate ActiveRate = null!;

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
                Username = "ops_w6",
                Email = "ops_w6@storage.vn",
                PasswordHash = "hash",
                FullName = "Quản lý Vận hành W6",
                Status = "ACTIVE"
            };
            CustomerUser = new User
            {
                Username = "customer_w6",
                Email = "customer_w6@storage.vn",
                PasswordHash = "hash",
                FullName = "Khách hàng W6",
                Status = "ACTIVE"
            };
            Db.Users.AddRange(OperatorUser, CustomerUser);
            await Db.SaveChangesAsync();

            Facility = new Facility
            {
                Name = "SafeSpace Cơ Sở W6",
                Address = "123 Đường Test W6",
                ContactPhone = "0901234567",
                OpeningTime = new TimeOnly(7, 0),
                ClosingTime = new TimeOnly(21, 0),
                Latitude = 10.776889m,
                Longitude = 106.700806m,
                Status = "ACTIVE"
            };
            Db.Facilities.Add(Facility);
            await Db.SaveChangesAsync();

            UnitType = new UnitType
            {
                TypeName = "Kho Tiêu Chuẩn 15m2",
                Description = "Mô tả W6",
                Area = 15m,
                Height = 3m,
                Status = "ACTIVE"
            };
            Db.UnitTypes.Add(UnitType);
            await Db.SaveChangesAsync();

            StorageUnit = new StorageUnit
            {
                FacilityId = Facility.FacilityId,
                UnitTypeId = UnitType.UnitTypeId,
                UnitNumber = "A-101",
                Status = "AVAILABLE"
            };
            Db.StorageUnits.Add(StorageUnit);

            ActiveRate = new RentalRate
            {
                FacilityId = Facility.FacilityId,
                UnitTypeId = UnitType.UnitTypeId,
                MonthlyRate = 2500000m,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                Status = "ACTIVE",
                SetBy = OperatorUser.UserId
            };
            Db.RentalRates.Add(ActiveRate);

            var depositPolicy = new Policy
            {
                PolicyName = "Chính sách cọc 1 tháng",
                PolicyType = "DEPOSIT",
                CalculationType = "FIXED",
                Value = 1m,
                RuleDescription = "1 tháng tiền thuê",
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                Status = "ACTIVE",
                CreatedBy = OperatorUser.UserId
            };
            Db.Policies.Add(depositPolicy);

            await Db.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    [Fact]
    public async Task T01_PendingAtFacilityReservation_BlocksInactiveTransition_ViaChangeFacilityStatusAsync()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        // Tạo đơn đặt chỗ ở trạng thái PENDING_AT_FACILITY
        var reservation = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = f.UnitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 2500000m,
            EstimatedAmount = 2500000m,
            RequiredDeposit = 2500000m,
            Status = "PENDING_AT_FACILITY",
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            PaymentMethod = "CASH"
        };
        f.Db.Reservations.Add(reservation);
        await f.Db.SaveChangesAsync();

        var service = new OperationsService(f.Db);

        // Đổi trạng thái sang INACTIVE phải bị chặn do còn đơn PENDING_AT_FACILITY
        var ex = await Assert.ThrowsAsync<OperationConflictException>(() =>
            service.ChangeFacilityStatusAsync(f.Facility.FacilityId,
                new ChangeFacilityStatusRequest("INACTIVE", "Đóng cửa cơ sở"),
                f.OperatorUser.UserId));

        Assert.Contains("đơn đặt chỗ đang xử lý", ex.Message);
    }

    [Fact]
    public async Task T02_PendingAtFacilityReservation_BlocksInactiveTransition_ViaUpdateFacilityAsync()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var reservation = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = f.UnitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 2500000m,
            EstimatedAmount = 2500000m,
            RequiredDeposit = 2500000m,
            Status = "PENDING_AT_FACILITY",
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            PaymentMethod = "CASH"
        };
        f.Db.Reservations.Add(reservation);
        await f.Db.SaveChangesAsync();

        var service = new OperationsService(f.Db);

        // Cập nhật thông tin cơ sở kèm status = INACTIVE phải bị chặn
        var ex = await Assert.ThrowsAsync<OperationConflictException>(() =>
            service.UpdateFacilityAsync(f.Facility.FacilityId,
                new UpsertFacilityRequest(f.Facility.Name, f.Facility.Address, f.Facility.ContactPhone,
                    "07:00", "21:00", "INACTIVE", f.Facility.Latitude, f.Facility.Longitude),
                f.OperatorUser.UserId));

        Assert.Contains("đơn đặt chỗ đang xử lý", ex.Message);
    }

    [Fact]
    public async Task T03_TemporarilyClosed_AllowedEvenWithOpenReservations_AndBlocksNewReservations()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        // Đơn PENDING_AT_FACILITY
        var reservation = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = f.UnitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 2500000m,
            EstimatedAmount = 2500000m,
            RequiredDeposit = 2500000m,
            Status = "PENDING_AT_FACILITY",
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            PaymentMethod = "CASH"
        };
        f.Db.Reservations.Add(reservation);
        await f.Db.SaveChangesAsync();

        var service = new OperationsService(f.Db);

        // Chuyển sang TEMPORARILY_CLOSED thành công
        var result = await service.ChangeFacilityStatusAsync(f.Facility.FacilityId,
            new ChangeFacilityStatusRequest("TEMPORARILY_CLOSED", "Bảo trì định kỳ"),
            f.OperatorUser.UserId);

        Assert.Equal("TEMPORARILY_CLOSED", result.Facility.Status);

        // Thử tạo đơn đặt chỗ mới tại cơ sở TEMPORARILY_CLOSED phải bị chặn
        var resService = new ReservationService(f.Db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            resService.CreateReservationAsync(f.CustomerUser.UserId,
                new CreateReservationRequest(f.Facility.FacilityId, f.UnitType.UnitTypeId,
                    DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)), 1)));

        Assert.Contains("tạm ngừng nhận đặt chỗ mới", ex.Message);
    }

    [Fact]
    public async Task T04_InactiveAllowed_WhenAllReservationsAndContractsAreClosed()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        // Đơn đã huỷ hoặc hết hạn
        var reservation = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = f.UnitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 2500000m,
            EstimatedAmount = 2500000m,
            RequiredDeposit = 2500000m,
            Status = "CANCELLED",
            PaymentMethod = "CASH"
        };
        f.Db.Reservations.Add(reservation);
        await f.Db.SaveChangesAsync();

        var service = new OperationsService(f.Db);

        // Chuyển sang INACTIVE thành công khi không còn đơn/hợp đồng mở
        var result = await service.ChangeFacilityStatusAsync(f.Facility.FacilityId,
            new ChangeFacilityStatusRequest("INACTIVE", "Ngừng hoạt động hẳn"),
            f.OperatorUser.UserId);

        Assert.Equal("INACTIVE", result.Facility.Status);
    }

    [Fact]
    public async Task T05_CreateFacility_WithoutOperationId_CreatesFacilityAndAuditLogAtomically()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var service = new OperationsService(f.Db);
        var req = new UpsertFacilityRequest(
            "SafeSpace Quận 7",
            "100 Nguyễn Thị Thập, Quận 7, TP.HCM",
            "0909999888",
            "08:00",
            "20:00",
            "ACTIVE",
            10.7423m,
            106.7214m
        );

        var result = await service.CreateFacilityAsync(req, f.OperatorUser.UserId);

        Assert.True(result.Facility.FacilityId > 0);
        Assert.Equal("SafeSpace Quận 7", result.Facility.Name);

        // Audit log phải được tạo trong cùng transaction
        var audit = await f.Db.ActivityLogs
            .FirstOrDefaultAsync(l => l.Action == "FACILITY_CREATE" && l.EntityId == result.Facility.FacilityId);

        Assert.NotNull(audit);
        Assert.Equal(f.OperatorUser.UserId, audit.UserId);
        Assert.Equal("FACILITY", audit.EntityType);
    }

    [Fact]
    public async Task T06_CreateFacility_WithOperationId_ReturnsSameFacilityOnRetry()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var service = new OperationsService(f.Db);
        var opId = "op-facility-test-001";
        var req = new UpsertFacilityRequest(
            "SafeSpace Bình Thạnh",
            "200 Điện Biên Phủ, Bình Thạnh, TP.HCM",
            "0901111222",
            "07:30",
            "21:30",
            "ACTIVE",
            10.8012m,
            106.7115m,
            opId
        );

        var result1 = await service.CreateFacilityAsync(req, f.OperatorUser.UserId);
        Assert.True(result1.Facility.FacilityId > 0);

        // Gửi lại cùng request (mất response hoặc retry mạng)
        var result2 = await service.CreateFacilityAsync(req, f.OperatorUser.UserId);

        // Phải trả về cùng FacilityId
        Assert.Equal(result1.Facility.FacilityId, result2.Facility.FacilityId);
        Assert.Equal(result1.Facility.Name, result2.Facility.Name);

        // Số bản ghi cơ sở và idempotency receipt trong DB chỉ là 1
        var facilityCount = await f.Db.Facilities.CountAsync(fac => fac.Name == "SafeSpace Bình Thạnh");
        Assert.Equal(1, facilityCount);

        var receiptCount = await f.Db.ActivityLogs.CountAsync(l => l.EntityType == "IDEMPOTENCY_FACILITY_CREATE" && l.Action == opId);
        Assert.Equal(1, receiptCount);
    }

    [Fact]
    public async Task T07_CreateFacility_WithSameOperationId_DifferentPayload_ThrowsOperationConflict()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var service = new OperationsService(f.Db);
        var opId = "op-facility-test-conflict";
        var req1 = new UpsertFacilityRequest(
            "SafeSpace Thủ Đức A",
            "1 Võ Văn Ngân, TP. Thủ Đức",
            "0903333444",
            "07:00",
            "22:00",
            "ACTIVE",
            10.8500m,
            106.7700m,
            opId
        );

        var result1 = await service.CreateFacilityAsync(req1, f.OperatorUser.UserId);
        Assert.True(result1.Facility.FacilityId > 0);

        // Gửi cùng OperationId nhưng khác payload (khác tên cơ sở)
        var req2 = new UpsertFacilityRequest(
            "SafeSpace Thủ Đức B",
            "1 Võ Văn Ngân, TP. Thủ Đức",
            "0903333444",
            "07:00",
            "22:00",
            "ACTIVE",
            10.8500m,
            106.7700m,
            opId
        );

        var ex = await Assert.ThrowsAsync<OperationConflictException>(() =>
            service.CreateFacilityAsync(req2, f.OperatorUser.UserId));

        Assert.Contains("Đã tồn tại yêu cầu tạo cơ sở với cùng OperationId nhưng nội dung yêu cầu khác nhau", ex.Message);
    }
}

