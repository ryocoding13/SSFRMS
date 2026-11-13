using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using StorageProject.Core.DTOs.Demo;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class OverdueP1UnifiedPolicyTests : IAsyncDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public OverdueP1UnifiedPolicyTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task OverdueP1_Rate6Percent_Deposit1Million_Overdue2Days_Yields120KAcrossWorkerAndOpsRules()
    {
        // Setup facility, unit, customer, manager, contract
        var facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "123 NLB", Status = "ACTIVE" };
        var unitType = new UnitType { TypeName = "Kho thường M", Area = 15m, Status = "ACTIVE" };
        _db.Facilities.Add(facility);
        _db.UnitTypes.Add(unitType);
        await _db.SaveChangesAsync();

        var unit = new StorageUnit { FacilityId = facility.FacilityId, UnitTypeId = unitType.UnitTypeId, UnitNumber = "K01", Status = "OCCUPIED" };
        var customer = new User { Username = "customer01", Email = "c1@test.vn", PasswordHash = "hash", FullName = "Nguyễn Văn An", Status = "ACTIVE" };
        var manager = new User { Username = "manager01", Email = "m1@test.vn", PasswordHash = "hash", FullName = "Trần Quản Lý", Status = "ACTIVE" };
        _db.StorageUnits.Add(unit);
        _db.Users.AddRange(customer, manager);
        await _db.SaveChangesAsync();

        var today = OpsRules.TodayLocal;

        var reservation = new Reservation
        {
            CustomerId = customer.UserId,
            FacilityId = facility.FacilityId,
            UnitTypeId = unitType.UnitTypeId,
            StartDate = today.AddDays(-32),
            ExpectedEndDate = today.AddDays(2),
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

        _db.UserFacilities.Add(new UserFacility
        {
            UserId = manager.UserId,
            FacilityId = facility.FacilityId,
            AssignedFrom = today.AddDays(-30),
            Status = "ACTIVE"
        });

        var contract = new RentalContract
        {
            ReservationId = reservation.ReservationId,
            CustomerId = customer.UserId,
            UnitId = unit.UnitId,
            StartDate = today.AddDays(-32),
            EndDate = today.AddDays(2),
            AgreedMonthlyRate = 1_000_000m,
            DepositAmount = 1_000_000m, // Cọc 1.000.000 đ
            Status = "ACTIVE"
        };
        _db.RentalContracts.Add(contract);

        // Thiết lập chính sách OVERDUE = 6.0% (DEPOSIT_PERCENT_PER_DAY)
        _db.Policies.Add(new Policy
        {
            PolicyName = "Phí phạt quá hạn",
            PolicyType = "OVERDUE",
            CalculationType = "DEPOSIT_PERCENT_PER_DAY",
            Value = 6.0m, // 6% cọc/ngày
            RuleDescription = "Phí quá hạn 6% mỗi ngày theo D32",
            Status = "ACTIVE",
            EffectiveFrom = today.AddDays(-10),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = manager.UserId
        });
        await _db.SaveChangesAsync();

        // Mục 45/53: dùng cùng dịch vụ với công cụ admin để đưa hợp đồng sang quá hạn.
        var demo = new DemoToolsService(_db);
        await demo.EditContractAsync(manager.UserId, contract.ContractId,
            new DemoContractEditRequest(contract.StartDate, today.AddDays(-2), null, "Kiểm tra thư quá hạn"));
        Assert.Equal("OVERDUE", contract.Status);

        // 1. Kiểm tra tính toán thống nhất qua OpsRules.CalculateContractOverdueAsync
        var calc = await OpsRules.CalculateContractOverdueAsync(_db, contract, today, isSettled: false);
        Assert.Equal(2, calc.OverdueDays);
        Assert.Equal(6.0m, calc.RatePerDay);
        // 1.000.000 * 6% * 2 = 120.000 đ
        Assert.Equal(120_000m, calc.OverdueFee);
        Assert.Equal(880_000m, calc.RemainingDeposit);
        // Ngày cạn cọc = ceil(100 / 6) = 17 ngày
        Assert.Equal(17, calc.DepletionDay);
        // Mốc xử lý đồ cố định ngày 20, KHÔNG nhảy về ngày 17
        Assert.Equal(20, calc.DisposalDay);

        // 2. Chạy OverdueProcessor worker
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);

        // Kiểm tra hợp đồng đã chuyển sang OVERDUE
        var updatedContract = await _db.RentalContracts
            .Include(c => c.OverdueCases)
            .SingleAsync(c => c.ContractId == contract.ContractId);
        Assert.Equal("OVERDUE", updatedContract.Status);

        // Kiểm tra OverdueCase được tạo với đúng 120.000 đ phí phạt
        var activeCase = Assert.Single(updatedContract.OverdueCases);
        Assert.Equal(120_000m, activeCase.OutstandingAmount);

        // 3. Kiểm tra ContractService trả về đúng Overdue DTO cho Customer
        var contractService = new ContractService(_db);
        var detail = await contractService.GetContractDetailAsync(customer.UserId, contract.ContractId);
        Assert.NotNull(detail);
        Assert.NotNull(detail.Overdue);
        Assert.Equal(120_000m, detail.Overdue.OverdueFee);
        Assert.Equal(2, detail.Overdue.OverdueDays);
        Assert.Equal(6.0m, detail.Overdue.RatePerDay);
        Assert.Equal(880_000m, detail.Overdue.RemainingDeposit);
        Assert.Equal(17, detail.Overdue.DepletionDay);
        Assert.Equal(20, detail.Overdue.DisposalDay);

        // 4. Kiểm tra FacilityOpsService trả về đúng OverdueCaseDto cho Manager
        var opsActor = new OpsActor(manager.UserId, IsManager: true);
        var opsService = new FacilityOpsService(_db);
        var overdueCases = await opsService.GetOverdueCasesAsync(opsActor);
        var caseItem = Assert.Single(overdueCases);
        Assert.Equal(120_000m, caseItem.OverdueFee);
        Assert.Equal(2, caseItem.OverdueDays);
        Assert.Equal(6.0m, caseItem.OverdueRate);
        Assert.Equal(880_000m, caseItem.RemainingDeposit);
        Assert.Equal(17, caseItem.DepletionDay);
        Assert.Equal(20, caseItem.RemovalDay);

        // Mục 53: chạy lại worker và bộ gửi, email quá hạn chỉ được gửi một lần trong kỳ.
        await OverdueProcessor.ProcessDailyOverdueAsync(_db);
        Assert.Equal(1, await _db.ActivityLogs.CountAsync(x => x.Action == CustomerEmailDelivery.OverdueQueued));
        var mailbox = new TestMailbox();
        var delivery = new CustomerEmailDelivery(_db, mailbox, NullLogger<CustomerEmailDelivery>.Instance);
        await delivery.DeliverPendingAsync(default);
        await delivery.DeliverPendingAsync(default);
        Assert.Equal(1, mailbox.Attempts);
        Assert.Contains("Quá hạn", mailbox.Body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("120.000", mailbox.Body);
        Assert.Equal(1, await _db.ActivityLogs.CountAsync(x => x.Action == CustomerEmailDelivery.Sent));

        // Mục 52: chỉ chủ hợp đồng tải được. SMTP lỗi phải lưu FAILED và giữ nguyên số SENT.
        Assert.Null(await ContractDocuments.LoadAsync(_db, manager.UserId, contract.ContractId, default));
        var document = await ContractDocuments.LoadAsync(_db, customer.UserId, contract.ContractId, default);
        Assert.NotNull(document);
        Assert.Contains("K01", document.ToHtml());
        mailbox.Reject = true;
        CustomerEmailDelivery.QueueContract(_db, contract.ContractId, DateTime.UtcNow);
        await _db.SaveChangesAsync();
        await delivery.DeliverPendingAsync(default);
        await delivery.DeliverPendingAsync(default);
        Assert.Equal(2, mailbox.Attempts);
        Assert.Equal(1, await _db.ActivityLogs.CountAsync(x => x.Action == CustomerEmailDelivery.Sent));
        Assert.Equal(1, await _db.ActivityLogs.CountAsync(x => x.Action == CustomerEmailDelivery.Failed));
    }

    [Fact]
    public void ContractDocumentEscapesUserAndPolicyHtml()
    {
        var document = new ContractDocument(42, "<script>name</script>", "Cơ sở", "A02", "Kho M",
            new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1), 700000m, 350000m, "v2",
            new Dictionary<string, string> { ["payment"] = "<script>policy</script>" });
        var html = document.ToHtml();
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;policy&lt;/script&gt;", html);
        Assert.Contains("v2", html);
    }

    private static string PlainText(MimeEntity body) => body switch
    {
        TextPart text when text.IsPlain => text.Text,
        Multipart multipart => multipart.Select(PlainText).FirstOrDefault(text => text.Length > 0) ?? "",
        _ => ""
    };

    private sealed class TestMailbox : ISmtpMailTransport
    {
        public int Attempts { get; private set; }
        public string Body { get; private set; } = "";
        public bool Reject { get; set; }

        public Task SendAsync(string email, string subject, MimeEntity body, CancellationToken ct)
        {
            Attempts++;
            if (Reject) throw new InvalidOperationException("SMTP test rejected the message.");
            Body = PlainText(body);
            return Task.CompletedTask;
        }
    }
}
