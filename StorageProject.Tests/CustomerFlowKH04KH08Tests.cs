using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class CustomerFlowKH04KH08Tests
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
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Customer = null!, OtherCustomer = null!, Staff = null!, Manager = null!;
        public Facility Facility = null!;
        public StorageUnit Unit = null!;
        public static DateOnly TodayVn => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        public static async Task<Fixture> Create()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.Customer = new User { Username = "customer01", Email = "customer01@example.com", FullName = "Nguyễn Khách A", PasswordHash = "x", Status = "ACTIVE" };
            f.OtherCustomer = new User { Username = "customer02", Email = "customer02@example.com", FullName = "Trần Khách B", PasswordHash = "x", Status = "ACTIVE" };
            f.Staff = new User { Username = "staff01", Email = "staff01@example.com", FullName = "Nhân viên cơ sở", PasswordHash = "x", Status = "ACTIVE" };
            f.Manager = new User { Username = "manager01", Email = "manager01@example.com", FullName = "Quản lý cơ sở", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "123 Nguyễn Lương Bằng", Status = "ACTIVE" };
            var type = new UnitType { TypeName = "Kho thường 15m²", Area = 15, Status = "ACTIVE" };
            var staffRole = new Role { RoleName = "STAFF" };
            var managerRole = new Role { RoleName = "MANAGER" };
            var customerRole = new Role { RoleName = "CUSTOMER" };

            f.Db.AddRange(f.Customer, f.OtherCustomer, f.Staff, f.Manager, f.Facility, type, staffRole, managerRole, customerRole);
            await f.Db.SaveChangesAsync();

            f.Db.AddRange(
                new UserRole { UserId = f.Staff.UserId, RoleId = staffRole.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = f.Manager.UserId, RoleId = managerRole.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = f.Customer.UserId, RoleId = customerRole.RoleId, AssignedAt = DateTime.UtcNow },
                new UserFacility { UserId = f.Staff.UserId, FacilityId = f.Facility.FacilityId, AssignedBy = f.Manager.UserId, AssignedFrom = TodayVn.AddDays(-1), Status = "ACTIVE" },
                new UserFacility { UserId = f.Manager.UserId, FacilityId = f.Facility.FacilityId, AssignedBy = f.Manager.UserId, AssignedFrom = TodayVn.AddDays(-1), Status = "ACTIVE" }
            );
            f.Unit = new StorageUnit { UnitNumber = "K01", FacilityId = f.Facility.FacilityId, UnitTypeId = type.UnitTypeId, Status = "AVAILABLE" };
            f.Db.Add(f.Unit);
            await f.Db.SaveChangesAsync();

            EvidencePhotos.Configure("test-secret-at-least-thirty-two-characters-long", "http://localhost:5151");
            return f;
        }

        public async Task<RentalContract> CreateContract(DateOnly startDate, DateOnly endDate, string status = "ACTIVE")
        {
            var res = new Reservation
            {
                CustomerId = Customer.UserId,
                FacilityId = Facility.FacilityId,
                UnitTypeId = Unit.UnitTypeId,
                StartDate = startDate,
                ExpectedEndDate = endDate,
                QuotedMonthlyRate = 1200000,
                RequiredDeposit = 1200000,
                EstimatedAmount = 3600000,
                RentalPeriodMonths = 3,
                Status = "UNIT_ASSIGNED",
                CreatedAt = DateTime.UtcNow
            };
            Db.Reservations.Add(res);
            await Db.SaveChangesAsync();

            var c = new RentalContract
            {
                ReservationId = res.ReservationId,
                CustomerId = Customer.UserId,
                UnitId = Unit.UnitId,
                StartDate = startDate,
                EndDate = endDate,
                AgreedMonthlyRate = 1200000,
                DepositAmount = 1200000,
                Status = status,
                CreatedAt = DateTime.UtcNow
            };
            c.AccessCredentials.Add(new AccessCredential
            {
                UnitId = Unit.UnitId,
                IssuedBy = Staff.UserId,
                CredentialType = "ACCESS_CODE",
                CredentialReference = "QR-1",
                IssuedAt = DateTime.UtcNow,
                Status = "ACTIVE"
            });
            c.AccessCredentials.Add(new AccessCredential
            {
                UnitId = Unit.UnitId,
                IssuedBy = Staff.UserId,
                CredentialType = "ACCESS_CODE",
                CredentialReference = "PIN-1",
                IssuedAt = DateTime.UtcNow,
                Status = "ACTIVE"
            });
            Db.RentalContracts.Add(c);
            await Db.SaveChangesAsync();
            return c;
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    // =========================================================================
    // KH-04: C07 — QR/PIN TRƯỚC VÀ TRONG KỲ THUÊ
    // =========================================================================

    [Fact]
    public async Task C07_GetQr_BeforeStartDate_ThrowsInvalidOperationException()
    {
        await using var f = await Fixture.Create();
        var futureStart = Fixture.TodayVn.AddDays(3);
        var contract = await f.CreateContract(futureStart, futureStart.AddMonths(3));

        var accessService = new AccessService(f.Db, new AccessQrOptions("test-access-secret-at-least-thirty-two-characters"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            accessService.GetQrAsync(f.Customer.UserId, contract.ContractId));
        Assert.Contains("Mã ra vào chỉ hiển thị từ ngày bắt đầu thuê", ex.Message);
        Assert.Contains(futureStart.ToString("dd/MM/yyyy"), ex.Message);
    }

    [Fact]
    public async Task C07_GetQr_OnOrAfterStartDate_ReturnsQrAndPin()
    {
        await using var f = await Fixture.Create();
        var today = Fixture.TodayVn;
        var contract = await f.CreateContract(today, today.AddMonths(3));

        var accessService = new AccessService(f.Db, new AccessQrOptions("test-access-secret-at-least-thirty-two-characters"));
        var qrDto = await accessService.GetQrAsync(f.Customer.UserId, contract.ContractId);

        Assert.NotNull(qrDto);
        Assert.StartsWith("SSQR-", qrDto.Code);
        Assert.Matches(@"^\d{6}$", qrDto.BackupCode);
        Assert.Equal("K01", qrDto.UnitNumber);
        Assert.Equal(today.ToString("yyyy-MM-dd"), qrDto.ValidFrom);
    }

    [Fact]
    public async Task C07_GetQr_TerminatedOrCancelledContract_ThrowsInvalidOperationException()
    {
        await using var f = await Fixture.Create();
        var pastStart = Fixture.TodayVn.AddMonths(-1);
        var contract = await f.CreateContract(pastStart, pastStart.AddMonths(3), status: "TERMINATED");

        var accessService = new AccessService(f.Db, new AccessQrOptions("test-access-secret-at-least-thirty-two-characters"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            accessService.GetQrAsync(f.Customer.UserId, contract.ContractId));
        Assert.Contains("Hợp đồng đã trả kho hoặc hết hiệu lực", ex.Message);
    }

    // =========================================================================
    // KH-04: C06 — YÊU CẦU NHẬN CHÌA KHÓA THEO D36
    // =========================================================================

    [Fact]
    public async Task C06_RequestKey_CreatesScheduledHandoverRecord_AndStaffSeesIt()
    {
        await using var f = await Fixture.Create();
        var contract = await f.CreateContract(Fixture.TodayVn, Fixture.TodayVn.AddMonths(3));
        var contractService = new ContractService(f.Db);

        // Khách hàng gửi yêu cầu nhận chìa khóa
        var handover = await contractService.RequestKeyAsync(f.Customer.UserId, contract.ContractId,
            new KeyRequestInput(DateTime.UtcNow.AddHours(2), "Tôi sẽ đến quầy lúc 10h sáng"));

        Assert.NotNull(handover);
        Assert.Equal("SCHEDULED", handover.Status);
        Assert.True(handover.HandoverId > 0);

        // Kiểm tra Staff board nhìn thấy hồ sơ nhận chìa khóa
        var opsService = new FacilityOpsService(f.Db);
        var staffActor = new OpsActor(f.Staff.UserId, false);
        var board = await opsService.GetBoardAsync(staffActor);

        var task = Assert.Single(board.Handovers);
        Assert.Equal("WAITING", task.Status);
        Assert.Equal("K01", task.Unit);
        Assert.Equal(f.Customer.FullName, task.Customer);
    }

    [Fact]
    public async Task C06_RequestKey_IdempotentRetry_ReturnsExistingHandover()
    {
        await using var f = await Fixture.Create();
        var contract = await f.CreateContract(Fixture.TodayVn, Fixture.TodayVn.AddMonths(3));
        var contractService = new ContractService(f.Db);

        var first = await contractService.RequestKeyAsync(f.Customer.UserId, contract.ContractId);
        var retry = await contractService.RequestKeyAsync(f.Customer.UserId, contract.ContractId);

        Assert.Equal(first.HandoverId, retry.HandoverId);
        Assert.Equal("SCHEDULED", retry.Status);
        Assert.Single(await f.Db.HandoverRecords.Where(h => h.ContractId == contract.ContractId).ToListAsync());
    }

    [Fact]
    public async Task C06_RequestKey_AlreadyHandedOver_ThrowsInvalidOperationException()
    {
        await using var f = await Fixture.Create();
        var contract = await f.CreateContract(Fixture.TodayVn, Fixture.TodayVn.AddMonths(3));
        contract.HandoverRecord = new HandoverRecord
        {
            ContractId = contract.ContractId,
            StaffId = f.Staff.UserId,
            Status = "HANDED_OVER",
            HandoverAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        await f.Db.SaveChangesAsync();

        var contractService = new ContractService(f.Db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            contractService.RequestKeyAsync(f.Customer.UserId, contract.ContractId));
        Assert.Contains("đã nhận chìa khóa vật lý", ex.Message);
    }

    [Fact]
    public async Task C06_RequestKey_WrongCustomer_ThrowsKeyNotFoundException()
    {
        await using var f = await Fixture.Create();
        var contract = await f.CreateContract(Fixture.TodayVn, Fixture.TodayVn.AddMonths(3));
        var contractService = new ContractService(f.Db);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            contractService.RequestKeyAsync(f.OtherCustomer.UserId, contract.ContractId));
    }

    // =========================================================================
    // KH-08: C16 — HỖ TRỢ GẮN KHO KIỂM KỲ THUÊ (D36 / L14)
    // =========================================================================

    [Fact]
    public async Task C16_CreateTicket_BeforeStartDate_ThrowsInvalidOperationException()
    {
        await using var f = await Fixture.Create();
        var futureStart = Fixture.TodayVn.AddDays(5);
        var contract = await f.CreateContract(futureStart, futureStart.AddMonths(3));
        var ticketService = new SupportTicketService(f.Db);

        var request = new CreateTicketRequest(contract.ContractId, f.Unit.UnitId, "ACCESS", "Xin cấp lại mã", "Cần mã", "NORMAL");
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ticketService.CreateTicketAsync(f.Customer.UserId, request));
        Assert.Contains("chưa đến ngày bắt đầu", ex.Message);
        Assert.Contains("hỗ trợ chung", ex.Message);
    }

    [Fact]
    public async Task C16_CreateTicket_AfterEndDateWithoutOverdue_ThrowsInvalidOperationException()
    {
        await using var f = await Fixture.Create();
        var pastStart = Fixture.TodayVn.AddMonths(-3);
        var pastEnd = Fixture.TodayVn.AddDays(-2);
        var contract = await f.CreateContract(pastStart, pastEnd, status: "COMPLETED");
        var ticketService = new SupportTicketService(f.Db);

        var request = new CreateTicketRequest(contract.ContractId, f.Unit.UnitId, "UNIT", "Hỏi thăm kho cũ", "Kho cũ", "NORMAL");
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ticketService.CreateTicketAsync(f.Customer.UserId, request));
        Assert.Contains("Hợp đồng đã kết thúc", ex.Message);
        Assert.Contains("hỗ trợ chung", ex.Message);
    }

    [Fact]
    public async Task C16_CreateTicket_WithinRentalPeriod_OrOverdue_Succeeds()
    {
        await using var f = await Fixture.Create();
        var pastStart = Fixture.TodayVn.AddMonths(-1);
        var futureEnd = Fixture.TodayVn.AddMonths(2);
        var contract = await f.CreateContract(pastStart, futureEnd, status: "ACTIVE");
        var ticketService = new SupportTicketService(f.Db);

        var request = new CreateTicketRequest(contract.ContractId, f.Unit.UnitId, "ACCESS", "Quên mã PIN", "Xin đặt lại mã PIN", "NORMAL");
        var ticket = await ticketService.CreateTicketAsync(f.Customer.UserId, request);

        Assert.NotNull(ticket);
        Assert.Equal("OPEN", ticket.Status);
        Assert.Equal(contract.ContractId, ticket.ContractId);
        Assert.Equal("ACCESS_CARD", ticket.IssueType);
    }

    // =========================================================================
    // KH-08: C17 — ẢNH BẰNG CHỨNG HỖ TRỢ THỰC (D35)
    // =========================================================================

    [Fact]
    public async Task C17_CreateTicket_WithEvidencePhotos_SavesAndReturnsSignedUrls()
    {
        await using var f = await Fixture.Create();
        var contract = await f.CreateContract(Fixture.TodayVn.AddDays(-5), Fixture.TodayVn.AddMonths(2));
        var ticketService = new SupportTicketService(f.Db);

        // 1x1 PNG hợp lệ base64
        const string pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        var photos = new List<EvidencePhotoUpload>
        {
            new("cua-kho-ket.png", "image/png", pngBase64),
            new("khoa-bi-lech.png", "image/png", $"data:image/png;base64,{pngBase64}")
        };

        var request = new CreateTicketRequest(
            contract.ContractId,
            f.Unit.UnitId,
            "LOCK",
            "Khóa bị kẹt không mở được",
            "Đã thử 3 lần không mở được khóa, gửi kèm ảnh hiện trạng",
            "HIGH",
            photos
        );

        var created = await ticketService.CreateTicketAsync(f.Customer.UserId, request);
        Assert.NotNull(created);

        // Đọc lại chi tiết ticket: phải có Signed URLs
        var detail = await ticketService.GetTicketDetailAsync(f.Customer.UserId, created.TicketId);
        Assert.NotNull(detail);
        Assert.NotNull(detail.Photos);
        Assert.Equal(2, detail.Photos.Count);
        Assert.All(detail.Photos, p =>
        {
            Assert.Contains("/api/evidence-photos/", p.Url);
            Assert.Contains("?exp=", p.Url);
            Assert.Contains("&sig=", p.Url);
        });

        // Nhân viên xem board cũng đọc được danh sách ảnh ký HMAC (D35)
        var opsService = new FacilityOpsService(f.Db);
        var staffActor = new OpsActor(f.Staff.UserId, false);
        var board = await opsService.GetBoardAsync(staffActor);

        var opsTicket = Assert.Single(board.Tickets);
        Assert.NotNull(opsTicket.Photos);
        Assert.Equal(2, opsTicket.Photos.Count);
        Assert.All(opsTicket.Photos, p =>
        {
            Assert.Contains("/api/evidence-photos/", p.Url);
            Assert.Contains("?exp=", p.Url);
            Assert.Contains("&sig=", p.Url);
        });
    }
}
