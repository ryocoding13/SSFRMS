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
    public async Task C07_GetQr_BeforeStartDate_ShowsCodesButNotUsableUntilMidnight()
    {
        // #59 (thay L13): khách xem được QR/PIN trước ngày thuê, chỉ mở cửa từ 00:00 ngày bắt đầu.
        await using var f = await Fixture.Create();
        var futureStart = Fixture.TodayVn.AddDays(3);
        var contract = await f.CreateContract(futureStart, futureStart.AddMonths(3));

        var accessService = new AccessService(f.Db, new AccessQrOptions("test-access-secret-at-least-thirty-two-characters"));

        var qr = await accessService.GetQrAsync(f.Customer.UserId, contract.ContractId);
        Assert.False(qr.UsableNow);
        Assert.Equal(futureStart.ToString("yyyy-MM-dd") + "T00:00:00", qr.UsableFrom);
        var scan = await accessService.ScanAsync(qr.Code, "test");
        Assert.Equal("DENIED", scan.Result);
        Assert.Equal($"Chưa đến ngày sử dụng. Có thể mở cửa từ 00:00 ngày {futureStart:dd/MM/yyyy}.", scan.Reason);
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
        Assert.Matches(@"^[1-9]{6}$", qrDto.BackupCode); // D51: PIN chỉ số 1–9
        Assert.True(qrDto.UsableNow);
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
    // KH-08: C16 — HỖ TRỢ GẮN KHO KIỂM KỲ THUÊ (D36 / L14)
    // =========================================================================

    [Fact]
    public async Task C16_CreateTicket_BeforeStartDate_SucceedsUnderD40_AndDraftThrows()
    {
        await using var f = await Fixture.Create();
        var futureStart = Fixture.TodayVn.AddDays(5);
        var contract = await f.CreateContract(futureStart, futureStart.AddMonths(3));
        var ticketService = new SupportTicketService(f.Db);

        // L14 theo D40: hợp đồng đã thanh toán trước ngày bắt đầu được gửi hỗ trợ (ví dụ nhận chìa khóa, chuẩn bị dọn vào)
        var request = new CreateTicketRequest(contract.ContractId, f.Unit.UnitId, "ACCESS", "Xin hỗ trợ kho", "Chuẩn bị dọn vào", "NORMAL");
        var result = await ticketService.CreateTicketAsync(f.Customer.UserId, request);
        Assert.NotNull(result);
        Assert.Equal("OPEN", result.Status);

        // Hợp đồng chưa thanh toán (DRAFT) thì từ chối và hướng dẫn sang hỗ trợ chung
        contract.Status = "DRAFT";
        await f.Db.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ticketService.CreateTicketAsync(f.Customer.UserId, request));
        Assert.Contains("chưa thanh toán", ex.Message);
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

    // =========================================================================
    // Lượt 6 · #48–#51 / D51: cửa mô phỏng không tự khoá, PIN 1–9, đóng cửa, hỗ trợ tại cửa chống trùng, nhật ký
    // =========================================================================
    [Fact]
    public async Task Door_opens_by_pin_stays_open_until_closed_and_logs_without_codes()
    {
        await using var f = await Fixture.Create();
        var today = Fixture.TodayVn;
        var contract = await f.CreateContract(today, today.AddMonths(3));
        var access = new AccessService(f.Db, new AccessQrOptions("test-access-secret-at-least-thirty-two-characters"));
        var doors = new DoorService(f.Db);
        var qr = await access.GetQrAsync(f.Customer.UserId, contract.ContractId);

        Assert.Equal("LOCKED", (await doors.GetUnitStateAsync("K01", null)).Door);
        Assert.Equal("DENIED", (await access.ScanAsync("120345", "test", unitNumber: "K01")).Result); // có số 0
        Assert.Equal("OPEN", (await access.ScanAsync(qr.BackupCode, "test", unitNumber: "K01")).Result);
        Assert.Equal("OPEN", (await doors.GetUnitStateAsync("K01", null)).Door); // không tự khoá

        var closed = await doors.CloseByCustomerAsync(f.Customer.UserId, contract.ContractId);
        Assert.True(closed.Changed);
        Assert.Equal("LOCKED", closed.Door);
        Assert.False((await doors.CloseFromDeviceAsync("K01", null, "test")).Changed); // đóng lần nữa không ghi trùng
        await Assert.ThrowsAsync<KeyNotFoundException>(() => doors.CloseByCustomerAsync(f.OtherCustomer.UserId, contract.ContractId));

        var logs = await doors.GetDoorLogsAsync(new StorageProject.Core.DTOs.Access.DoorLogFilter(null, "K01", null, null, null));
        Assert.Contains(logs.Items, r => r.Result == "OPEN" && r.Method == "PIN");
        Assert.Contains(logs.Items, r => r.Result == "CLOSED" && r.Method == "CLOSE_APP");
        Assert.Contains(logs.Items, r => r.Result == "DENIED" && r.Reason == "Mã PIN gồm 6 số từ 1 đến 9.");
        var raw = await f.Db.ActivityLogs.Where(l => l.Action == "ACCESS_SCANNED").Select(l => l.NewValue).ToListAsync();
        Assert.DoesNotContain(raw, v => v!.Contains(qr.BackupCode) || v.Contains(qr.Code)); // không lưu nguyên QR/PIN
    }

    [Fact]
    public async Task Door_support_reaches_facility_once_within_30_minutes()
    {
        await using var f = await Fixture.Create();
        var today = Fixture.TodayVn;
        await f.CreateContract(today, today.AddMonths(3));
        var doors = new DoorService(f.Db);
        var first = await doors.RequestSupportAsync(new StorageProject.Core.DTOs.Access.DoorSupportRequest("K01"), "test");
        var again = await doors.RequestSupportAsync(new StorageProject.Core.DTOs.Access.DoorSupportRequest("K01"), "test");
        Assert.False(first.Duplicate);
        Assert.True(again.Duplicate);
        Assert.Equal(first.TicketCode, again.TicketCode);
        var ticket = await f.Db.SupportTickets.SingleAsync();
        Assert.Equal(f.Unit.UnitId, ticket.UnitId);
        Assert.Equal("OPEN", ticket.Status);
    }
}
