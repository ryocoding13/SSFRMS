using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// D56 (PLAN BOOK-01..04): Giữ đúng ô khách chọn khi đặt kho theo kỳ tương lai (EXACT vs AUTO).
/// </summary>
public sealed class SelectedUnitFutureBookingTests
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
        public User Customer1 = null!;
        public User Customer2 = null!;
        public Facility Facility = null!;
        public UnitType Type = null!;
        public StorageUnit K01 = null!;
        public StorageUnit K02 = null!;
        public StorageUnit K03 = null!;

        public async Task InitAsync()
        {
            await connection.OpenAsync();
            Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
            await Db.Database.EnsureCreatedAsync();

            Customer1 = new User { Username = "khach_exact_1", Email = "k1@storage.vn", PasswordHash = "x", FullName = "Nguyễn Văn Một", Status = "ACTIVE" };
            Customer2 = new User { Username = "khach_exact_2", Email = "k2@storage.vn", PasswordHash = "x", FullName = "Trần Thị Hai", Status = "ACTIVE" };
            Facility = new Facility { Name = "SafeSpace Tân Bình", Address = "123 Hoàng Hoa Thám", Status = "ACTIVE" };
            Type = new UnitType { TypeName = "Kho Tiêu Chuẩn M (2m x 2m)", Area = 15m, ClimateControlled = false, Status = "ACTIVE" };
            Db.AddRange(Customer1, Customer2, Facility, Type);
            await Db.SaveChangesAsync();

            K01 = new StorageUnit { FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, UnitNumber = "K01", Status = "AVAILABLE" };
            K02 = new StorageUnit { FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, UnitNumber = "K02", Status = "AVAILABLE" };
            K03 = new StorageUnit { FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, UnitNumber = "K03", Status = "AVAILABLE" };
            Db.AddRange(K01, K02, K03);

            // Bảng giá đang áp dụng
            Db.RentalRates.Add(new RentalRate
            {
                FacilityId = Facility.FacilityId,
                UnitTypeId = Type.UnitTypeId,
                SetBy = Customer1.UserId,
                CreatedAt = DateTime.UtcNow,
                MonthlyRate = 1_500_000m,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                Status = "ACTIVE"
            });

            // Chính sách ngày đệm RELET_BUFFER = 3 ngày
            Db.Policies.Add(new Policy
            {
                FacilityId = Facility.FacilityId,
                UnitTypeId = Type.UnitTypeId,
                PolicyName = "Ngày đệm cho thuê lại",
                PolicyType = "RELET_BUFFER",
                CalculationType = "FIXED",
                Value = 3m,
                Status = "ACTIVE",
                CreatedBy = Customer1.UserId,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                RuleDescription = "3 ngày đệm"
            });

            await Db.SaveChangesAsync();
        }

        public ValueTask DisposeAsync()
        {
            Db.Dispose();
            connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    [Fact]
    public async Task Auto_mode_without_selected_unit_picks_suitable_unit_and_marks_mode_AUTO()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new ReservationService(f.Db);

        var req = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            3,
            SelectedUnitId: null
        );

        var res = await service.CreateReservationAsync(f.Customer1.UserId, req);

        Assert.Equal("AUTO", res.AllocationMode);
        Assert.NotNull(res.ProposedUnitNumber);
        Assert.NotNull(res.ProposedUnitId);

        var detail = await service.GetReservationDetailAsync(f.Customer1.UserId, res.ReservationId);
        Assert.NotNull(detail);
        Assert.Equal("AUTO", detail.AllocationMode);
        Assert.Equal(res.ProposedUnitNumber, detail.ProposedUnitNumber);
        Assert.Equal(res.ProposedUnitId, detail.ProposedUnitId);
    }

    [Fact]
    public async Task Exact_mode_keeps_explicitly_selected_unit_even_if_not_first_priority()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new ReservationService(f.Db);

        // Khách chủ động chọn K03 (trong khi K01, K02 đều đang trống)
        var req = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            3,
            SelectedUnitId: f.K03.UnitId
        );

        var res = await service.CreateReservationAsync(f.Customer1.UserId, req);

        Assert.Equal("EXACT", res.AllocationMode);
        Assert.Equal("K03", res.ProposedUnitNumber);
        Assert.Equal(f.K03.UnitId, res.ProposedUnitId);

        var detail = await service.GetReservationDetailAsync(f.Customer1.UserId, res.ReservationId);
        Assert.NotNull(detail);
        Assert.Equal("EXACT", detail.AllocationMode);
        Assert.Equal("K03", detail.ProposedUnitNumber);
        Assert.Equal(f.K03.UnitId, detail.ProposedUnitId);
    }

    [Fact]
    public async Task Exact_mode_keeps_occupied_unit_when_booking_valid_future_period()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var today = OpsRules.TodayLocal;

        // K01 hiện đang có hợp đồng thuê, kết thúc vào ngày today + 10
        f.K01.Status = "OCCUPIED";
        var resPrior = new Reservation
        {
            CustomerId = f.Customer2.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = f.Type.UnitTypeId,
            StartDate = today.AddDays(-20),
            ExpectedEndDate = today.AddDays(10),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 1_500_000m,
            EstimatedAmount = 1_500_000m,
            RequiredDeposit = 1_500_000m,
            Status = "CONFIRMED",
            CreatedAt = DateTime.UtcNow
        };
        f.Db.Reservations.Add(resPrior);
        await f.Db.SaveChangesAsync();

        var contract = new RentalContract
        {
            ReservationId = resPrior.ReservationId,
            CustomerId = f.Customer2.UserId,
            UnitId = f.K01.UnitId,
            StartDate = today.AddDays(-20),
            EndDate = today.AddDays(10),
            AgreedMonthlyRate = 1_500_000m,
            DepositAmount = 1_500_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        f.Db.RentalContracts.Add(contract);
        await f.Db.SaveChangesAsync();

        var service = new ReservationService(f.Db);

        // Khách 1 đặt kho với kỳ tương lai: bắt đầu từ today + 15 (sau ngày kết thúc 10 + 3 ngày đệm = 13)
        // K02, K03 hiện đang trống hoàn toàn
        var req = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            today.AddDays(15),
            1,
            SelectedUnitId: f.K01.UnitId
        );

        var res = await service.CreateReservationAsync(f.Customer1.UserId, req);

        // Hệ thống phải giữ đúng K01 theo ý định của khách, tuyệt đối không hoán đổi sang K02 hay K03!
        Assert.Equal("EXACT", res.AllocationMode);
        Assert.Equal("K01", res.ProposedUnitNumber);
        Assert.Equal(f.K01.UnitId, res.ProposedUnitId);

        // Khi tiến trình cấp hợp đồng chạy sau thanh toán, đảm bảo vẫn cấp đúng K01
        var reservation = await f.Db.Reservations.SingleAsync(r => r.ReservationId == res.ReservationId);
        await ReservationSettlement.RecordAsync(f.Db, reservation, "PAYMENT_GATEWAY", "PAYOS:TEST-1", null, default);
        await f.Db.SaveChangesAsync();

        var provisionSuccess = await ContractProvisioning.EnsureAsync(f.Db, reservation, null, default);
        Assert.True(provisionSuccess);

        var createdContract = await f.Db.RentalContracts.Include(c => c.Unit).FirstOrDefaultAsync(c => c.ReservationId == reservation.ReservationId);
        Assert.NotNull(createdContract);
        Assert.Equal("K01", createdContract.Unit.UnitNumber);
    }

    [Fact]
    public async Task Exact_mode_rejects_when_selected_unit_conflicts_with_existing_period()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var today = OpsRules.TodayLocal;

        // K01 có hợp đồng kết thúc vào today + 10 (cộng 3 ngày đệm = trống từ today + 13)
        f.K01.Status = "OCCUPIED";
        var resPrior2 = new Reservation
        {
            CustomerId = f.Customer2.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = f.Type.UnitTypeId,
            StartDate = today.AddDays(-20),
            ExpectedEndDate = today.AddDays(10),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 1_500_000m,
            EstimatedAmount = 1_500_000m,
            RequiredDeposit = 1_500_000m,
            Status = "CONFIRMED",
            CreatedAt = DateTime.UtcNow
        };
        f.Db.Reservations.Add(resPrior2);
        await f.Db.SaveChangesAsync();

        f.Db.RentalContracts.Add(new RentalContract
        {
            ReservationId = resPrior2.ReservationId,
            CustomerId = f.Customer2.UserId,
            UnitId = f.K01.UnitId,
            StartDate = today.AddDays(-20),
            EndDate = today.AddDays(10),
            AgreedMonthlyRate = 1_500_000m,
            DepositAmount = 1_500_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        });
        await f.Db.SaveChangesAsync();

        var service = new ReservationService(f.Db);

        // Khách đặt bắt đầu từ today + 5 (chưa đến ngày trống lại)
        var req = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            today.AddDays(5),
            1,
            SelectedUnitId: f.K01.UnitId
        );

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateReservationAsync(f.Customer1.UserId, req));

        // Phải báo lỗi từ chối, không được tự động chuyển sang K02
        Assert.Contains("trùng kỳ", ex.Message);
    }

    [Fact]
    public async Task Two_customers_selecting_same_unit_exact_rejects_second_with_hold_conflict()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new ReservationService(f.Db);

        var req1 = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            2,
            SelectedUnitId: f.K01.UnitId
        );

        var req2 = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            2,
            SelectedUnitId: f.K01.UnitId
        );

        // Khách 1 giữ K01 thành công
        var res1 = await service.CreateReservationAsync(f.Customer1.UserId, req1);
        Assert.Equal("K01", res1.ProposedUnitNumber);

        // Khách 2 cùng chọn K01 cho cùng kỳ -> bị từ chối do K01 đang có đơn giữ chỗ
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateReservationAsync(f.Customer2.UserId, req2));

        Assert.Contains("vừa có người khác giữ chỗ", ex.Message);
    }

    [Fact]
    public async Task Provisioning_never_silently_reproposes_different_unit_for_EXACT_mode()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new ReservationService(f.Db);

        var req = new CreateReservationRequest(
            f.Facility.FacilityId,
            f.Type.UnitTypeId,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            1,
            SelectedUnitId: f.K01.UnitId
        );

        var res = await service.CreateReservationAsync(f.Customer1.UserId, req);
        Assert.Equal("EXACT", res.AllocationMode);
        Assert.Equal("K01", res.ProposedUnitNumber);

        // Mô phỏng sự cố bất ngờ trước khi cấp hợp đồng: K01 bị hỏng hóc nghiêm trọng chuyển sang OUT_OF_SERVICE
        f.K01.Status = "OUT_OF_SERVICE";
        await f.Db.SaveChangesAsync();

        var reservation = await f.Db.Reservations.SingleAsync(r => r.ReservationId == res.ReservationId);
        await ReservationSettlement.RecordAsync(f.Db, reservation, "PAYMENT_GATEWAY", "PAYOS:TEST-1", null, default);
        await f.Db.SaveChangesAsync();

        // Cấp hợp đồng: Vì mode EXACT nên KHÔNG ĐƯỢC tự ý cấp K02 hay K03; phải trả về false và ghi log AUTO_ALLOCATION_PENDING
        var provisionSuccess = await ContractProvisioning.EnsureAsync(f.Db, reservation, null, default);
        Assert.False(provisionSuccess);

        var autoPendingLog = await f.Db.ActivityLogs.AnyAsync(l => l.Action == "AUTO_ALLOCATION_PENDING" && l.EntityId == reservation.ReservationId);
        Assert.True(autoPendingLog);

        var reproposedLog = await f.Db.ActivityLogs.AnyAsync(l => l.Action == "UNIT_REPROPOSED" && l.EntityId == reservation.ReservationId);
        Assert.False(reproposedLog); // Tuyệt đối không tự hoán đổi ô khác!
    }
}
