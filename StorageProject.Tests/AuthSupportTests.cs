// Kiểm tra dữ liệu đã lưu, quyền sở hữu và các trường hợp tiền bị gửi lặp.
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class AuthSupportTests
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
        public User Manager = null!, Customer = null!, OtherManager = null!;
        public Facility Facility = null!;
        public StorageUnit Unit = null!;
        public Reservation Order = null!;
        public static DateOnly Day => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        public static async Task<Fixture> Create()
        {
            var f = new Fixture(); await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();
            f.Manager = new User { Username = "manager", Email = "manager@example.com", FullName = "Quản lý", PasswordHash = "x", Status = "ACTIVE" };
            f.Customer = new User { Username = "customer", Email = "customer@example.com", FullName = "Khách hàng", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Customer@123", 4), Status = "ACTIVE" };
            f.OtherManager = new User { Username = "other", Email = "other@example.com", FullName = "Quản lý khác", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "Cơ sở A", Address = "Địa chỉ A", Status = "ACTIVE" };
            var other = new Facility { Name = "Cơ sở B", Address = "Địa chỉ B", Status = "ACTIVE" };
            var type = new UnitType { TypeName = "Kho thường", Area = 15, Status = "ACTIVE" };
            var role = new Role { RoleName = "MANAGER" };
            f.Db.AddRange(f.Manager, f.Customer, f.OtherManager, f.Facility, other, type, role); await f.Db.SaveChangesAsync();
            f.Db.AddRange(new UserRole { UserId = f.Manager.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = f.OtherManager.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow },
                new UserFacility { UserId = f.Manager.UserId, FacilityId = f.Facility.FacilityId, AssignedBy = f.Manager.UserId, AssignedFrom = Day.AddDays(-1), Status = "ACTIVE" },
                new UserFacility { UserId = f.OtherManager.UserId, FacilityId = other.FacilityId, AssignedBy = f.Manager.UserId, AssignedFrom = Day.AddDays(-1), Status = "ACTIVE" });
            f.Unit = new StorageUnit { UnitNumber = "K01", FacilityId = f.Facility.FacilityId, UnitTypeId = type.UnitTypeId, Status = "AVAILABLE" };
            f.Db.Add(f.Unit); await f.Db.SaveChangesAsync();
            f.Order = new Reservation { CustomerId = f.Customer.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = type.UnitTypeId,
                StartDate = Day.AddDays(2), ExpectedEndDate = Day.AddMonths(3), RentalPeriodMonths = 3, EstimatedAmount = 3000000,
                RequiredDeposit = 1000000, QuotedMonthlyRate = 1000000, Status = "PENDING_PAYMENT", ExpiresAt = DateTime.UtcNow.AddMinutes(15), CreatedAt = DateTime.UtcNow };
            f.Db.Add(f.Order); await f.Db.SaveChangesAsync(); return f;
        }
        public async Task Pay()
        {
            Order.Status = "CONFIRMED"; Order.PaidAt = DateTime.UtcNow;
            Db.AddRange(new Payment { ReservationId = Order.ReservationId, PaymentType = "RENT", Amount = 3000000, PaymentMethod = "CASH", Status = "PAID", PaidAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Payment { ReservationId = Order.ReservationId, PaymentType = "DEPOSIT", Amount = 1000000, PaymentMethod = "CASH", Status = "PAID", PaidAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            await Db.SaveChangesAsync();
        }
        public async Task<(RentalContract Contract, ReturnInspection Inspection)> Contract()
        {
            await Pay(); Order.Status = "CHECKED_IN"; Unit.Status = "OCCUPIED";
            var c = new RentalContract { ReservationId = Order.ReservationId, CustomerId = Customer.UserId, UnitId = Unit.UnitId,
                StartDate = Day.AddMonths(-3), EndDate = Day.AddDays(2), AgreedMonthlyRate = 1000000, DepositAmount = 1000000,
                Status = "ACTIVE", CreatedAt = DateTime.UtcNow };
            Db.Add(c); await Db.SaveChangesAsync();
            foreach (var p in await Db.Payments.ToListAsync()) p.ContractId = c.ContractId;
            var i = new ReturnInspection { ContractId = c.ContractId, StaffId = Manager.UserId, Status = "SCHEDULED", CreatedAt = DateTime.UtcNow };
            Db.Add(i); await Db.SaveChangesAsync(); return (c, i);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await Connection.DisposeAsync(); }
    }

    [Fact] public async Task PasswordIsChangedInDatabaseAndOldPasswordCannotLogin()
    {
        await using var f = await Fixture.Create();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["JwtSettings:Secret"] = "test-signing-key-with-at-least-thirty-two-characters" }).Build();
        var service = new AuthService(f.Db, config);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ChangePasswordAsync(f.Customer.UserId, new("Wrong@123", "NewPass@123")));
        await service.ChangePasswordAsync(f.Customer.UserId, new("Customer@123", "NewPass@123"));
        f.Db.ChangeTracker.Clear();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.LoginAsync(new("customer", "Customer@123"), null, null));
        Assert.NotEmpty((await service.LoginAsync(new("customer", "NewPass@123"), null, null)).Token);
    }
    [Fact] public async Task InvalidNameAndShortPasswordDoNotChangeTheUser()
    {
        await using var f = await Fixture.Create(); var service = new AuthService(f.Db, new ConfigurationBuilder().Build());
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateUserProfileAsync(f.Customer.UserId, new("  ", null)));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ChangePasswordAsync(f.Customer.UserId, new("Customer@123", "1234567")));
        var profile = await service.UpdateUserProfileAsync(f.Customer.UserId, new("  Tên mới  ", null));
        Assert.Equal("Tên mới", profile.FullName);
        Assert.True(BCrypt.Net.BCrypt.Verify("Customer@123", f.Customer.PasswordHash));
    }
    // C13 ghi đúng tài khoản được truyền từ claim, đọc lại từ database sau khi bỏ cache EF.
    [Fact] public async Task ProfileChangePersistsOnlyForTheSelectedAccount()
    {
        await using var f = await Fixture.Create();
        var customerId = f.Customer.UserId;
        var otherId = f.Manager.UserId;
        var otherName = f.Manager.FullName;
        var service = new AuthService(f.Db, new ConfigurationBuilder().Build());
        var changed = await service.UpdateUserProfileAsync(customerId, new("  Tên khách mới  ", null));
        Assert.Equal(customerId, changed.UserId);
        f.Db.ChangeTracker.Clear();
        var saved = await service.GetUserProfileAsync(customerId);
        Assert.Equal("Tên khách mới", saved.FullName);
        Assert.Equal("customer", saved.Username);
        Assert.Equal(otherName, (await service.GetUserProfileAsync(otherId)).FullName);
    }

    [Fact] public async Task StaffResponsesReachOnlyTheTicketOwnerInTimeOrder()
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        var t = new SupportTicket { CustomerId = f.Customer.UserId, ContractId = c.ContractId, UnitId = f.Unit.UnitId,
            IssueType = "UNIT", Title = "Cần hỗ trợ", Description = "Kiểm tra cửa", Status = "OPEN", CreatedAt = DateTime.UtcNow };
        f.Db.Add(t); await f.Db.SaveChangesAsync(); var staff = new StaffService(f.Db);
        await staff.AddTicketResponseAsync(f.Manager.UserId, $"HT-{t.TicketId}", new() { Note = "Đã tiếp nhận", NextStatus = "IN_PROGRESS" });
        await staff.AddTicketResponseAsync(f.Manager.UserId, $"HT-{t.TicketId}", new() { Note = "Đã sửa xong", NextStatus = "WAITING_CUSTOMER" });
        var service = new SupportTicketService(f.Db); var detail = await service.GetTicketDetailAsync(f.Customer.UserId, t.TicketId);
        Assert.Equal(new[] { "Đã tiếp nhận", "Đã sửa xong" }, detail!.Responses!.Select(r => r.Message));
        Assert.All(detail.Responses!, r => Assert.Equal(f.Manager.FullName, r.StaffName));
        Assert.Null(await service.GetTicketDetailAsync(f.OtherManager.UserId, t.TicketId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => staff.AddTicketResponseAsync(f.OtherManager.UserId, $"HT-{t.TicketId}", new() { Note = "Sai cơ sở", NextStatus = "IN_PROGRESS" }));
    }
    // Gửi qua dịch vụ tạo thật để kiểm tra cả ràng buộc SQL, thay vì chèn ticket trực tiếp.
    [Theory]
    [InlineData("ACCESS", "ACCESS_CARD")]
    [InlineData("ITEMS", "STORED_ITEM")]
    [InlineData("SCHEDULE", "OTHER")]
    [InlineData("UNIT", "UNIT")]
    [InlineData("LOCK", "LOCK")]
    [InlineData("PAYMENT", "PAYMENT")]
    [InlineData("OTHER", "OTHER")]
    public async Task TicketCreatedFromCustomerTopicAppearsOnlyAtItsContractFacility(string topic, string storedType)
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        var created = await new SupportTicketService(f.Db).CreateTicketAsync(f.Customer.UserId,
            new(c.ContractId, null, topic, "Cần hỗ trợ", "Không mở được cửa", "NORMAL"));
        Assert.Equal(storedType, created.IssueType); Assert.Equal(f.Unit.UnitId, created.UnitId);
        f.Db.ChangeTracker.Clear();
        var staff = new StaffService(f.Db);
        Assert.Equal($"HT-{created.TicketId:D4}", Assert.Single((await staff.GetStaffBoardAsync(f.Manager.UserId)).Tickets).Id);
        Assert.Empty((await staff.GetStaffBoardAsync(f.OtherManager.UserId)).Tickets);
        await staff.AddTicketResponseAsync(f.Manager.UserId, $"HT-{created.TicketId:D4}", new() { Note = "Đã tiếp nhận", NextStatus = "WAITING_CUSTOMER" });
        Assert.Equal("Đã tiếp nhận", Assert.Single((await new SupportTicketService(f.Db).GetTicketDetailAsync(f.Customer.UserId, created.TicketId))!.Responses!).Message);
    }

    [Fact] public async Task TicketWithoutUnitIsVisibleThroughItsContract()
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        f.Db.Add(new SupportTicket { CustomerId = f.Customer.UserId, ContractId = c.ContractId, UnitId = null,
            IssueType = "UNIT", Title = "Ticket cũ", Description = "Thiếu liên kết ô trực tiếp", Priority = "NORMAL", Status = "OPEN", CreatedAt = DateTime.UtcNow });
        await f.Db.SaveChangesAsync(); f.Db.ChangeTracker.Clear();
        var row = Assert.Single((await new StaffService(f.Db).GetStaffBoardAsync(f.Manager.UserId)).Tickets);
        Assert.Equal(f.Unit.UnitNumber, row.Unit); Assert.Equal("OPEN", row.Status);
        Assert.Empty((await new StaffService(f.Db).GetStaffBoardAsync(f.OtherManager.UserId)).Tickets);
    }

    [Theory]
    [InlineData("ASSIGNED", "IN_PROGRESS")]
    [InlineData("RESOLVED", "WAITING_CUSTOMER")]
    [InlineData("CLOSED", "DONE")]
    public async Task TicketBoardUsesStatesSupportedByStaffPage(string databaseState, string pageState)
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        f.Db.Add(new SupportTicket { CustomerId = f.Customer.UserId, ContractId = c.ContractId, UnitId = f.Unit.UnitId,
            IssueType = "UNIT", Title = "Trạng thái hỗ trợ", Description = "Kiểm tra trạng thái", Priority = "NORMAL", Status = databaseState, CreatedAt = DateTime.UtcNow });
        await f.Db.SaveChangesAsync();
        Assert.Equal(pageState, Assert.Single((await new StaffService(f.Db).GetStaffBoardAsync(f.Manager.UserId)).Tickets).Status);
    }

    [Fact] public async Task TicketBoardNotesContainCustomerDescriptionAndStaffResponseWithUiFields()
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        var created = await new SupportTicketService(f.Db).CreateTicketAsync(f.Customer.UserId,
            new(c.ContractId, null, "UNIT", "Cần hỗ trợ", "Nội dung khách đã gửi", "NORMAL"));
        var staff = new StaffService(f.Db);
        await staff.AddTicketResponseAsync(f.Manager.UserId, $"HT-{created.TicketId:D4}", new() { Note = "Nhân viên đã kiểm tra", NextStatus = "IN_PROGRESS" });
        var ticket = Assert.Single((await staff.GetStaffBoardAsync(f.Manager.UserId)).Tickets);
        using var json = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(ticket,
            new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase }));
        var notes = json.RootElement.GetProperty("notes").EnumerateArray().ToArray();
        Assert.Equal(new[] { "Nội dung khách đã gửi", "Nhân viên đã kiểm tra" }, notes.Select(n => n.GetProperty("text").GetString()));
        Assert.All(notes, n => Assert.False(string.IsNullOrWhiteSpace(n.GetProperty("at").GetString())));
    }

    [Fact] public async Task TicketCannotUseAUnitDifferentFromItsOwnedContract()
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        var wrongUnit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Unit.UnitTypeId, UnitNumber = "K99", Status = "AVAILABLE" };
        f.Db.Add(wrongUnit); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => new SupportTicketService(f.Db).CreateTicketAsync(f.Customer.UserId,
            new(c.ContractId, wrongUnit.UnitId, "UNIT", "Sai ô", "Sai liên kết ô", "NORMAL")));
        Assert.Empty(await f.Db.SupportTickets.ToListAsync());
    }

    [Fact] public async Task TicketInputIsValidatedAndBlankPriorityUsesNormal()
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract(); var service = new SupportTicketService(f.Db);
        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateTicketAsync(f.Customer.UserId, new(c.ContractId, null, "BAD_TYPE", "Tiêu đề", "Nội dung", "NORMAL")));
        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateTicketAsync(f.Customer.UserId, new(c.ContractId, null, "UNIT", "Tiêu đề", "  ", "NORMAL")));
        var result = await service.CreateTicketAsync(f.Customer.UserId, new(c.ContractId, null, "UNIT", "Tiêu đề", "Nội dung", ""));
        Assert.Equal("NORMAL", result.Priority);
    }

    [Fact] public async Task LegacyTicketWithAWrongUnitCannotBeReadOrRepliedToFromThatUnitsFacility()
    {
        await using var f = await Fixture.Create(); var (c, _) = await f.Contract();
        var otherFacility = await f.Db.Facilities.SingleAsync(x => x.FacilityId != f.Facility.FacilityId);
        var wrongUnit = new StorageUnit { FacilityId = otherFacility.FacilityId, UnitTypeId = f.Unit.UnitTypeId, UnitNumber = "B99", Status = "AVAILABLE" };
        f.Db.Add(wrongUnit); await f.Db.SaveChangesAsync();
        var ticket = new SupportTicket { CustomerId = f.Customer.UserId, ContractId = c.ContractId, UnitId = wrongUnit.UnitId,
            IssueType = "UNIT", Title = "Liên kết ô cũ bị sai", Description = "Hợp đồng xác định cơ sở xử lý", Priority = "NORMAL", Status = "OPEN", CreatedAt = DateTime.UtcNow };
        f.Db.Add(ticket); await f.Db.SaveChangesAsync();
        var staff = new StaffService(f.Db);
        Assert.Equal(f.Unit.UnitNumber, Assert.Single((await staff.GetStaffBoardAsync(f.Manager.UserId)).Tickets).Unit);
        Assert.Empty((await staff.GetStaffBoardAsync(f.OtherManager.UserId)).Tickets);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => staff.AddTicketResponseAsync(f.OtherManager.UserId, $"HT-{ticket.TicketId:D4}",
            new() { Note = "Sai cơ sở", NextStatus = "IN_PROGRESS" }));
    }
}
