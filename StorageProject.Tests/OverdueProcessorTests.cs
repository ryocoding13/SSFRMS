using Microsoft.Extensions.Configuration;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class OverdueProcessorTests : IAsyncDisposable
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

    public OverdueProcessorTests()
    {
        _connection.Open();
        _db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<(User customer, Facility facility, StorageUnit unit, Reservation reservation)> SetupBaseAsync()
    {
        var customer = new User
        {
            Username = "customer_test",
            Email = "customer@test.com",
            FullName = "Khách Hàng Test",
            PasswordHash = "hashed",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Users.Add(customer);

        var facility = new Facility
        {
            Name = "SafeSpace Test Facility",
            Address = "123 Đường Test",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.Facilities.Add(facility);

        var unitType = new UnitType
        {
            TypeName = "Kho Tiêu Chuẩn",
            Area = 10,
            ClimateControlled = false,
            CreatedAt = DateTime.UtcNow
        };
        _db.UnitTypes.Add(unitType);
        await _db.SaveChangesAsync();

        var unit = new StorageUnit
        {
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            UnitNumber = "A-101",
            Status = "OCCUPIED",
            CreatedAt = DateTime.UtcNow
        };
        _db.StorageUnits.Add(unit);

        var reservation = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).AddMonths(1)),
            RentalPeriodMonths = 1,
            EstimatedAmount = 1_000_000m,
            RequiredDeposit = 1_000_000m,
            QuotedMonthlyRate = 1_000_000m,
            Status = "CONFIRMED",
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        };
        _db.Reservations.Add(reservation);
        await _db.SaveChangesAsync();

        return (customer, facility, unit, reservation);
    }

    [Fact]
    public async Task RenewalReminderWaitsForThreeDaysAndSendsOncePerRentalPeriod()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = OpsRules.TodayLocal;
        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
            StartDate = today.AddDays(-25), EndDate = today.AddDays(4), DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        Assert.False(await _db.ActivityLogs.AnyAsync(l => l.Action == CustomerEmailDelivery.RenewalReminderQueued));

        var mailbox = new ReminderMailbox();
        var site = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AppSettings:FrontendUrl"] = "https://safespace.vn" }).Build();
        var delivery = new CustomerEmailDelivery(_db, mailbox, NullLogger<CustomerEmailDelivery>.Instance, site);
        contract = await _db.RentalContracts.SingleAsync();
        contract.EndDate = today.AddDays(3);
        await _db.SaveChangesAsync();
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        await delivery.DeliverPendingAsync(default);
        await delivery.DeliverPendingAsync(default);
        var message = Assert.Single(mailbox.Texts);
        Assert.Contains("còn 3 ngày", message);
        Assert.Contains("chọn Gia hạn", message);
        Assert.Contains("https://safespace.vn/#/units/", message);

        contract = await _db.RentalContracts.SingleAsync();
        contract.EndDate = today.AddDays(2);
        await _db.SaveChangesAsync();
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        contract = await _db.RentalContracts.SingleAsync();
        contract.Status = "RETURN_PENDING";
        await _db.SaveChangesAsync();
        await delivery.DeliverPendingAsync(default);
        Assert.Single(mailbox.Texts);
        Assert.Equal(2, await _db.ActivityLogs.CountAsync(l => l.Action == CustomerEmailDelivery.RenewalReminderQueued));
        Assert.Equal(1, await _db.ActivityLogs.CountAsync(l => l.Action == CustomerEmailDelivery.Skipped));
    }

    [Fact]
    public async Task ContractEmail_RetriesOnlyWhenSmtpSurelyRejected_AndPaperContractIsComplete()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = OpsRules.TodayLocal;
        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
            StartDate = today, EndDate = today.AddMonths(1), DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();
        CustomerEmailDelivery.QueueContract(_db, contract.ContractId, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        var mailbox = new FlakyMailbox { RejectFirst = 1 };
        var delivery = new CustomerEmailDelivery(_db, mailbox, NullLogger<CustomerEmailDelivery>.Instance);
        await delivery.DeliverPendingAsync(default);
        Assert.Equal(1, mailbox.Calls);
        Assert.Equal(1, await _db.ActivityLogs.CountAsync(l => l.Action == CustomerEmailDelivery.Deferred));
        Assert.False(await _db.ActivityLogs.AnyAsync(l => l.Action == CustomerEmailDelivery.Sent));

        await delivery.DeliverPendingAsync(default); // chưa hết thời gian chờ thì chưa gửi lại
        Assert.Equal(1, mailbox.Calls);

        foreach (var log in await _db.ActivityLogs.Where(l => l.Action == CustomerEmailDelivery.Deferred).ToListAsync())
            log.LoggedAt = DateTime.UtcNow - CustomerEmailDelivery.RetryDelay - TimeSpan.FromMinutes(1);
        await _db.SaveChangesAsync();
        await delivery.DeliverPendingAsync(default);
        await delivery.DeliverPendingAsync(default);
        Assert.Equal(2, mailbox.Calls);
        Assert.Single(await _db.ActivityLogs.Where(l => l.Action == CustomerEmailDelivery.Sent).ToListAsync());

        Assert.Empty(mailbox.Attachments); // D58: thư không đính kèm tệp
        var document = await ContractDocuments.LoadAsync(_db, customer.UserId, contract.ContractId, default);
        var html = Assert.IsType<ContractDocument>(document).ToHtml();
        Assert.Contains("HỢP ĐỒNG THUÊ KHO LƯU TRỮ TỰ PHỤC VỤ", html);
        Assert.Contains("KHÁCH HÀNG TEST", html);
        Assert.Contains("A-101", html);
        Assert.Contains("1.000.000 đ", html);
        Assert.Contains("Điều 10. Điều khoản chung", html);
        Assert.Contains("trừ 5% tiền cọc ban đầu", html);
        Assert.DoesNotContain("localhost", mailbox.LastText);
        Assert.Contains("Xem hợp đồng giấy", mailbox.LastText);
    }

    [Fact]
    public async Task ContractEmail_UnknownSmtpOutcome_IsNeverResent()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = OpsRules.TodayLocal;
        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
            StartDate = today, EndDate = today.AddMonths(1), DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();
        CustomerEmailDelivery.QueueContract(_db, contract.ContractId, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        var mailbox = new FlakyMailbox { BreakMidway = true };
        var delivery = new CustomerEmailDelivery(_db, mailbox, NullLogger<CustomerEmailDelivery>.Instance);
        await delivery.DeliverPendingAsync(default);
        await delivery.DeliverPendingAsync(default);
        Assert.Equal(1, mailbox.Calls);
        Assert.Single(await _db.ActivityLogs.Where(l => l.Action == CustomerEmailDelivery.Failed).ToListAsync());
        Assert.False(await _db.ActivityLogs.AnyAsync(l => l.Action == CustomerEmailDelivery.Deferred));
    }

    private sealed class FlakyMailbox : ISmtpMailTransport
    {
        public int RejectFirst { get; init; }
        public bool BreakMidway { get; init; }
        public int Calls { get; private set; }
        public List<string> Attachments { get; } = [];
        public string LastText { get; private set; } = "";

        public Task SendAsync(string email, string subject, MimeEntity body, CancellationToken ct)
        {
            Calls++;
            if (Calls <= RejectFirst) throw new SmtpNotSentException("SMTP_CONNECT_FAILED");
            if (BreakMidway) throw new IOException("Mất kết nối khi đang truyền thư.");
            LastText = PlainText(body);
            if (body is Multipart multipart)
                foreach (var part in multipart.OfType<MimePart>().Where(part => part.IsAttachment))
                {
                    using var content = new MemoryStream();
                    part.Content!.DecodeTo(content);
                    Attachments.Add(System.Text.Encoding.UTF8.GetString(content.ToArray()));
                }
            return Task.CompletedTask;
        }
    }

    private static string PlainText(MimeEntity body) => body switch
    {
        TextPart text when text.IsPlain => text.Text,
        Multipart multipart => multipart.Select(PlainText).FirstOrDefault(text => text.Length > 0) ?? "",
        _ => ""
    };

    private sealed class ReminderMailbox : ISmtpMailTransport
    {
        public List<string> Texts { get; } = [];

        public Task SendAsync(string email, string subject, MimeEntity body, CancellationToken ct)
        {
            Texts.Add(PlainText(body));
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task ProcessDailyOverdue_TransitionsActiveToExpiring_WhenWithin30Days()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(15), // Hết hạn trong 15 ngày tới
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var updated = await _db.RentalContracts.FindAsync(contract.ContractId);
        Assert.NotNull(updated);
        Assert.Equal("EXPIRING", updated.Status);
    }

    [Fact]
    public async Task ProcessDailyOverdue_TransitionsToOverdue_AndCreatesCase_With5PercentPerDay()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-5), // Đã quá hạn 5 ngày
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var updated = await _db.RentalContracts.Include(c => c.OverdueCases).FirstOrDefaultAsync(c => c.ContractId == contract.ContractId);
        Assert.NotNull(updated);
        Assert.Equal("OVERDUE", updated.Status);

        var activeCase = Assert.Single(updated.OverdueCases);
        // 5 ngày * 5% cọc = 25% * 1.000.000 = 250.000 đ
        Assert.Equal(250_000m, activeCase.OutstandingAmount);
        Assert.Equal("OPEN", activeCase.Status);
        Assert.Equal(contract.EndDate.AddDays(1), activeCase.OverdueFrom);
    }

    [Fact]
    public async Task ProcessDailyOverdue_EscalatesCase_WhenOverdue20Days_AndCapsAt100PercentDeposit()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-22), // Đã quá hạn 22 ngày (> 20 ngày)
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "OVERDUE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var updated = await _db.RentalContracts.Include(c => c.OverdueCases).FirstOrDefaultAsync(c => c.ContractId == contract.ContractId);
        Assert.NotNull(updated);

        var activeCase = Assert.Single(updated.OverdueCases);
        // Phí cap tối đa ở 100% cọc: 1.000.000 đ (dù 22 ngày * 5% = 110%)
        Assert.Equal(1_000_000m, activeCase.OutstandingAmount);
        Assert.Equal("ESCALATED", activeCase.Status);
        Assert.Contains("ngày 20", activeCase.Notes);
    }

    [Fact]
    public async Task ProcessDailyOverdue_IsIdempotent_DoesNotDuplicateOverdueCaseOrFees()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-4), // Quá hạn 4 ngày
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "OVERDUE",
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        // Chạy lần 1
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        // Chạy lần 2
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var cases = await _db.OverdueCases.Where(o => o.ContractId == contract.ContractId).ToListAsync();
        Assert.Single(cases);
        Assert.Equal(200_000m, cases[0].OutstandingAmount); // 4 ngày * 5% = 20% = 200.000
    }

    [Fact]
    public async Task ProcessDailyOverdue_StopsCalculatingFee_WhenReturnPending()
    {
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-60),
            EndDate = today.AddDays(-10), // Hết hạn 10 ngày trước
            DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m,
            Status = "RETURN_PENDING", // Khách đã gửi trả kho ở ngày thứ 2 quá hạn
            CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        // Biên bản trả kho được tạo 8 ngày trước (tức là trễ đúng 2 ngày sau EndDate)
        var inspection = new ReturnInspection
        {
            ContractId = contract.ContractId,
            StaffId = customer.UserId,
            Status = "SCHEDULED",
            CreatedAt = DateTime.UtcNow.AddDays(-8)
        };
        _db.ReturnInspections.Add(inspection);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        var activeCase = await _db.OverdueCases.SingleAsync(o => o.ContractId == contract.ContractId);
        // D32: Dừng tính phí tại ngày gửi trả kho (2 ngày trễ * 5% = 10% = 100.000 đ), không tính đến 10 ngày (50%)
        Assert.Equal(100_000m, activeCase.OutstandingAmount);
    }

    [Fact]
    public async Task ProcessDailyOverdue_UsesRateFromActiveOverduePolicy()
    {
        // S05 (Phiên 2): tỷ lệ lấy từ chính sách OVERDUE (B02) thay vì ghi cứng 5%.
        var (customer, _, unit, reservation) = await SetupBaseAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        _db.Policies.Add(new Policy
        {
            CreatedBy = customer.UserId, PolicyName = "Quá hạn thử 3%", PolicyType = "OVERDUE",
            CalculationType = "DEPOSIT_PERCENT_PER_DAY", Value = 3m, RuleDescription = "Thử",
            EffectiveFrom = today.AddDays(-1), Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
            StartDate = today.AddDays(-60), EndDate = today.AddDays(-5), DepositAmount = 1_000_000m,
            AgreedMonthlyRate = 1_000_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        };
        _db.RentalContracts.Add(contract);
        await _db.SaveChangesAsync();

        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        await OverdueProcessor.ProcessDailyOverdueAsync(_db); // chạy lại không tạo trùng hồ sơ

        var cases = await _db.OverdueCases.Where(o => o.ContractId == contract.ContractId).ToListAsync();
        var c = Assert.Single(cases);
        Assert.Equal(150_000m, c.OutstandingAmount); // 5 ngày × 3% × 1.000.000
    }
}
