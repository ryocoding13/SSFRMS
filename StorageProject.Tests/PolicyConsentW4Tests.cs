using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class PolicyConsentW4Tests
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

    private sealed class MockGateway : IPayOSGateway
    {
        public void EnsureConfigured() { }
        public Task CancelAsync(long orderCode) => Task.CompletedTask;
        public Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl)
            => Task.FromResult(new CheckoutLink("https://payos.vn/test-url", "test-qr"));
        public Task<CheckoutLink> CreateRenewalAsync(long orderCode, int amount, long renewalId, long expiresAt, string returnUrl, string cancelUrl)
            => Task.FromResult(new CheckoutLink("https://payos.vn/test-url", "test-qr"));
        public Task<VerifiedReservationPayment?> VerifyAsync(string body) => Task.FromResult<VerifiedReservationPayment?>(null);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Customer = null!;
        public User Staff = null!;
        public Facility Facility = null!;
        public UnitType UnitType = null!;
        public StorageUnit Unit = null!;
        public RentalPolicyVersion PolicyV1 = null!;

        public async Task InitAsync()
        {
            await Connection.OpenAsync();
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(Connection)
                .Options;

            Db = new TestDb(options);
            await Db.Database.EnsureCreatedAsync();

            Customer = new User
            {
                Username = "customer_w4",
                Email = "customer_w4@storage.vn",
                PasswordHash = "hash",
                FullName = "Nguyễn Văn Khách",
                Status = "ACTIVE"
            };
            Staff = new User
            {
                Username = "staff_w4",
                Email = "staff_w4@storage.vn",
                PasswordHash = "hash",
                FullName = "Trần Nhân Viên",
                Status = "ACTIVE"
            };
            Db.Users.AddRange(Customer, Staff);
            await Db.SaveChangesAsync();

            Facility = new Facility
            {
                Name = "SafeSpace Cơ Sở W4",
                Address = "123 Đường Test",
                Status = "ACTIVE"
            };
            Db.Facilities.Add(Facility);
            await Db.SaveChangesAsync();

            Db.UserFacilities.Add(new UserFacility
            {
                UserId = Staff.UserId,
                FacilityId = Facility.FacilityId,
                AssignedBy = Staff.UserId,
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
                CreatedAt = DateTime.UtcNow,
                Status = "ACTIVE"
            });
            await Db.SaveChangesAsync();

            UnitType = new UnitType
            {
                TypeName = "Kho Tiêu Chuẩn 15m2",
                Area = 15m,
                Status = "ACTIVE"
            };
            Db.UnitTypes.Add(UnitType);
            await Db.SaveChangesAsync();

            Unit = new StorageUnit
            {
                FacilityId = Facility.FacilityId,
                UnitTypeId = UnitType.UnitTypeId,
                UnitNumber = "W4-01",
                Status = "AVAILABLE"
            };
            Db.StorageUnits.Add(Unit);

            Db.RentalRates.Add(new RentalRate
            {
                FacilityId = Facility.FacilityId,
                UnitTypeId = UnitType.UnitTypeId,
                SetBy = Staff.UserId,
                CreatedAt = DateTime.UtcNow,
                MonthlyRate = 1_500_000m,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                Status = "ACTIVE"
            });

            PolicyV1 = new RentalPolicyVersion
            {
                Version = 1,
                DisplayVersion = "11/2026",
                Rate = 5.0m,
                SectionsJson = "{}",
                PublishedBy = Staff.UserId,
                PublishedAt = DateTime.UtcNow,
                IsCurrent = true
            };
            Db.RentalPolicyVersions.Add(PolicyV1);

            await Db.SaveChangesAsync();
        }

        public async Task<Reservation> CreateReservationAsync(string paymentMethod = "PAYOS")
        {
            var res = new Reservation
            {
                CustomerId = Customer.UserId,
                FacilityId = Facility.FacilityId,
                UnitTypeId = UnitType.UnitTypeId,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
                RentalPeriodMonths = 1,
                QuotedMonthlyRate = 1_500_000m,
                EstimatedAmount = 1_500_000m,
                RequiredDeposit = 1_500_000m,
                Status = paymentMethod == "PAYOS" ? "PENDING_PAYMENT" : "PENDING_AT_FACILITY",
                PaymentMethod = paymentMethod,
                ExpiresAt = DateTime.UtcNow.AddMinutes(30),
                CreatedAt = DateTime.UtcNow
            };
            Db.Reservations.Add(res);
            await Db.SaveChangesAsync();
            return res;
        }

        public ValueTask DisposeAsync()
        {
            Db.Dispose();
            Connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    [Fact]
    public async Task RecordReservationConsent_IsIdempotent_DoesNotCreateDuplicate()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new RentalPolicyService(f.Db);
        var res = await f.CreateReservationAsync();

        var request = new PolicyConsentRequest(PolicyVersion: 1, Accepted: true);

        var first = await service.RecordReservationConsentAsync(f.Customer.UserId, res.ReservationId, request);
        Assert.Equal(1, first.PolicyVersion);

        // Gọi lần 2 với cùng request
        var second = await service.RecordReservationConsentAsync(f.Customer.UserId, res.ReservationId, request);
        Assert.Equal(first.ConsentId, second.ConsentId);

        var count = await f.Db.PolicyConsents.CountAsync(c => c.ReservationId == res.ReservationId);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task CreatePaymentQr_WithoutConsent_ThrowsInvalidOperationException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("PAYOS");

        var payosService = new PayOSService(f.Db, new MockGateway(), null!);

        var request = new CreatePayOSQrRequest(StorageUnitId: null, FacilityId: null, UnitTypeId: null, ReservationId: res.ReservationId, RentalPeriodMonths: null, StartDate: null, Amount: null, CancelUrl: null, ReturnUrl: null);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            payosService.CreatePaymentQrAsync(f.Customer.UserId, request));
        Assert.Contains("hoàn tất chấp thuận chính sách", ex.Message);
    }

    [Fact]
    public async Task PayAtFacility_WithoutConsent_ThrowsInvalidOperationException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("PAYOS");

        var payosService = new PayOSService(f.Db, new MockGateway(), null!);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            payosService.PayAtFacilityAsync(f.Customer.UserId, res.ReservationId));
        Assert.Contains("hoàn tất chấp thuận chính sách", ex.Message);
    }

    [Fact]
    public async Task ConfirmPayment_StaffCannotConsentOnBehalfOfCustomer_ThrowsInvalidOperationException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("AT_FACILITY");

        var staffService = new StaffService(f.Db);

        // Nhân viên cố xác nhận thu tiền khi khách chưa chấp thuận chính sách
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            staffService.ConfirmPaymentAsync(f.Staff.UserId, $"SS-{res.ReservationId:D4}"));
        Assert.Contains("chưa hoàn tất chấp thuận chính sách", ex.Message);
    }

    [Fact]
    public async Task RequestRenewal_WithoutConsent_ThrowsArgumentException()
    {
        await using var f = new Fixture();
        await f.InitAsync();

        var res = await f.CreateReservationAsync();
        var contract = new RentalContract
        {
            ReservationId = res.ReservationId,
            CustomerId = f.Customer.UserId,
            UnitId = f.Unit.UnitId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(15)),
            AgreedMonthlyRate = 1_500_000m,
            DepositAmount = 1_500_000m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };
        f.Db.RentalContracts.Add(contract);
        await f.Db.SaveChangesAsync();

        var renewalService = new RenewalService(f.Db, new MockGateway());

        // Thiếu PolicyVersion và Accepted
        var req = new CreateRenewalRequest(RenewalPeriodMonths: 1, PolicyVersion: null, Accepted: null);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            renewalService.RequestRenewalAsync(f.Customer.UserId, contract.ContractId, req));
        Assert.Contains("phải đồng ý với chính sách", ex.Message);
    }

    [Fact]
    public async Task ContractProvisioning_LinksPolicyConsentsFromReservationToContract()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("PAYOS");

        // Ghi nhận consent của khách
        var policyService = new RentalPolicyService(f.Db);
        await policyService.RecordReservationConsentAsync(f.Customer.UserId, res.ReservationId, new PolicyConsentRequest(PolicyVersion: 1, Accepted: true));

        // Thanh toán thành công
        await ReservationSettlement.RecordAsync(f.Db, res, "PAYMENT_GATEWAY", "PAYOS:12345", null, default);
        await f.Db.SaveChangesAsync();

        // Cấp hợp đồng
        var issued = await ContractProvisioning.EnsureAsync(f.Db, res, null, default);
        Assert.True(issued);

        var contract = await f.Db.RentalContracts.FirstOrDefaultAsync(c => c.ReservationId == res.ReservationId);
        Assert.NotNull(contract);

        var consent = await f.Db.PolicyConsents.FirstOrDefaultAsync(c => c.ReservationId == res.ReservationId);
        Assert.NotNull(consent);
        Assert.Equal(contract.ContractId, consent.ContractId);
    }

    [Fact]
    public async Task GetContractDetailAsync_ReturnsPolicyConsent_WhenReservationHadConsent()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("PAYOS");

        var policyService = new RentalPolicyService(f.Db);
        await policyService.RecordReservationConsentAsync(f.Customer.UserId, res.ReservationId, new PolicyConsentRequest(PolicyVersion: 1, Accepted: true));

        await ReservationSettlement.RecordAsync(f.Db, res, "PAYMENT_GATEWAY", "PAYOS:12345", null, default);
        await f.Db.SaveChangesAsync();
        await ContractProvisioning.EnsureAsync(f.Db, res, null, default);

        var contract = await f.Db.RentalContracts.FirstAsync(c => c.ReservationId == res.ReservationId);
        var contractService = new ContractService(f.Db);
        var detail = await contractService.GetContractDetailAsync(f.Customer.UserId, contract.ContractId);

        Assert.NotNull(detail);
        Assert.NotNull(detail.PolicyConsent);
        Assert.Equal(1, detail.PolicyConsent.PolicyVersion);
        Assert.Equal(f.Customer.UserId, detail.PolicyConsent.CustomerId);
        Assert.Equal("WEB_CUSTOMER", detail.PolicyConsent.Channel);
        Assert.True(detail.PolicyConsent.ConsentId > 0);
    }

    [Fact]
    public async Task GetContractDetailAsync_InitialConsentExcludesRenewalConsent()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("PAYOS");

        var policyService = new RentalPolicyService(f.Db);
        await policyService.RecordReservationConsentAsync(f.Customer.UserId, res.ReservationId, new PolicyConsentRequest(PolicyVersion: 1, Accepted: true));

        await ReservationSettlement.RecordAsync(f.Db, res, "PAYMENT_GATEWAY", "PAYOS:12345", null, default);
        await f.Db.SaveChangesAsync();
        await ContractProvisioning.EnsureAsync(f.Db, res, null, default);

        var contract = await f.Db.RentalContracts.FirstAsync(c => c.ReservationId == res.ReservationId);

        // Tạo thêm policy version 2 và một renewal consent gắn với hợp đồng này
        var policyV2 = new RentalPolicyVersion
        {
            Version = 2,
            DisplayVersion = "12/2026",
            Rate = 6.0m,
            SectionsJson = "{}",
            PublishedBy = f.Staff.UserId,
            PublishedAt = DateTime.UtcNow,
            IsCurrent = true
        };
        f.Db.RentalPolicyVersions.Add(policyV2);
        await f.Db.SaveChangesAsync();

        var renewal = new ContractRenewal
        {
            ContractId = contract.ContractId,
            OldEndDate = contract.EndDate,
            NewEndDate = contract.EndDate.AddMonths(1),
            RenewalPeriodMonths = 1,
            OldMonthlyRate = contract.AgreedMonthlyRate,
            NewMonthlyRate = contract.AgreedMonthlyRate,
            RenewalAmount = contract.AgreedMonthlyRate,
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow,
            PolicyVersion = 2,
            AcceptedAt = DateTime.UtcNow.AddMinutes(5)
        };
        f.Db.ContractRenewals.Add(renewal);
        await f.Db.SaveChangesAsync();

        // Ghi nhận consent của lần gia hạn (RenewalId != null, AcceptedAt muộn hơn)
        f.Db.PolicyConsents.Add(new PolicyConsent
        {
            CustomerId = f.Customer.UserId,
            PolicyVersionId = policyV2.PolicyVersionId,
            RenewalId = renewal.RenewalId,
            ContractId = contract.ContractId,
            AcceptedAt = DateTime.UtcNow.AddMinutes(5),
            Channel = "WEB_CUSTOMER"
        });
        await f.Db.SaveChangesAsync();

        var contractService = new ContractService(f.Db);
        var detail = await contractService.GetContractDetailAsync(f.Customer.UserId, contract.ContractId);

        Assert.NotNull(detail);
        Assert.NotNull(detail.PolicyConsent);
        // Bằng chứng của mục ký ban đầu PHẢI là version 1 của đơn gốc, không được lấy version 2 của renewal
        Assert.Equal(1, detail.PolicyConsent.PolicyVersion);
    }

    [Fact]
    public async Task GetContractDetailAsync_WithoutConsent_ReturnsNullPolicyConsent()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var res = await f.CreateReservationAsync("PAYOS");

        // Không tạo consent
        await ReservationSettlement.RecordAsync(f.Db, res, "PAYMENT_GATEWAY", "PAYOS:12345", null, default);
        await f.Db.SaveChangesAsync();
        await ContractProvisioning.EnsureAsync(f.Db, res, null, default);

        var contract = await f.Db.RentalContracts.FirstAsync(c => c.ReservationId == res.ReservationId);
        var contractService = new ContractService(f.Db);
        var detail = await contractService.GetContractDetailAsync(f.Customer.UserId, contract.ContractId);

        Assert.NotNull(detail);
        Assert.Null(detail.PolicyConsent);
    }
}
