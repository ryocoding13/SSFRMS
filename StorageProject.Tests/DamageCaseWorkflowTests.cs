using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// M02 · Luồng phản hồi và tự khắc phục hư hỏng (B10 / D32 / D34).
/// </summary>
public sealed class DamageCaseWorkflowTests
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
    private static string ContractCode(RentalContract c) => $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Manager = null!, Staff = null!, Customer = null!, OtherCustomer = null!;
        public Facility Facility = null!;
        public UnitType Normal = null!;
        public StorageUnit Unit = null!;
        public RentalContract Contract = null!;
        public ReturnInspection Inspection = null!;
        public FacilityOpsService Ops => new(Db);
        public OpsActor ManagerActor => new(Manager.UserId, true);

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.Manager = new User { Username = "manager01", Email = "m@example.com", FullName = "Lê Quản Lý", PasswordHash = "x", Status = "ACTIVE" };
            f.Staff = new User { Username = "staff01", Email = "s@example.com", FullName = "Trần Văn Long", PasswordHash = "x", Status = "ACTIVE" };
            f.Customer = new User { Username = "customer01", Email = "c@example.com", FullName = "Nguyễn Văn An", PasswordHash = "x", Status = "ACTIVE" };
            f.OtherCustomer = new User { Username = "customer02", Email = "c2@example.com", FullName = "Lê Thị Lan", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "1 NLB", Status = "ACTIVE" };
            f.Normal = new UnitType { TypeName = "Kho thường L", Area = 30, ClimateControlled = false, Status = "ACTIVE" };

            f.Db.AddRange(f.Manager, f.Staff, f.Customer, f.OtherCustomer, f.Facility, f.Normal);
            await f.Db.SaveChangesAsync();

            var managerRole = new Role { RoleName = "MANAGER", Description = "Manager" };
            var staffRole = new Role { RoleName = "STAFF", Description = "Staff" };
            var customerRole = new Role { RoleName = "CUSTOMER", Description = "Customer" };
            f.Db.Roles.AddRange(managerRole, staffRole, customerRole);
            await f.Db.SaveChangesAsync();

            f.Db.UserRoles.Add(new UserRole { UserId = f.Manager.UserId, RoleId = managerRole.RoleId });
            f.Db.UserRoles.Add(new UserRole { UserId = f.Staff.UserId, RoleId = staffRole.RoleId });
            f.Db.UserRoles.Add(new UserRole { UserId = f.Customer.UserId, RoleId = customerRole.RoleId });
            f.Db.UserRoles.Add(new UserRole { UserId = f.OtherCustomer.UserId, RoleId = customerRole.RoleId });

            f.Db.UserFacilities.Add(new UserFacility {
                UserId = f.Manager.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE",
                AssignedBy = f.Manager.UserId, AssignedFrom = TodayVn.AddDays(-30), CreatedAt = DateTime.UtcNow });
            f.Db.UserFacilities.Add(new UserFacility {
                UserId = f.Staff.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE",
                AssignedBy = f.Manager.UserId, AssignedFrom = TodayVn.AddDays(-30), CreatedAt = DateTime.UtcNow });

            f.Unit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId, UnitNumber = "B-015", Status = "OCCUPIED" };
            f.Db.StorageUnits.Add(f.Unit);

            var inspectCreated = DateTime.UtcNow.AddDays(-1);
            var end = DateOnly.FromDateTime(inspectCreated.AddHours(7)); // Trả đúng ngày kết thúc hợp đồng
            var start = end.AddMonths(-1);

            f.Db.Policies.Add(new Policy { PolicyType = "OVERDUE", PolicyName = "Phí quá hạn", CalculationType = "DEPOSIT_PERCENT_PER_DAY", Value = 5, Status = "ACTIVE", EffectiveFrom = TodayVn.AddMonths(-3), CreatedBy = f.Manager.UserId, RuleDescription = "5% cọc/ngày", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            var reservation = new Reservation
            {
                CustomerId = f.Customer.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId,
                RentalPeriodMonths = 1, StartDate = start, ExpectedEndDate = end, Status = "CHECKED_IN", CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            f.Db.Reservations.Add(reservation);
            await f.Db.SaveChangesAsync();

            f.Contract = new RentalContract
            {
                ReservationId = reservation.ReservationId, CustomerId = f.Customer.UserId, UnitId = f.Unit.UnitId,
                StartDate = start, EndDate = end, AgreedMonthlyRate = 1150000, DepositAmount = 1150000,
                Status = "RETURN_PENDING", CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            f.Db.RentalContracts.Add(f.Contract);
            await f.Db.SaveChangesAsync();

            // Seed RENT payment paid
            f.Db.Payments.Add(new Payment
            {
                ContractId = f.Contract.ContractId, PaymentType = "RENT", Amount = 1150000,
                Currency = "VND", PaymentMethod = "BANK_TRANSFER", Status = "PAID",
                CreatedAt = DateTime.UtcNow.AddMonths(-1), UpdatedAt = DateTime.UtcNow.AddMonths(-1)
            });

            // Seed ReturnInspection with Damage
            f.Inspection = new ReturnInspection
            {
                ContractId = f.Contract.ContractId,
                StaffId = f.Staff.UserId,
                Status = "COMPLETED",
                DamageFee = 200000,
                DamageItem = "Cửa kho cong bản lề",
                FeeReason = "Cửa kho bị móp do va chạm",
                CleaningRequired = false,
                CleaningFee = 0,
                ConditionStatus = "DAMAGED",
                CreatedAt = inspectCreated,
                InspectedAt = DateTime.UtcNow.AddHours(-10)
            };
            f.Db.ReturnInspections.Add(f.Inspection);
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
    public async Task InitialDamageCase_IsAwaitingResponse_AndUnresolved_AndBlocksRefund()
    {
        await using var f = await Fixture.CreateAsync();

        // Customer sees own damage case
        var customerCases = await f.Ops.GetCustomerDamageCasesAsync(f.Customer.UserId);
        Assert.Single(customerCases.Items);
        var cCase = customerCases.Items[0];
        Assert.Equal("HH-0001", cCase.Id);
        Assert.Equal(f.Customer.UserId, cCase.OwnerId);
        Assert.Equal("AWAITING_RESPONSE", cCase.Status);
        Assert.Equal(1, cCase.Version);
        Assert.Equal(200000m, cCase.DamageAmount);
        Assert.Equal(200000m, cCase.DamageDeduction);
        Assert.Equal("OPEN", cCase.SettlementStatus);

        // Other customer sees nothing
        var otherCases = await f.Ops.GetCustomerDamageCasesAsync(f.OtherCustomer.UserId);
        Assert.Empty(otherCases.Items);

        // Manager sees damage case in facility
        var managerCases = await f.Ops.GetDamageCasesAsync(f.ManagerActor);
        Assert.Single(managerCases.Items);

        // Check Board: damageWorkflowResolved must be FALSE
        var board = await f.Ops.GetBoardAsync(f.ManagerActor);
        var returnDto = Assert.Single(board.Returns);
        Assert.False(returnDto.DamageWorkflowResolved);

        // ConfirmRefundAsync must be BLOCKED
        var code = ContractCode(f.Contract);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.ConfirmRefundAsync(f.ManagerActor, code));
        Assert.Contains("hư hỏng chưa hoàn tất", ex.Message);
    }

    [Fact]
    public async Task CustomerAgree_TransitionsToCustomerAccepted_AndResolvesWorkflow()
    {
        await using var f = await Fixture.CreateAsync();

        var request = new DamageCaseActionRequest(
            Action: "RESPOND_DAMAGE",
            Id: "HH-0001",
            ExpectedVersion: 1,
            Choice: "AGREE",
            Note: "Tôi đồng ý trừ cọc"
        );

        var result = await f.Ops.HandleCustomerDamageActionAsync(f.Customer.UserId, request);
        Assert.Equal("CUSTOMER_ACCEPTED", result.Case.Status);
        Assert.Equal(2, result.Case.Version);
        Assert.Equal(200000m, result.Case.DamageDeduction);

        // Stale expectedVersion throws OpsConflictException
        var staleReq = new DamageCaseActionRequest(
            Action: "RESPOND_DAMAGE",
            Id: "HH-0001",
            ExpectedVersion: 1,
            Choice: "AGREE"
        );
        await Assert.ThrowsAsync<OpsConflictException>(() =>
            f.Ops.HandleCustomerDamageActionAsync(f.Customer.UserId, staleReq));

        // Workflow is now resolved on Board
        var board = await f.Ops.GetBoardAsync(f.ManagerActor);
        var returnDto = Assert.Single(board.Returns);
        Assert.True(returnDto.DamageWorkflowResolved);

        // Confirm refund succeeds and deducts 200,000 damage fee
        var code = ContractCode(f.Contract);
        var settlement = await f.Ops.ConfirmRefundAsync(f.ManagerActor, code);
        Assert.Equal(950000m, settlement.Refund); // 1,150,000 - 200,000 = 950,000
    }

    [Fact]
    public async Task FullRemediationWorkflow_Pass_WaivesDamageFee_AndCompletesRefund()
    {
        await using var f = await Fixture.CreateAsync();

        // 1. Khách đề nghị tự khắc phục (REMEDIATE)
        var respReq = new DamageCaseActionRequest(
            Action: "RESPOND_DAMAGE",
            Id: "HH-0001",
            ExpectedVersion: 1,
            Choice: "REMEDIATE",
            Note: "Tôi sẽ tự mua bản lề và gắn lại"
        );
        var r1 = await f.Ops.HandleCustomerDamageActionAsync(f.Customer.UserId, respReq);
        Assert.Equal("RESPONSE_SUBMITTED", r1.Case.Status);
        Assert.Equal(2, r1.Case.Version);

        // 2. Quản lý đồng ý cho khắc phục (ALLOW) với hạn ở tương lai
        var futureDeadline = DateTime.UtcNow.AddDays(2).ToString("O");
        var allowReq = new DamageCaseActionRequest(
            Action: "DECIDE_DAMAGE_RESPONSE",
            Id: "HH-0001",
            ExpectedVersion: 2,
            Decision: "ALLOW",
            Deadline: futureDeadline,
            Note: "Đồng ý cho tự sửa chữa"
        );
        var r2 = await f.Ops.HandleDamageActionAsync(f.ManagerActor, allowReq);
        Assert.Equal("REMEDIATION_ALLOWED", r2.Case.Status);
        Assert.Equal(3, r2.Case.Version);

        // 3. Khách báo đã khắc phục xong (REPORT_DAMAGE_REMEDIATION)
        var repReq = new DamageCaseActionRequest(
            Action: "REPORT_DAMAGE_REMEDIATION",
            Id: "HH-0001",
            ExpectedVersion: 3,
            Note: "Đã thay xong bản lề mới chuẩn hãng"
        );
        var r3 = await f.Ops.HandleCustomerDamageActionAsync(f.Customer.UserId, repReq);
        Assert.Equal("AWAITING_INSPECTION", r3.Case.Status);
        Assert.Equal(4, r3.Case.Version);

        // 4. Quản lý kiểm tra đạt (INSPECT_DAMAGE_REMEDIATION PASS)
        var inspReq = new DamageCaseActionRequest(
            Action: "INSPECT_DAMAGE_REMEDIATION",
            Id: "HH-0001",
            ExpectedVersion: 4,
            Result: "PASS",
            Note: "Bản lề mới chắc chắn, nghiệm thu đạt"
        );
        var r4 = await f.Ops.HandleDamageActionAsync(f.ManagerActor, inspReq);
        Assert.Equal("REMEDIATED", r4.Case.Status);
        Assert.Equal(5, r4.Case.Version);
        Assert.Equal(0m, r4.Case.DamageDeduction); // Bỏ khấu trừ hư hỏng!
        Assert.Equal(200000m, r4.Case.DamageAmount); // Giữ số tiền ban đầu để đối soát

        // Board resolved == true
        var board = await f.Ops.GetBoardAsync(f.ManagerActor);
        Assert.True(board.Returns[0].DamageWorkflowResolved);

        // Confirm refund: hoàn đủ 100% cọc (1,150,000 đ) vì hư hỏng đã được khắc phục đạt!
        var code = ContractCode(f.Contract);
        var settlement = await f.Ops.ConfirmRefundAsync(f.ManagerActor, code);
        Assert.Equal(1150000m, settlement.Refund);
    }
}
