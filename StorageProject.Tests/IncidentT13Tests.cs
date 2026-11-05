using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>T13 · Sự cố do cơ sở (D32). SQLite trong bộ nhớ — chưa thay cho kiểm SQL Server / thiết bị cửa thật.</summary>
public sealed class IncidentT13Tests
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
    private static string Iso(DateTime utc) => utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Manager = null!, Customer = null!;
        public Facility Facility = null!;
        public UnitType Normal = null!, Cold = null!;
        public StorageUnit OldUnit = null!, Spare = null!, OtherType = null!;
        public RentalContract Contract = null!;
        public FacilityOpsService Ops => new(Db);
        public OpsActor ManagerActor => new(Manager.UserId, true);

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.Manager = new User { Username = "manager01", Email = "m@example.com", FullName = "Lê Quản Lý", PasswordHash = "x", Status = "ACTIVE" };
            f.Customer = new User { Username = "customer01", Email = "c@example.com", FullName = "Nguyễn Thị Mai", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "1 NLB", Status = "ACTIVE" };
            f.Normal = new UnitType { TypeName = "Kho thường L", Area = 30, ClimateControlled = false, Status = "ACTIVE" };
            f.Cold = new UnitType { TypeName = "Kho lạnh L", Area = 30, ClimateControlled = true, Status = "ACTIVE" };
            f.Db.AddRange(f.Manager, f.Customer, f.Facility, f.Normal, f.Cold);
            await f.Db.SaveChangesAsync();
            var managerRole = new Role { RoleName = "MANAGER", Description = "Manager" };
            f.Db.Roles.Add(managerRole);
            await f.Db.SaveChangesAsync();
            f.Db.UserRoles.Add(new UserRole { UserId = f.Manager.UserId, RoleId = managerRole.RoleId });
            f.Db.UserFacilities.Add(new UserFacility { UserId = f.Manager.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE",
                AssignedBy = f.Manager.UserId, AssignedFrom = TodayVn.AddDays(-30), CreatedAt = DateTime.UtcNow });

            f.OldUnit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId, UnitNumber = "K07", Status = "OCCUPIED" };
            f.Spare = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId, UnitNumber = "K08", Status = "AVAILABLE" };
            f.OtherType = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Cold.UnitTypeId, UnitNumber = "K11", Status = "AVAILABLE" };
            f.Db.StorageUnits.AddRange(f.OldUnit, f.Spare, f.OtherType);
            var start = TodayVn.AddMonths(-1);
            var reservation = new Reservation
            {
                CustomerId = f.Customer.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId, StartDate = start,
                ExpectedEndDate = start.AddMonths(3), RentalPeriodMonths = 3, EstimatedAmount = 3_450_000m, RequiredDeposit = 1_150_000m,
                QuotedMonthlyRate = 1_150_000m, Status = "UNIT_ASSIGNED", CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            f.Db.Reservations.Add(reservation);
            await f.Db.SaveChangesAsync();
            f.Contract = new RentalContract
            {
                ReservationId = reservation.ReservationId, CustomerId = f.Customer.UserId, UnitId = f.OldUnit.UnitId, StartDate = start,
                EndDate = start.AddMonths(3), AgreedMonthlyRate = 1_150_000m, DepositAmount = 1_150_000m, Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            f.Db.RentalContracts.Add(f.Contract);
            await f.Db.SaveChangesAsync();
            f.Db.AccessCredentials.AddRange(
                new AccessCredential { ContractId = f.Contract.ContractId, UnitId = f.OldUnit.UnitId, IssuedBy = f.Manager.UserId, CredentialType = "ACCESS_CODE", CredentialReference = "QR-1", IssuedAt = DateTime.UtcNow, Status = "ACTIVE" },
                new AccessCredential { ContractId = f.Contract.ContractId, UnitId = f.OldUnit.UnitId, IssuedBy = f.Manager.UserId, CredentialType = "ACCESS_CODE", CredentialReference = "PIN-1", IssuedAt = DateTime.UtcNow, Status = "ACTIVE" });
            await f.Db.SaveChangesAsync();
            f.Db.ChangeTracker.Clear();
            return f;
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    [Fact]
    public void Refund_IsCurrentMonth_PlusUnusedMonths_PlusFullDeposit()
    {
        // Ví dụ của FE: kỳ 01/08–01/12, ngày 29/10 → tháng 10 đang thuê, tháng 11 chưa dùng
        var r = IncidentRefundPolicy.Calculate(new DateOnly(2026, 8, 1), new DateOnly(2026, 12, 1), 1_150_000m, 1_150_000m, new DateOnly(2026, 10, 29));
        Assert.Equal(1_150_000m, r.CurrentMonthRent);
        Assert.Equal(1_150_000m, r.UnusedRent);
        Assert.Equal(3_450_000m, r.Total);
        // Trước ngày bắt đầu: chưa có tháng đang thuê, mọi tháng đều chưa dùng
        var before = IncidentRefundPolicy.Calculate(new DateOnly(2026, 11, 1), new DateOnly(2027, 1, 1), 1_000_000m, 1_000_000m, new DateOnly(2026, 10, 29));
        Assert.Equal(0m, before.CurrentMonthRent);
        Assert.Equal(2_000_000m, before.UnusedRent);
    }

    [Fact]
    public async Task Transfer_ReservesEquivalentUnit_CustomerChooses_ManagerCompletes_WithNewCodesAndSameTerms()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = Assert.Single((await f.Ops.GetIncidentsAsync(f.ManagerActor)).Items);
        Assert.Equal("DRAFT", draft.Status);
        Assert.Equal($"SC-{f.Contract.ContractId:0000}-1", draft.Id);
        Assert.Equal(1, draft.Version);
        var candidate = Assert.Single(draft.Candidates); // chỉ ô cùng loại + diện tích, trống
        Assert.Equal("K08", candidate.Code);

        var affectedAt = Iso(DateTime.UtcNow.AddHours(-2));
        var send = new IncidentActionRequest("SEND_INCIDENT_PROPOSAL", draft.Id, 1, "Thấm nước mái kho sau mưa lớn", affectedAt, true,
            "TRANSFER", candidate.Id, candidate.Version, [new EvidencePhotoUpload("tham-nuoc.jpg", "image/jpeg", Convert.ToBase64String(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }))]);
        var sent = (await f.Ops.SaveIncidentAsync(f.ManagerActor, send)).Incident;
        Assert.Equal("PROPOSED", sent.Status);
        Assert.Equal(draft.Id, sent.Id); // mã không đổi khi lưu lần đầu
        Assert.True(sent.Version > draft.Version);
        Assert.Equal(affectedAt, sent.AffectedAt);
        Assert.Equal("RESERVED", sent.TargetUnit!.Status);
        Assert.Equal(sent.Id, sent.TargetUnit.ReservedFor);
        Assert.Single(sent.Photos);
        await Assert.ThrowsAsync<OpsConflictException>(() => f.Ops.SaveIncidentAsync(f.ManagerActor, send)); // gửi lặp với phiên bản cũ

        // Khách chỉ thấy hồ sơ đã gửi của mình, tự chọn đổi ô
        var mine = Assert.Single((await f.Ops.GetCustomerIncidentsAsync(f.Customer.UserId)).Items);
        Assert.Empty((await f.Ops.GetCustomerIncidentsAsync(f.Manager.UserId)).Items);
        var contractCode = mine.ContractId;
        var chosen = (await f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, contractCode, new IncidentActionRequest(
            "CHOOSE_INCIDENT_OPTION", mine.Id, mine.Version, TargetUnitId: mine.TargetUnit!.Id, ExpectedTargetVersion: mine.TargetUnit.Version,
            Choice: "TRANSFER", Note: "Đồng ý chuyển"))).Incident;
        Assert.Equal("TRANSFER_PENDING", chosen.Status);
        Assert.Equal("Đồng ý chuyển", chosen.Choice!.Note);

        var done = (await f.Ops.CompleteIncidentTransferAsync(f.ManagerActor, chosen.Id, new IncidentActionRequest(
            "COMPLETE_INCIDENT_TRANSFER", chosen.Id, chosen.Version, Confirmed: true, TargetUnitId: chosen.TargetUnit!.Id,
            ExpectedTargetVersion: chosen.TargetUnit.Version, MovedAt: Iso(DateTime.UtcNow)))).Incident;
        Assert.Equal("TRANSFERRED", done.Status);
        Assert.Equal("K08", done.CurrentUnit);
        Assert.Equal("MAINTENANCE", done.OldUnitStatus);
        Assert.Equal(new IncidentAccessDto("INVALID", "ISSUED"), done.Access);
        Assert.Equal(0m, done.Surcharge);
        Assert.Equal(sent.StartDate, done.StartDate);
        Assert.Equal(sent.EndDate, done.EndDate);
        Assert.Equal(sent.MonthlyRate, done.MonthlyRate);
        Assert.Equal("ACTIVE", done.ContractStatus);

        var contract = await f.Db.RentalContracts.Include(c => c.AccessCredentials).SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal(f.Spare.UnitId, contract.UnitId);
        Assert.All(contract.AccessCredentials.Where(a => a.UnitId == f.OldUnit.UnitId), a => Assert.Equal("REPLACED", a.Status));
        Assert.Equal(2, contract.AccessCredentials.Count(a => a.UnitId == f.Spare.UnitId && a.Status == "ACTIVE"));
        Assert.Equal("MAINTENANCE", (await f.Db.StorageUnits.SingleAsync(u => u.UnitId == f.OldUnit.UnitId)).Status);
        Assert.Equal("OCCUPIED", (await f.Db.StorageUnits.SingleAsync(u => u.UnitId == f.Spare.UnitId)).Status);
    }

    [Fact]
    public async Task Terminate_RequiresOwnerBank_CreatesPendingRefund_ThenTransferIsRecordedOnce()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = Assert.Single((await f.Ops.GetIncidentsAsync(f.ManagerActor)).Items);
        var sent = (await f.Ops.SaveIncidentAsync(f.ManagerActor, new IncidentActionRequest("SEND_INCIDENT_PROPOSAL", draft.Id, 1,
            "Sập kệ trong kho", Iso(DateTime.UtcNow.AddHours(-1)), true, "TERMINATE"))).Incident;
        Assert.Null(sent.TargetUnit);

        var choose = new IncidentActionRequest("CHOOSE_INCIDENT_OPTION", sent.Id, sent.Version, Choice: "TERMINATE", Note: "",
            RefundBank: new RefundBankInput("Vietcombank", "0011223344", "TRAN VAN B"));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId, choose));
        var chosen = (await f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId,
            choose with { RefundBank = new RefundBankInput("Vietcombank", "0011223344", "NGUYEN THI MAI") })).Incident;
        Assert.Equal("TERMINATION_PENDING", chosen.Status);
        Assert.Equal("0011223344", chosen.RefundBank!.AccountNumber);

        var ended = (await f.Ops.FinalizeIncidentTerminationAsync(f.ManagerActor, chosen.Id,
            new IncidentActionRequest("FINALIZE_INCIDENT_TERMINATION", chosen.Id, chosen.Version, Confirmed: true))).Incident;
        Assert.Equal("TERMINATED", ended.Status);
        Assert.Equal("ENDED", ended.ContractStatus);
        Assert.Equal("PENDING", ended.Refund!.Status);
        Assert.Equal(ended.CurrentMonthRent + ended.UnusedRent + ended.Deposit, ended.Refund.Amount);
        Assert.Equal(new IncidentAccessDto("INVALID", "NONE"), ended.Access);

        var contract = await f.Db.RentalContracts.Include(c => c.AccessCredentials).SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal("TERMINATED", contract.Status);
        Assert.All(contract.AccessCredentials, a => Assert.Equal("REVOKED", a.Status));

        // Khoản hoàn hiện ở màn hoàn cọc với tài khoản khách khai khi chọn kết thúc; ghi chuyển tiền đúng một lần
        var item = Assert.Single(await f.Ops.GetDepositRefundsAsync(f.ManagerActor));
        Assert.Equal(ended.Refund.Id, item.Id);
        Assert.Equal("0011223344", item.AccountNumber);
        var paid = await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor,
            new DepositRefundActionRequest("CONFIRM_DEPOSIT_REFUND", item.Id, item.Version, "FT26302000777", DateTime.UtcNow, true));
        Assert.Equal("PAID", paid.Status);
        var reread = Assert.Single((await f.Ops.GetCustomerIncidentsAsync(f.Customer.UserId)).Items);
        Assert.Equal("PAID", reread.Refund!.Status);
        Assert.Equal("FT26302000777", reread.Refund.TransactionRef);
    }
}
