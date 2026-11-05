using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// M05 · Luồng báo cáo và xử lý sai lệch đối soát thanh toán (Backlog đối soát / S09 / M05).
/// </summary>
public sealed class DiscrepancyWorkflowTests
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

    private static DateOnly TodayVn => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Manager = null!, Staff = null!, Customer = null!;
        public Facility Facility = null!;
        public UnitType Normal = null!;
        public StorageUnit Unit = null!;
        public Reservation Reservation = null!;
        public FacilityOpsService Ops => new(Db);
        public OpsActor ManagerActor => new(Manager.UserId, true);
        public OpsActor StaffActor => new(Staff.UserId, false);

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.Manager = new User { Username = "manager01", Email = "m@example.com", FullName = "Lê Quản Lý", PasswordHash = "x", Status = "ACTIVE" };
            f.Staff = new User { Username = "staff01", Email = "s@example.com", FullName = "Trần Văn Long", PasswordHash = "x", Status = "ACTIVE" };
            f.Customer = new User { Username = "customer01", Email = "c@example.com", FullName = "Nguyễn Văn An", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "1 NLB", Status = "ACTIVE" };
            f.Normal = new UnitType { TypeName = "Kho thường L", Area = 30, ClimateControlled = false, Status = "ACTIVE" };

            f.Db.AddRange(f.Manager, f.Staff, f.Customer, f.Facility, f.Normal);
            await f.Db.SaveChangesAsync();

            var managerRole = new Role { RoleName = "MANAGER", Description = "Quản lý cơ sở" };
            var staffRole = new Role { RoleName = "STAFF", Description = "Nhân viên cơ sở" };
            f.Db.Roles.AddRange(managerRole, staffRole);
            await f.Db.SaveChangesAsync();

            f.Db.UserRoles.AddRange(
                new UserRole { UserId = f.Manager.UserId, RoleId = managerRole.RoleId },
                new UserRole { UserId = f.Staff.UserId, RoleId = staffRole.RoleId }
            );

            var today = TodayVn;
            f.Db.UserFacilities.AddRange(
                new UserFacility { UserId = f.Manager.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE", AssignedBy = f.Manager.UserId, AssignedFrom = today.AddDays(-30) },
                new UserFacility { UserId = f.Staff.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE", AssignedBy = f.Manager.UserId, AssignedFrom = today.AddDays(-30) }
            );

            f.Unit = new StorageUnit
            {
                FacilityId = f.Facility.FacilityId,
                UnitTypeId = f.Normal.UnitTypeId,
                UnitNumber = "A-101",
                Status = "AVAILABLE"
            };
            f.Db.StorageUnits.Add(f.Unit);
            await f.Db.SaveChangesAsync();

            f.Reservation = new Reservation
            {
                CustomerId = f.Customer.UserId,
                FacilityId = f.Facility.FacilityId,
                UnitTypeId = f.Normal.UnitTypeId,
                RentalPeriodMonths = 1,
                StartDate = today.AddDays(1),
                ExpectedEndDate = today.AddDays(31),
                EstimatedAmount = 1_500_000m,
                RequiredDeposit = 500_000m,
                PaymentMethod = "BANK_TRANSFER",
                Status = "PENDING_VERIFICATION",
                CreatedAt = DateTime.UtcNow
            };
            f.Db.Reservations.Add(f.Reservation);
            await f.Db.SaveChangesAsync();

            return f;
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    [Fact]
    public async Task Staff_Reports_Discrepancy_And_Manager_Sees_It()
    {
        await using var f = await Fixture.CreateAsync();

        var refCode = $"SS-{f.Reservation.CreatedAt.Year}-{f.Reservation.ReservationId:0000}";
        var report = await f.Ops.HandleDiscrepancyActionAsync(f.StaffActor, new DiscrepancyActionRequest(
            Action: "REPORT_DISCREPANCY",
            Reference: refCode,
            Expected: 2_000_000m,
            Actual: 1_500_000m,
            Note: "Khách chuyển thiếu 500.000đ tiền cọc"
        ));

        Assert.NotNull(report);
        Assert.StartsWith("SL-", report.Id);
        Assert.Equal("PENDING", report.Status);
        Assert.Equal(2_000_000m, report.Expected);
        Assert.Equal(1_500_000m, report.Actual);

        // Quản lý và nhân viên tải danh sách sai lệch cơ sở
        var list = await f.Ops.GetDiscrepanciesAsync(f.ManagerActor);
        Assert.Single(list);
        Assert.Equal(report.Id, list[0].Id);
        Assert.Equal("PENDING", list[0].Status);
        Assert.Equal("Nguyễn Văn An", list[0].Customer);
    }

    [Fact]
    public async Task Manager_Resolves_Discrepancy_Successfully_And_Cannot_Resolve_Twice()
    {
        await using var f = await Fixture.CreateAsync();

        var refCode = $"SS-{f.Reservation.CreatedAt.Year}-{f.Reservation.ReservationId:0000}";
        var report = await f.Ops.HandleDiscrepancyActionAsync(f.StaffActor, new DiscrepancyActionRequest(
            Action: "REPORT_DISCREPANCY",
            Reference: refCode,
            Expected: 2_000_000m,
            Actual: 1_500_000m,
            Note: "Khách chuyển thiếu 500k"
        ));

        // Nhân viên không được giải quyết sai lệch (chỉ quản lý)
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            f.Ops.HandleDiscrepancyActionAsync(f.StaffActor, new DiscrepancyActionRequest(
                Action: "RESOLVE_DISCREPANCY",
                Id: report.Id,
                Note: "Nhân viên tự giải quyết"
            )));

        // Quản lý giải quyết nhưng thiếu ghi chú kết luận
        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Ops.HandleDiscrepancyActionAsync(f.ManagerActor, new DiscrepancyActionRequest(
                Action: "RESOLVE_DISCREPANCY",
                Id: report.Id,
                Note: "   "
            )));

        // Quản lý giải quyết hợp lệ
        var resolved = await f.Ops.HandleDiscrepancyActionAsync(f.ManagerActor, new DiscrepancyActionRequest(
            Action: "RESOLVE_DISCREPANCY",
            Id: report.Id,
            Note: "Khách đã nộp bù 500k tại quầy, cho phép xác nhận."
        ));

        Assert.Equal("RESOLVED", resolved.Status);
        Assert.Equal("Khách đã nộp bù 500k tại quầy, cho phép xác nhận.", resolved.Resolution);
        Assert.NotNull(resolved.ResolvedAt);

        // Giải quyết lần 2 bị chặn (lũy đẳng / conflict)
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.HandleDiscrepancyActionAsync(f.ManagerActor, new DiscrepancyActionRequest(
                Action: "RESOLVE_DISCREPANCY",
                Id: report.Id,
                Note: "Giải quyết lại lần 2"
            )));
        Assert.Contains("Báo cáo đã được xử lý", ex.Message);
    }

    [Fact]
    public async Task Resolving_Discrepancy_Resets_Payment_Mismatch_Status_On_Board()
    {
        await using var f = await Fixture.CreateAsync();

        var refCode = $"SS-{f.Reservation.CreatedAt.Year}-{f.Reservation.ReservationId:0000}";
        
        // 1. Staff báo sai lệch
        var report = await f.Ops.HandleDiscrepancyActionAsync(f.StaffActor, new DiscrepancyActionRequest(
            Action: "REPORT_DISCREPANCY",
            Reference: refCode,
            Expected: 2_000_000m,
            Actual: 1_000_000m,
            Note: "Nội dung chuyển khoản thiếu mã"
        ));

        // Trên board, thanh toán của đơn đặt chỗ này chuyển sang trạng thái MISMATCH
        var boardAfterMismatch = await f.Ops.GetBoardAsync(f.StaffActor);
        var paymentOnBoard = boardAfterMismatch.Payments.FirstOrDefault(p => p.Id == refCode || p.Customer == f.Customer.FullName);
        Assert.NotNull(paymentOnBoard);
        Assert.Equal("MISMATCH", paymentOnBoard.Status);

        // 2. Manager giải quyết sai lệch
        await f.Ops.HandleDiscrepancyActionAsync(f.ManagerActor, new DiscrepancyActionRequest(
            Action: "RESOLVE_DISCREPANCY",
            Id: report.Id,
            Note: "Quản lý đã đối soát xong, thông tin khớp."
        ));

        // 3. Sau khi giải quyết, trạng thái thanh toán trên board trở về PENDING
        var boardAfterResolved = await f.Ops.GetBoardAsync(f.StaffActor);
        var paymentAfterResolved = boardAfterResolved.Payments.FirstOrDefault(p => p.Id == refCode || p.Customer == f.Customer.FullName);
        Assert.NotNull(paymentAfterResolved);
        Assert.Equal("PENDING", paymentAfterResolved.Status);
    }
}
