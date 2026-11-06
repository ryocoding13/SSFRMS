using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class OperationsReportW7Tests
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
        public Facility FacilityA = null!;
        public Facility FacilityB = null!;
        public UnitType UnitType1 = null!;
        public UnitType UnitType2 = null!;
        public StorageUnit UnitA1 = null!;
        public StorageUnit UnitB1 = null!;

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
                Username = "ops_w7",
                Email = "ops_w7@storage.vn",
                PasswordHash = "hash",
                FullName = "Quản lý Vận hành W7",
                Status = "ACTIVE"
            };
            CustomerUser = new User
            {
                Username = "customer_w7",
                Email = "customer_w7@storage.vn",
                PasswordHash = "hash",
                FullName = "Khách hàng W7",
                Status = "ACTIVE"
            };
            Db.Users.AddRange(OperatorUser, CustomerUser);
            await Db.SaveChangesAsync();

            FacilityA = new Facility { Name = "SafeSpace Cơ Sở A", Address = "123 Đường A", Status = "ACTIVE" };
            FacilityB = new Facility { Name = "SafeSpace Cơ Sở B", Address = "456 Đường B", Status = "ACTIVE" };
            Db.Facilities.AddRange(FacilityA, FacilityB);
            await Db.SaveChangesAsync();

            UnitType1 = new UnitType { TypeName = "Kho 15m2", Description = "Loại 1", Area = 15m, Height = 3m, Status = "ACTIVE" };
            UnitType2 = new UnitType { TypeName = "Kho 30m2", Description = "Loại 2", Area = 30m, Height = 3m, Status = "ACTIVE" };
            Db.UnitTypes.AddRange(UnitType1, UnitType2);
            await Db.SaveChangesAsync();

            UnitA1 = new StorageUnit { FacilityId = FacilityA.FacilityId, UnitTypeId = UnitType1.UnitTypeId, UnitNumber = "A-01", Status = "AVAILABLE" };
            UnitB1 = new StorageUnit { FacilityId = FacilityB.FacilityId, UnitTypeId = UnitType2.UnitTypeId, UnitNumber = "B-01", Status = "AVAILABLE" };
            Db.StorageUnits.AddRange(UnitA1, UnitB1);
            await Db.SaveChangesAsync();
        }

        public async Task<(Reservation Res, RentalContract Contract)> CreateContractAsync(
            Facility fac, UnitType type, StorageUnit unit, decimal rent, decimal deposit, string status, DateTime createdAt, DateOnly startDate, DateOnly endDate)
        {
            var res = new Reservation
            {
                CustomerId = CustomerUser.UserId,
                FacilityId = fac.FacilityId,
                UnitTypeId = type.UnitTypeId,
                StartDate = startDate,
                ExpectedEndDate = endDate,
                RentalPeriodMonths = 1,
                QuotedMonthlyRate = rent,
                EstimatedAmount = rent,
                RequiredDeposit = deposit,
                Status = "CONFIRMED",
                PaymentMethod = "BANK_TRANSFER",
                CreatedAt = createdAt
            };
            Db.Reservations.Add(res);
            await Db.SaveChangesAsync();

            var contract = new RentalContract
            {
                ReservationId = res.ReservationId,
                CustomerId = CustomerUser.UserId,
                UnitId = unit.UnitId,
                StartDate = startDate,
                EndDate = endDate,
                AgreedMonthlyRate = rent,
                DepositAmount = deposit,
                Status = status,
                CreatedAt = createdAt
            };
            Db.RentalContracts.Add(contract);
            await Db.SaveChangesAsync();

            return (res, contract);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    [Fact]
    public async Task T01_IncidentTermination_RefundsRentAndDeposit_GrossRevenuePreserved_DepositHeldZero()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var now = DateTime.UtcNow;
        var today = OpsRules.TodayLocal;

        // Tạo hợp đồng chấm dứt do sự cố
        var (res, contract) = await f.CreateContractAsync(
            f.FacilityA, f.UnitType1, f.UnitA1,
            rent: 3000000m, deposit: 1000000m, status: "TERMINATED",
            createdAt: now.AddDays(-10), startDate: today.AddDays(-10), endDate: today.AddMonths(1));

        // Thu thuê 3 triệu + cọc 1 triệu
        f.Db.Payments.AddRange(
            new Payment
            {
                ContractId = contract.ContractId,
                ReservationId = res.ReservationId,
                PaymentType = "RENT",
                Amount = 3000000m,
                PaymentMethod = "BANK_TRANSFER",
                Status = "PAID",
                PaidAt = now.AddDays(-10),
                CreatedAt = now.AddDays(-10),
                UpdatedAt = now.AddDays(-10)
            },
            new Payment
            {
                ContractId = contract.ContractId,
                ReservationId = res.ReservationId,
                PaymentType = "DEPOSIT",
                Amount = 1000000m,
                PaymentMethod = "BANK_TRANSFER",
                Status = "PAID",
                PaidAt = now.AddDays(-10),
                CreatedAt = now.AddDays(-10),
                UpdatedAt = now.AddDays(-10)
            },
            // Hoàn tiền 4 triệu do sự cố kết thúc hợp đồng
            new Payment
            {
                ContractId = contract.ContractId,
                ReservationId = res.ReservationId,
                PaymentType = "REFUND",
                Amount = 4000000m,
                PaymentMethod = "BANK_TRANSFER",
                Status = "PAID",
                PaidAt = now.AddDays(-1),
                TransactionReference = "Hoàn tiền sự cố chấm dứt hợp đồng",
                CreatedAt = now.AddDays(-1),
                UpdatedAt = now.AddDays(-1)
            }
        );
        await f.Db.SaveChangesAsync();

        var service = new OperationsReportService(f.Db);
        var filter = new ReportFilter(today.AddDays(-15), today.AddDays(5), f.FacilityA.FacilityId, null);
        var report = await service.GetSystemReportAsync(filter);

        var metrics = report.Totals;
        // Tổng thu: 4 triệu, tổng hoàn: 4 triệu, thu ròng: 0
        Assert.Equal(4000000m, metrics.Collected);
        Assert.Equal(4000000m, metrics.Refunded);
        Assert.Equal(0m, metrics.NetCollected);

        // Doanh thu thuê và phí giữ nguyên dạng Gross: 3 triệu (không trừ REFUND theo D16)
        Assert.Equal(3000000m, metrics.RentalAndFeeRevenue);
        Assert.Equal(1000000m, metrics.DepositCollected);

        // Phân loại hoàn tiền: phân biệt 1 triệu hoàn cọc và 3 triệu hoàn tiền thuê
        Assert.Equal(1000000m, metrics.DepositRefunded);
        Assert.Equal(3000000m, metrics.RentalRefunded);
        Assert.Equal(0m, metrics.UnclassifiedRefunded);

        // Cọc còn giữ = 0 (hợp đồng đã TERMINATED)
        Assert.Equal(0m, metrics.DepositHeld);
    }

    [Fact]
    public async Task T02_PendingRefund_DoesNotIncreaseOutstanding_AndNotIncludedInRefunded()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var now = DateTime.UtcNow;
        var today = OpsRules.TodayLocal;

        var (res, contract) = await f.CreateContractAsync(
            f.FacilityA, f.UnitType1, f.UnitA1,
            rent: 2000000m, deposit: 1000000m, status: "ACTIVE",
            createdAt: now.AddDays(-5), startDate: today.AddDays(-5), endDate: today.AddMonths(1));

        // Thu cọc 1M đã PAID
        f.Db.Payments.Add(new Payment
        {
            ContractId = contract.ContractId,
            ReservationId = res.ReservationId,
            PaymentType = "DEPOSIT",
            Amount = 1000000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "PAID",
            PaidAt = now.AddDays(-5),
            CreatedAt = now.AddDays(-5),
            UpdatedAt = now.AddDays(-5)
        });

        // Khoản REFUND 500.000 đang ở trạng thái PENDING
        f.Db.Payments.Add(new Payment
        {
            ContractId = contract.ContractId,
            ReservationId = res.ReservationId,
            PaymentType = "REFUND",
            Amount = 500000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "PENDING",
            CreatedAt = now.AddDays(-1),
            UpdatedAt = now.AddDays(-1)
        });
        await f.Db.SaveChangesAsync();

        var service = new OperationsReportService(f.Db);
        var filter = new ReportFilter(today.AddDays(-10), today.AddDays(5), f.FacilityA.FacilityId, null);
        var report = await service.GetSystemReportAsync(filter);

        var metrics = report.Totals;
        // REFUND PENDING không làm tăng nợ của khách!
        Assert.Equal(0m, metrics.Outstanding);

        // Chưa chuyển tiền nên chưa tính vào tiền đã hoàn
        Assert.Equal(0m, metrics.Refunded);

        // Tiền hoàn chờ xử lý được ghi nhận đúng
        Assert.Equal(500000m, metrics.PendingRefunds);
    }

    [Fact]
    public async Task T03_MoveOutDeduction_DeductsFromDeposit_RemainingDepositZeroAfterCompleted()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var now = DateTime.UtcNow;
        var today = OpsRules.TodayLocal;

        var (res, contract) = await f.CreateContractAsync(
            f.FacilityA, f.UnitType1, f.UnitA1,
            rent: 2000000m, deposit: 1000000m, status: "COMPLETED",
            createdAt: now.AddMonths(-3), startDate: today.AddMonths(-3), endDate: today.AddDays(-1));

        // Nộp cọc 1M ban đầu
        f.Db.Payments.Add(new Payment
        {
            ContractId = contract.ContractId,
            ReservationId = res.ReservationId,
            PaymentType = "DEPOSIT",
            Amount = 1000000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "PAID",
            PaidAt = now.AddMonths(-3),
            CreatedAt = now.AddMonths(-3),
            UpdatedAt = now.AddMonths(-3)
        });

        // Trả kho khấu trừ 200k từ cọc, hoàn 800k cho khách
        f.Db.Payments.Add(new Payment
        {
            ContractId = contract.ContractId,
            ReservationId = res.ReservationId,
            PaymentType = "REFUND",
            Amount = 800000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "PAID",
            PaidAt = now,
            TransactionReference = "Hoàn cọc sau trả kho HD-001",
            CreatedAt = now,
            UpdatedAt = now
        });
        await f.Db.SaveChangesAsync();

        var service = new OperationsReportService(f.Db);
        var filter = new ReportFilter(today.AddMonths(-4), today.AddDays(5), f.FacilityA.FacilityId, null);
        var report = await service.GetSystemReportAsync(filter);

        var metrics = report.Totals;
        // Cọc còn giữ = 0 (200k đã khấu trừ cho chi phí, không giữ vô thời hạn như cọc)
        Assert.Equal(0m, metrics.DepositHeld);
        Assert.Equal(800000m, metrics.DepositRefunded);
        Assert.Equal(800000m, metrics.Refunded);
    }

    [Fact]
    public async Task T04_TwoFacilities_TwoUnitTypes_SumsMatchTotals_AndPeriodFiltering()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var now = DateTime.UtcNow;
        var today = OpsRules.TodayLocal;

        var dateMonth1 = today.AddMonths(-1);
        var dateMonth2 = today;

        // Cơ sở A - Loại 1: thu ở Tháng 1
        var (resA, contractA) = await f.CreateContractAsync(
            f.FacilityA, f.UnitType1, f.UnitA1,
            rent: 1500000m, deposit: 1500000m, status: "ACTIVE",
            createdAt: now.AddMonths(-1), startDate: dateMonth1, endDate: dateMonth1.AddMonths(2));

        // Cơ sở B - Loại 2: thu ở Tháng 1
        var (resB, contractB) = await f.CreateContractAsync(
            f.FacilityB, f.UnitType2, f.UnitB1,
            rent: 2500000m, deposit: 2500000m, status: "ACTIVE",
            createdAt: now.AddMonths(-1), startDate: dateMonth1, endDate: dateMonth1.AddMonths(2));

        // Tháng 1 thu tiền
        f.Db.Payments.AddRange(
            new Payment { ContractId = contractA.ContractId, ReservationId = resA.ReservationId, PaymentType = "RENT", Amount = 1500000m, PaymentMethod = "BANK_TRANSFER", Status = "PAID", PaidAt = now.AddMonths(-1), CreatedAt = now.AddMonths(-1), UpdatedAt = now.AddMonths(-1) },
            new Payment { ContractId = contractA.ContractId, ReservationId = resA.ReservationId, PaymentType = "DEPOSIT", Amount = 1500000m, PaymentMethod = "BANK_TRANSFER", Status = "PAID", PaidAt = now.AddMonths(-1), CreatedAt = now.AddMonths(-1), UpdatedAt = now.AddMonths(-1) },
            new Payment { ContractId = contractB.ContractId, ReservationId = resB.ReservationId, PaymentType = "RENT", Amount = 2500000m, PaymentMethod = "BANK_TRANSFER", Status = "PAID", PaidAt = now.AddMonths(-1), CreatedAt = now.AddMonths(-1), UpdatedAt = now.AddMonths(-1) },
            new Payment { ContractId = contractB.ContractId, ReservationId = resB.ReservationId, PaymentType = "DEPOSIT", Amount = 2500000m, PaymentMethod = "BANK_TRANSFER", Status = "PAID", PaidAt = now.AddMonths(-1), CreatedAt = now.AddMonths(-1), UpdatedAt = now.AddMonths(-1) }
        );

        // Tháng 2 hoàn tiền cho hợp đồng A (hoàn cọc 500k)
        f.Db.Payments.Add(
            new Payment { ContractId = contractA.ContractId, ReservationId = resA.ReservationId, PaymentType = "REFUND", Amount = 500000m, PaymentMethod = "BANK_TRANSFER", Status = "PAID", PaidAt = now, TransactionReference = "Hoàn cọc một phần", CreatedAt = now, UpdatedAt = now }
        );
        await f.Db.SaveChangesAsync();

        var service = new OperationsReportService(f.Db);

        // Báo cáo toàn bộ kỳ (Tháng 1 đến Tháng 2)
        var filterAll = new ReportFilter(dateMonth1.AddDays(-5), dateMonth2.AddDays(5), null, null);
        var reportAll = await service.GetSystemReportAsync(filterAll);

        // Kiểm tra Totals khớp tổng các dòng cơ sở
        var sumCollected = reportAll.Facilities.Sum(r => r.Metrics.Collected);
        var sumRefunded = reportAll.Facilities.Sum(r => r.Metrics.Refunded);
        var sumDepositHeld = reportAll.Facilities.Sum(r => r.Metrics.DepositHeld);

        Assert.Equal(sumCollected, reportAll.Totals.Collected);
        Assert.Equal(sumRefunded, reportAll.Totals.Refunded);
        Assert.Equal(sumDepositHeld, reportAll.Totals.DepositHeld);

        // Thu: 1.5M + 1.5M + 2.5M + 2.5M = 8M. Hoàn: 500k.
        Assert.Equal(8000000m, reportAll.Totals.Collected);
        Assert.Equal(500000m, reportAll.Totals.Refunded);

        // Cọc còn giữ: HĐ A còn (1.5M - 500k = 1M) + HĐ B (2.5M) = 3.5M
        Assert.Equal(3500000m, reportAll.Totals.DepositHeld);

        // Kiểm tra lọc theo kỳ: Chỉ lọc Tháng 1
        var filterM1 = new ReportFilter(dateMonth1.AddDays(-5), dateMonth1.AddDays(10), null, null);
        var reportM1 = await service.GetSystemReportAsync(filterM1);
        Assert.Equal(8000000m, reportM1.Totals.Collected);
        Assert.Equal(0m, reportM1.Totals.Refunded); // Chưa có hoàn tiền ở Tháng 1
    }

    [Fact]
    public async Task T05_LegacyRefundWithoutSource_IsExposedAsUnclassified()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var now = DateTime.UtcNow;
        var today = OpsRules.TodayLocal;

        // Đơn đặt chỗ legacy không có khoản thu gốc để chứng minh phân bổ
        var res = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.FacilityA.FacilityId,
            UnitTypeId = f.UnitType1.UnitTypeId,
            StartDate = today.AddDays(-10),
            ExpectedEndDate = today.AddMonths(1),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 1000000m,
            EstimatedAmount = 1000000m,
            RequiredDeposit = 1000000m,
            Status = "CANCELLED",
            PaymentMethod = "BANK_TRANSFER",
            CreatedAt = now.AddDays(-10)
        };
        f.Db.Reservations.Add(res);
        await f.Db.SaveChangesAsync();

        // Khoản hoàn không thể phân bổ qua hồ sơ nguồn
        f.Db.Payments.Add(new Payment
        {
            ReservationId = res.ReservationId,
            PaymentType = "REFUND",
            Amount = 1200000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "PAID",
            PaidAt = now,
            TransactionReference = "Hoàn tiền bù trừ thủ công legacy",
            CreatedAt = now,
            UpdatedAt = now
        });
        await f.Db.SaveChangesAsync();

        var service = new OperationsReportService(f.Db);
        var filter = new ReportFilter(today.AddDays(-5), today.AddDays(5), null, null);
        var report = await service.GetSystemReportAsync(filter);

        var metrics = report.Totals;
        Assert.Equal(1200000m, metrics.Refunded);
        Assert.Equal(1200000m, metrics.UnclassifiedRefunded);
        Assert.Equal(0m, metrics.DepositRefunded);
        Assert.Equal(0m, metrics.RentalRefunded);
    }

    [Fact]
    public async Task T06_ValidateFilter_ThrowsKeyNotFound_ForInvalidFacilityOrUnitType()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var today = OpsRules.TodayLocal;
        var service = new OperationsReportService(f.Db);

        // Cơ sở 9999 không tồn tại
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.GetSystemReportAsync(new ReportFilter(today, today, 9999, null)));

        // Loại kho 9999 không tồn tại
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.GetSystemReportAsync(new ReportFilter(today, today, null, 9999)));

        // GetFacilityContractsAsync với loại kho không tồn tại
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.GetFacilityContractsAsync(f.FacilityA.FacilityId, null, 9999));
    }

    [Fact]
    public async Task T07_OutstandingDebt_ExcludesCancelledReservations_AndExpiredRenewals()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var now = DateTime.UtcNow;
        var today = OpsRules.TodayLocal;

        // 1. Đơn đặt chỗ huỷ có payment FAILED
        var res = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.FacilityA.FacilityId,
            UnitTypeId = f.UnitType1.UnitTypeId,
            StartDate = today.AddDays(5),
            ExpectedEndDate = today.AddMonths(1),
            RentalPeriodMonths = 1,
            QuotedMonthlyRate = 1000000m,
            EstimatedAmount = 1000000m,
            RequiredDeposit = 1000000m,
            Status = "CANCELLED",
            PaymentMethod = "BANK_TRANSFER",
            CreatedAt = now.AddDays(-2)
        };
        f.Db.Reservations.Add(res);
        await f.Db.SaveChangesAsync();

        f.Db.Payments.Add(new Payment
        {
            ReservationId = res.ReservationId,
            PaymentType = "RENT",
            Amount = 1000000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "FAILED",
            CreatedAt = now.AddDays(-2),
            UpdatedAt = now.AddDays(-2)
        });

        // 2. Hợp đồng có renewal đã EXPIRED kèm payment FAILED
        var (resContract, contract) = await f.CreateContractAsync(
            f.FacilityA, f.UnitType1, f.UnitA1,
            rent: 1500000m, deposit: 1500000m, status: "ACTIVE",
            createdAt: now.AddMonths(-1), startDate: today.AddMonths(-1), endDate: today.AddDays(5));

        var renewal = new ContractRenewal
        {
            ContractId = contract.ContractId,
            RenewalPeriodMonths = 1,
            OldMonthlyRate = 1500000m,
            NewMonthlyRate = 1500000m,
            RenewalAmount = 1500000m,
            OldEndDate = contract.EndDate,
            NewEndDate = contract.EndDate.AddMonths(1),
            Status = "EXPIRED",
            RequestedAt = now.AddDays(-2),
            CreatedAt = now.AddDays(-2)
        };
        f.Db.ContractRenewals.Add(renewal);
        await f.Db.SaveChangesAsync();

        f.Db.Payments.Add(new Payment
        {
            ContractId = contract.ContractId,
            ReservationId = resContract.ReservationId,
            RenewalId = renewal.RenewalId,
            PaymentType = "RENEWAL",
            Amount = 1500000m,
            PaymentMethod = "BANK_TRANSFER",
            Status = "FAILED",
            CreatedAt = now.AddDays(-2),
            UpdatedAt = now.AddDays(-2)
        });

        await f.Db.SaveChangesAsync();

        var service = new OperationsReportService(f.Db);
        var filter = new ReportFilter(today.AddMonths(-2), today.AddMonths(1), f.FacilityA.FacilityId, null);
        var report = await service.GetSystemReportAsync(filter);

        // Cả payment của đơn huỷ và renewal hết hạn đều không được tính vào công nợ!
        Assert.Equal(0m, report.Totals.Outstanding);

        // Drill-down hợp đồng cơ sở A cũng không tính payment renewal hết hạn vào công nợ
        var contracts = await service.GetFacilityContractsAsync(f.FacilityA.FacilityId, null, null);
        var cRow = Assert.Single(contracts);
        Assert.Equal(0m, cRow.Outstanding);
    }
}
