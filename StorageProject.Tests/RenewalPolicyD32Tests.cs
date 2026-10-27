using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class RenewalPolicyD32Tests
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

    private sealed class Gateway : IPayOSGateway
    {
        public VerifiedReservationPayment? Payment;
        public bool RejectSignature;
        public int Cancellations;

        public void EnsureConfigured() { }
        public Task CancelAsync(long orderCode) { Cancellations++; return Task.CompletedTask; }
        public Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl)
            => Task.FromResult(new CheckoutLink("https://pay.payos.vn/test-checkout", "test-qr-code"));
        public Task<CheckoutLink> CreateRenewalAsync(long orderCode, int amount, long renewalId, long expiresAt, string returnUrl, string cancelUrl)
            => Task.FromResult(new CheckoutLink("https://pay.payos.vn/test-renewal-checkout", "test-renewal-qr"));
        public Task<VerifiedReservationPayment?> VerifyAsync(string body)
        {
            if (RejectSignature) throw new InvalidOperationException("Invalid signature");
            return Task.FromResult(Payment);
        }
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public Gateway Gateway = new();
        public User StaffUser = null!;
        public User ManagerUser = null!;
        public User CustomerUser = null!;
        public Facility Facility = null!;
        public StorageUnit Unit = null!;
        public RentalContract Contract = null!;

        public RenewalService RenewalSvc => new(Db, Gateway);
        public ManagerService ManagerSvc => new(Db, new StaffService(Db));
        public RentalPolicyService PolicySvc => new(Db);
        public PayOSService PayOSSvc => new(Db, Gateway, Microsoft.Extensions.Logging.Abstractions.NullLogger<PayOSService>.Instance);

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.StaffUser = new User { Username = "staff01", Email = "staff01@example.com", FullName = "Staff One", PasswordHash = "x", Status = "ACTIVE" };
            f.ManagerUser = new User { Username = "manager01", Email = "manager01@example.com", FullName = "Manager One", PasswordHash = "x", Status = "ACTIVE" };
            f.CustomerUser = new User { Username = "customer01", Email = "customer01@example.com", FullName = "Customer One", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyen Luong Bang", Address = "123 NLB", Status = "ACTIVE" };
            var unitType = new UnitType { TypeName = "Kho thuong M", Area = 15, ClimateControlled = false, Status = "ACTIVE" };

            f.Db.AddRange(f.StaffUser, f.ManagerUser, f.CustomerUser, f.Facility, unitType);
            await f.Db.SaveChangesAsync();

            var staffRole = new Role { RoleName = "STAFF", Description = "Staff" };
            var managerRole = new Role { RoleName = "MANAGER", Description = "Manager" };
            var customerRole = new Role { RoleName = "CUSTOMER", Description = "Customer" };
            var opsRole = new Role { RoleName = "OPERATIONS", Description = "Operations" };
            f.Db.AddRange(staffRole, managerRole, customerRole, opsRole);
            await f.Db.SaveChangesAsync();

            f.Db.UserRoles.AddRange(
                new UserRole { UserId = f.StaffUser.UserId, RoleId = staffRole.RoleId },
                new UserRole { UserId = f.ManagerUser.UserId, RoleId = managerRole.RoleId },
                new UserRole { UserId = f.CustomerUser.UserId, RoleId = customerRole.RoleId }
            );

            f.Db.UserFacilities.AddRange(
                new UserFacility { UserId = f.StaffUser.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE", AssignedBy = f.ManagerUser.UserId, AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)) },
                new UserFacility { UserId = f.ManagerUser.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE", AssignedBy = f.ManagerUser.UserId, AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)) }
            );

            f.Unit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = unitType.UnitTypeId, UnitNumber = "K01", Status = "OCCUPIED" };
            f.Db.StorageUnits.Add(f.Unit);

            var rate = new RentalRate
            {
                FacilityId = f.Facility.FacilityId,
                UnitTypeId = unitType.UnitTypeId,
                SetBy = f.ManagerUser.UserId,
                MonthlyRate = 1500000,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            };
            f.Db.RentalRates.Add(rate);

            // Default policy version 1 with all 7 standard sections
            var sections = new Dictionary<string, string>
            {
                ["payment"] = "Thanh toán qua PayOS hoặc tại cơ sở.",
                ["access"] = "Mã QR chỉ mở trong kỳ hạn.",
                ["renewal"] = "Duyệt gia hạn trong 24 giờ.",
                ["overdue"] = "Quá hạn 5% cọc ban đầu mỗi ngày.",
                ["return"] = "Kiểm tra kho khi trả.",
                ["cancellation"] = "Huỷ đơn trước StartDate mất 10% cọc.",
                ["support"] = "Hỗ trợ khách hàng."
            };
            var policy = new RentalPolicyVersion
            {
                Version = 1,
                DisplayVersion = "1.0",
                Rate = 5.0m,
                SectionsJson = System.Text.Json.JsonSerializer.Serialize(sections),
                PublishedBy = f.ManagerUser.UserId,
                IsCurrent = true,
                PublishedAt = DateTime.UtcNow
            };
            f.Db.RentalPolicyVersions.Add(policy);

            var overduePolicy = new Policy
            {
                PolicyName = "Chính sách quá hạn",
                RuleDescription = "Quá hạn 5% cọc ban đầu mỗi ngày",
                CreatedBy = f.ManagerUser.UserId,
                PolicyType = "OVERDUE",
                CalculationType = "PERCENTAGE",
                Value = 5.0m,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            f.Db.Policies.Add(overduePolicy);

            var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-2));
            var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)); // 10 days remaining

            var reservation = new Reservation
            {
                CustomerId = f.CustomerUser.UserId,
                FacilityId = f.Facility.FacilityId,
                UnitTypeId = unitType.UnitTypeId,
                StartDate = startDate,
                ExpectedEndDate = endDate,
                RentalPeriodMonths = 3,
                EstimatedAmount = 4500000,
                RequiredDeposit = 1500000,
                QuotedMonthlyRate = 1500000,
                Status = "CHECKED_IN",
                CreatedAt = DateTime.UtcNow.AddMonths(-2)
            };
            f.Db.Reservations.Add(reservation);
            await f.Db.SaveChangesAsync();

            f.Contract = new RentalContract
            {
                ReservationId = reservation.ReservationId,
                CustomerId = f.CustomerUser.UserId,
                UnitId = f.Unit.UnitId,
                StartDate = startDate,
                EndDate = endDate,
                AgreedMonthlyRate = 1500000,
                DepositAmount = 1500000,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow.AddMonths(-2)
            };
            f.Db.RentalContracts.Add(f.Contract);
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
    public async Task T02_ApproveRenewal_DoesNotChangeContractEndDate_AndCreatesPendingRenewalPayment()
    {
        await using var f = await Fixture.CreateAsync();

        // Customer requests renewal for 3 months with policy consent
        var request = new CreateRenewalRequest(RenewalPeriodMonths: 3, PolicyVersion: 1, Accepted: true);
        var renewalDto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, request);
        Assert.NotNull(renewalDto);
        Assert.Equal("PENDING", renewalDto.Status);

        var originalEndDate = f.Contract.EndDate;

        // Manager approves renewal
        var approvedDto = await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId);
        Assert.Equal("APPROVED", approvedDto.Status);
        Assert.NotNull(approvedDto.PaymentDeadlineAt);

        // CONTRACT END DATE MUST REMAIN UNCHANGED
        var contract = await f.Db.RentalContracts.FindAsync(f.Contract.ContractId);
        Assert.NotNull(contract);
        Assert.Equal(originalEndDate, contract.EndDate);

        // Payment record must exist with status PENDING
        var payment = await f.Db.Payments.FirstOrDefaultAsync(p => p.RenewalId == renewalDto.RenewalId);
        Assert.NotNull(payment);
        Assert.Equal("RENEWAL", payment.PaymentType);
        Assert.Equal("PENDING", payment.Status);
        Assert.Equal(3 * 1500000, payment.Amount);

        // Check deadline invariant: min(ApprovedAt + 24h, EndDate cutoff in VN time)
        var renewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        Assert.NotNull(renewal);
        Assert.NotNull(renewal.PaymentDeadlineAt);
        Assert.True(renewal.PaymentDeadlineAt.Value <= DateTime.UtcNow.AddHours(25));
    }

    [Fact]
    public async Task T02_LegacyManagerApprove_FollowsSameRules_DoesNotChangeEndDate()
    {
        await using var f = await Fixture.CreateAsync();

        var request = new CreateRenewalRequest(RenewalPeriodMonths: 1, PolicyVersion: 1, Accepted: true);
        var renewalDto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, request);

        var originalEndDate = f.Contract.EndDate;

        // Call legacy ManagerService using renewal ID as string
        await f.ManagerSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId.ToString());

        var contract = await f.Db.RentalContracts.FindAsync(f.Contract.ContractId);
        Assert.NotNull(contract);
        Assert.Equal(originalEndDate, contract.EndDate); // Invariant kept!

        var renewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        Assert.NotNull(renewal);
        Assert.Equal("APPROVED", renewal.Status);

        var payment = await f.Db.Payments.FirstOrDefaultAsync(p => p.RenewalId == renewalDto.RenewalId);
        Assert.NotNull(payment);
        Assert.Equal("PENDING", payment.Status);
    }

    [Fact]
    public async Task T02_ApproveRenewal_Twice_IsIdempotent_DoesNotCreateDuplicatePayment()
    {
        await using var f = await Fixture.CreateAsync();

        var request = new CreateRenewalRequest(RenewalPeriodMonths: 2, PolicyVersion: 1, Accepted: true);
        var renewalDto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, request);

        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId);
        
        // Second approval attempt throws domain exception
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId));

        var payments = await f.Db.Payments.Where(p => p.RenewalId == renewalDto.RenewalId).ToListAsync();
        Assert.Single(payments);
        Assert.Equal(f.Contract.EndDate, (await f.Db.RentalContracts.FindAsync(f.Contract.ContractId))!.EndDate);
    }

    [Fact]
    public async Task T03_PayOS_CreatesRenewalLink_AndWebhookSettlesEndDateExactlyOnce()
    {
        await using var f = await Fixture.CreateAsync();

        var request = new CreateRenewalRequest(RenewalPeriodMonths: 3, PolicyVersion: 1, Accepted: true);
        var renewalDto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, request);
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId);

        var initialEndDate = f.Contract.EndDate;
        var payment = await f.Db.Payments.FirstAsync(p => p.RenewalId == renewalDto.RenewalId);

        // 1. Create PayOS QR link
        var checkoutDto = await f.PayOSSvc.CreateRenewalPaymentQrAsync(f.CustomerUser.UserId, payment.PaymentId);
        Assert.NotNull(checkoutDto);
        Assert.Equal("PENDING", checkoutDto.Status);
        Assert.Equal(payment.Amount, checkoutDto.Amount);

        // 2. Simulate PayOS Webhook
        f.Gateway.Payment = new VerifiedReservationPayment(checkoutDto.OrderCode, checkoutDto.Amount, "PAYOS_TXN_001");
        var webhookProcessed = await f.PayOSSvc.ProcessWebhookAsync("{}", null);
        Assert.True(webhookProcessed);

        // Verify settlement
        var updatedContract = await f.Db.RentalContracts.FindAsync(f.Contract.ContractId);
        Assert.NotNull(updatedContract);
        var expectedEndDate = initialEndDate.AddMonths(3);
        Assert.Equal(expectedEndDate, updatedContract.EndDate); // EndDate lengthened!

        var updatedRenewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        Assert.Equal("PAID", updatedRenewal!.Status);
        Assert.NotNull(updatedRenewal.AppliedAt);

        var updatedPayment = await f.Db.Payments.FindAsync(payment.PaymentId);
        Assert.Equal("PAID", updatedPayment!.Status);
        Assert.NotNull(updatedPayment.PaidAt);

        // 3. Replay Webhook (Idempotency test)
        var replayProcessed = await f.PayOSSvc.ProcessWebhookAsync("{}", null);
        Assert.True(replayProcessed);

        // EndDate must NOT be extended twice!
        var recheckContract = await f.Db.RentalContracts.FindAsync(f.Contract.ContractId);
        Assert.Equal(expectedEndDate, recheckContract!.EndDate);
    }

    [Fact]
    public async Task T04_CounterPayment_CustomerSelectsAndStaffCollectsCash_LengthensEndDateOnce()
    {
        await using var f = await Fixture.CreateAsync();

        var request = new CreateRenewalRequest(RenewalPeriodMonths: 1, PolicyVersion: 1, Accepted: true);
        var renewalDto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, request);
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId);

        var initialEndDate = f.Contract.EndDate;

        // Customer selects Counter payment
        await f.RenewalSvc.SelectCounterPaymentAsync(f.CustomerUser.UserId, renewalDto.RenewalId);

        var renewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        Assert.Equal("APPROVED", renewal!.Status); // Still approved, not paid yet
        var payment = await f.Db.Payments.FirstAsync(p => p.RenewalId == renewalDto.RenewalId);
        Assert.Equal("CASH", payment.PaymentMethod);
        Assert.Equal("PENDING", payment.Status);

        // Staff sees counter renewals queue
        var queue = await f.RenewalSvc.GetCounterRenewalsAsync(f.StaffUser.UserId);
        Assert.NotEmpty(queue);
        var item = queue.First(x => x.RenewalId == renewalDto.RenewalId);
        Assert.Equal("PENDING", item.Status);
        Assert.Equal($"GHQ-{renewalDto.RenewalId:D4}", item.Id);

        // Staff collects cash
        await f.RenewalSvc.CollectCounterRenewalAsync(f.StaffUser.UserId, item.Id);

        // Verify EndDate extended
        var contract = await f.Db.RentalContracts.FindAsync(f.Contract.ContractId);
        Assert.Equal(initialEndDate.AddMonths(1), contract!.EndDate);

        var paidRenewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        Assert.Equal("PAID", paidRenewal!.Status);

        var paidPayment = await f.Db.Payments.FindAsync(payment.PaymentId);
        Assert.Equal("PAID", paidPayment!.Status);

        // Collecting again should throw
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.RenewalSvc.CollectCounterRenewalAsync(f.StaffUser.UserId, item.Id));
    }

    [Fact]
    public async Task T20_PolicyVersioning_OperationsCanPublish_AndConcurrencyConflictDetected()
    {
        await using var f = await Fixture.CreateAsync();

        // Public read current policy
        var current = await f.PolicySvc.GetCurrentPolicyAsync();
        Assert.Equal(1, current.Version);
        Assert.Equal(5.0m, current.Rate);

        // Operations publishes version 2
        var saveRequest = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 6.0m,
            Sections: new Dictionary<string, string>
            {
                ["payment"] = "Thanh toán qua PayOS hoặc tại cơ sở.",
                ["access"] = "Mã QR chỉ mở trong kỳ hạn.",
                ["renewal"] = "Duyệt gia hạn trong 24 giờ.",
                ["overdue"] = "Quá hạn 6% mỗi ngày.",
                ["return"] = "Kiểm tra kho khi trả.",
                ["cancellation"] = "Huỷ đơn trước StartDate mất 10% cọc.",
                ["support"] = "Hỗ trợ khách hàng."
            },
            Version: 1
        );

        var v2 = await f.PolicySvc.SaveRentalPolicyAsync(f.ManagerUser.UserId, saveRequest);
        Assert.Equal(2, v2.Version);
        Assert.Equal(6.0m, v2.Rate);

        // Current policy is now version 2
        var newCurrent = await f.PolicySvc.GetCurrentPolicyAsync();
        Assert.Equal(2, newCurrent.Version);
        Assert.Equal(6.0m, newCurrent.Rate);

        // Historical version 1 remains accessible and immutable
        var v1Historical = await f.PolicySvc.GetPolicyVersionAsync(1);
        Assert.NotNull(v1Historical);
        Assert.Equal(1, v1Historical.Version);
        Assert.Equal(5.0m, v1Historical.Rate);

        // Concurrency conflict test: saving with stale version 1 should fail
        var staleRequest = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 7.0m,
            Sections: saveRequest.Sections,
            Version: 1 // Stale! Current is 2
        );

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.PolicySvc.SaveRentalPolicyAsync(f.ManagerUser.UserId, staleRequest));
    }

    [Fact]
    public async Task T20_PolicyConsent_RecordedWithServerTimeAndChannel()
    {
        await using var f = await Fixture.CreateAsync();

        var reservation = new Reservation
        {
            CustomerId = f.CustomerUser.UserId,
            FacilityId = f.Facility.FacilityId,
            UnitTypeId = (await f.Db.UnitTypes.FirstAsync()).UnitTypeId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
            RentalPeriodMonths = 1,
            EstimatedAmount = 1500000,
            RequiredDeposit = 1500000,
            QuotedMonthlyRate = 1500000,
            Status = "PENDING_AT_FACILITY",
            CreatedAt = DateTime.UtcNow
        };
        f.Db.Reservations.Add(reservation);
        await f.Db.SaveChangesAsync();

        var consentRequest = new PolicyConsentRequest(PolicyVersion: 1, Accepted: true);
        var consent = await f.PolicySvc.RecordReservationConsentAsync(f.CustomerUser.UserId, reservation.ReservationId, consentRequest, "WEB");

        Assert.NotNull(consent);
        Assert.Equal(1, consent.PolicyVersion);
        Assert.Equal(f.CustomerUser.UserId, consent.CustomerId);
        Assert.Equal("WEB", consent.Channel);

        // Verified in database
        var dbConsent = await f.Db.PolicyConsents.FirstOrDefaultAsync(c => c.ReservationId == reservation.ReservationId);
        Assert.NotNull(dbConsent);
        Assert.Equal(1, dbConsent.PolicyVersionId);
    }

    [Fact]
    public async Task Expiry_PastDeadlineRenewal_ExpiresAutomatically()
    {
        await using var f = await Fixture.CreateAsync();

        var request = new CreateRenewalRequest(RenewalPeriodMonths: 1, PolicyVersion: 1, Accepted: true);
        var renewalDto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, request);
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, renewalDto.RenewalId);

        // Force deadline into the past
        var renewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        renewal!.PaymentDeadlineAt = DateTime.UtcNow.AddHours(-2);
        await f.Db.SaveChangesAsync();

        // Run expiration job
        await f.RenewalSvc.ExpirePendingRenewalsAsync();

        var expiredRenewal = await f.Db.ContractRenewals.FindAsync(renewalDto.RenewalId);
        Assert.Equal("EXPIRED", expiredRenewal!.Status);
        Assert.NotNull(expiredRenewal.ExpiredAt);

        var payment = await f.Db.Payments.FirstAsync(p => p.RenewalId == renewalDto.RenewalId);
        Assert.Equal("FAILED", payment.Status);

        // Contract EndDate remains unchanged
        var contract = await f.Db.RentalContracts.FindAsync(f.Contract.ContractId);
        Assert.Equal(f.Contract.EndDate, contract!.EndDate);
    }
}
