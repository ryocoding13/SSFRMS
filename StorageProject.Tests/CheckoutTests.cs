using Microsoft.Extensions.Configuration;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class CheckoutTests
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
    private sealed class Gateway : IPayOSGateway
    {
        public VerifiedReservationPayment? Payment = new(12345, 4000000);
        public bool RejectSignature;
        public bool FailCancel;
        public int Cancellations;
        public void EnsureConfigured() { }
        public Task CancelAsync(long id) { if (FailCancel) throw new InvalidOperationException(); Cancellations++; return Task.CompletedTask; }
        public Task<CheckoutLink> CreateAsync(long code, int amount, long id, long expiry, string ret, string cancel) => Task.FromResult(new CheckoutLink("https://pay.payos.vn/test", "qr"));
        public Task<VerifiedReservationPayment?> VerifyAsync(string body) {
            if (RejectSignature) throw new InvalidOperationException("bad signature");
            return Task.FromResult(Payment);
        }
    }
    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public Gateway Gateway = new();
        public Reservation Order = null!;
        public PayOSService PayOS => new(Db, Gateway, NullLogger<PayOSService>.Instance);
        public static async Task<Fixture> Create()
        {
            var f = new Fixture(); await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();
            var user = new User { Username = "test", Email = "test@example.com", FullName = "Test", PasswordHash = "x" };
            var customer = new User { Username = "customer", Email = "customer@example.com", FullName = "Customer", PasswordHash = "x" };
            var facility = new Facility { Name = "Test", Address = "Test", Status = "ACTIVE" };
            var type = new UnitType { TypeName = "Test", Area = 10, Status = "ACTIVE" };
            f.Db.AddRange(user, customer, facility, type); await f.Db.SaveChangesAsync();
            f.Db.UserFacilities.Add(new UserFacility { UserId = user.UserId, FacilityId = facility.FacilityId,
                AssignedBy = user.UserId, AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), Status = "ACTIVE" });
            f.Db.StorageUnits.Add(new StorageUnit { FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId,
                UnitNumber = "K01", Status = "AVAILABLE" });
            f.Order = new Reservation { CustomerId = customer.UserId, FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(3)),
                RentalPeriodMonths = 3, EstimatedAmount = 3000000, RequiredDeposit = 1000000, QuotedMonthlyRate = 1000000,
                Status = "PENDING_PAYMENT", OrderCode = 12345, ExpiresAt = DateTime.UtcNow.AddMinutes(15), CreatedAt = DateTime.UtcNow };
            f.Db.Reservations.Add(f.Order); await f.Db.SaveChangesAsync(); return f;
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await Connection.DisposeAsync(); }
    }

    [Fact] public async Task WrongAmountDoesNotConfirmOrWriteMoney() {
        await using var f = await Fixture.Create(); f.Gateway.Payment = new(12345, 1);
        Assert.False(await f.PayOS.ProcessWebhookAsync("{}", null));
        Assert.Empty(await f.Db.Payments.ToListAsync()); Assert.Equal("PENDING_PAYMENT", f.Order.Status);
    }
    [Fact] public async Task InvalidSignatureAndUnknownOrderDoNotWriteMoney() {
        await using var f = await Fixture.Create(); f.Gateway.RejectSignature = true;
        Assert.False(await f.PayOS.ProcessWebhookAsync("{}", null)); f.Gateway.RejectSignature = false; f.Gateway.Payment = new(999, 4000000);
        Assert.False(await f.PayOS.ProcessWebhookAsync("{}", null)); Assert.Empty(await f.Db.Payments.ToListAsync());
    }
    [Fact] public async Task DuplicateWebhookAndAllocationKeepTwoReceiptRows() {
        await using var f = await Fixture.Create();
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null)); Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        var before = await f.Db.Payments.OrderBy(p => p.PaymentId).Select(p => p.PaymentId).ToListAsync(); Assert.Equal(2, before.Count);
        Assert.Equal(4000000, (await f.Db.Payments.ToListAsync()).Sum(p => p.Amount));
        Assert.Single(await f.Db.UnitAssignments.ToListAsync());
        await ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, f.Order.ReservationId, "K01", default);
        await ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, f.Order.ReservationId, "K01", default);
        Assert.Equal(before, await f.Db.Payments.OrderBy(p => p.PaymentId).Select(p => p.PaymentId).ToListAsync());
        Assert.All(await f.Db.Payments.ToListAsync(), p => Assert.NotNull(p.ContractId));
        Assert.Single(await f.Db.RentalContracts.ToListAsync()); Assert.Single(await f.Db.UnitAssignments.ToListAsync());
    }
    [Fact] public async Task CashCollectionIsIdempotentAndLatePayosNeedsReview() {
        await using var f = await Fixture.Create(); f.Order.CheckoutUrl = "https://pay.payos.vn/test"; await f.Db.SaveChangesAsync();
        await f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId); Assert.Equal(1, f.Gateway.Cancellations);
        await ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, f.Order.ReservationId, "K01", default);
        Assert.Empty(await f.Db.Payments.ToListAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => new StaffService(f.Db).CompleteHandoverAsync(1, "BG-0001", new CompleteHandoverRequest { UnlockMethod = "CARD" }));
        var staff = new StaffService(f.Db); await staff.ConfirmPaymentAsync(1, "SS-0001"); await staff.ConfirmPaymentAsync(1, "SS-0001");
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null)); Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        Assert.Equal(2, await f.Db.Payments.CountAsync()); Assert.All(await f.Db.Payments.ToListAsync(), p => Assert.Equal("CASH", p.PaymentMethod));
        Assert.Single(await f.Db.ActivityLogs.Where(l => l.Action == "PAYMENT_REVIEW_REQUIRED").ToListAsync());
    }
    [Fact] public async Task FailedCancellationDoesNotSwitchMethod() {
        await using var f = await Fixture.Create(); f.Order.CheckoutUrl = "https://pay.payos.vn/test"; await f.Db.SaveChangesAsync(); f.Gateway.FailCancel = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId));
        Assert.Equal("PAYOS", f.Order.PaymentMethod); Assert.Equal("PENDING_PAYMENT", f.Order.Status);
    }
    [Fact] public async Task OtherCustomerCannotSwitchAndExpiredHoldCannotBeCollected() {
        await using var f = await Fixture.Create(); await Assert.ThrowsAsync<InvalidOperationException>(() => f.PayOS.PayAtFacilityAsync(1, f.Order.ReservationId));
        await f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId); f.Order.ExpiresAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => new StaffService(f.Db).ConfirmPaymentAsync(1, "SS-0001"));
        Assert.Empty(await f.Db.Payments.ToListAsync());
    }
    [Fact] public async Task ReservedUnitBecomesOccupiedOnStartDateOnly() {
        await using var f = await Fixture.Create();
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        var unit = await f.Db.StorageUnits.SingleAsync();
        Assert.Equal("RESERVED", unit.Status);
        Assert.Equal(0, await UnitStartActivation.ActivateAsync(f.Db)); // chưa đến StartDate
        Assert.Equal("RESERVED", unit.Status);
        var contract = await f.Db.RentalContracts.SingleAsync();
        contract.StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        await f.Db.SaveChangesAsync();
        Assert.Equal(1, await UnitStartActivation.ActivateAsync(f.Db));
        Assert.Equal("OCCUPIED", unit.Status);
        Assert.Equal(0, await UnitStartActivation.ActivateAsync(f.Db)); // chạy lại không ghi thêm
        Assert.Single(await f.Db.UnitStatusHistories.Where(h => h.NewStatus == "OCCUPIED").ToListAsync());
    }
    [Fact] public async Task UnitMaintenanceWritesHistoryAndRefusesOccupiedUnit() {
        await using var f = await Fixture.Create(); var staff = new StaffService(f.Db);
        await Assert.ThrowsAsync<ArgumentException>(() => staff.UpdateUnitStatusAsync(1, "K01", new UpdateUnitStatusRequest { Status = "MAINTENANCE" }));
        await staff.UpdateUnitStatusAsync(1, "K01", new UpdateUnitStatusRequest { Status = "MAINTENANCE", Reason = "Sửa cửa" });
        await staff.UpdateUnitStatusAsync(1, "K01", new UpdateUnitStatusRequest { Status = "AVAILABLE", Reason = "Đã sửa xong" });
        Assert.Equal(2, await f.Db.UnitStatusHistories.CountAsync());
        var u = await f.Db.StorageUnits.SingleAsync(); u.Status = "OCCUPIED"; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => staff.UpdateUnitStatusAsync(1, "K01", new UpdateUnitStatusRequest { Status = "AVAILABLE", Reason = "Sai luồng" }));
        Assert.Equal("OCCUPIED", u.Status);
    }

    [Fact] public async Task CashHoldExpiryReleasesUnitAndCancelsDraft() {
        await using var f = await Fixture.Create();
        await f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId);
        await ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, f.Order.ReservationId, "K01", default);
        f.Order.ExpiresAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        await CashHoldExpiry.ExpireAsync(f.Db);
        Assert.Equal("EXPIRED", f.Order.Status);
        Assert.Equal("AVAILABLE", (await f.Db.StorageUnits.SingleAsync()).Status);
        Assert.Equal("CANCELLED", (await f.Db.RentalContracts.SingleAsync()).Status);
        Assert.Empty(await f.Db.Payments.ToListAsync());
    }
    [Fact] public async Task PaidOrderCannotSwitchToCashAndPayosCannotBeConfirmedAtCounter() {
        await using var f = await Fixture.Create();
        await Assert.ThrowsAsync<InvalidOperationException>(() => new StaffService(f.Db).ConfirmPaymentAsync(1, "SS-0001"));
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId));
        Assert.Equal(2, await f.Db.Payments.CountAsync());
    }
    [Fact] public async Task SecondAllocationCannotTakeAlreadyHeldUnit() {
        await using var f = await Fixture.Create();
        await f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId);
        await ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, f.Order.ReservationId, "K01", default);
        var other = new Reservation { CustomerId = f.Order.CustomerId, FacilityId = f.Order.FacilityId, UnitTypeId = f.Order.UnitTypeId,
            StartDate = f.Order.StartDate, ExpectedEndDate = f.Order.ExpectedEndDate, RentalPeriodMonths = 3,
            Status = "PENDING_AT_FACILITY", PaymentMethod = "AT_FACILITY", ExpiresAt = DateTime.UtcNow.AddDays(1) };
        f.Db.Reservations.Add(other); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, other.ReservationId, "K01", default));
        Assert.Single(await f.Db.UnitAssignments.ToListAsync());
    }
    [Fact] public async Task ClientAmountOverrideIsRejected() {
        await using var f = await Fixture.Create();
        var request = new StorageProject.Core.DTOs.Payment.CreatePayOSQrRequest(null,null,null,f.Order.ReservationId,null,null,1,null,null);
        await Assert.ThrowsAsync<ArgumentException>(() => f.PayOS.CreatePaymentQrAsync(f.Order.CustomerId, request));
        Assert.Empty(await f.Db.Payments.ToListAsync());
    }
    [Fact] public async Task RealSdkRejectsInvalidSignature() {
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["PayOS:ClientId"] = "test-client", ["PayOS:ApiKey"] = "test-key", ["PayOS:ChecksumKey"] = "test-checksum"
        }).Build();
        var gateway = new SdkPayOSGateway(config);
        await Assert.ThrowsAnyAsync<Exception>(() => gateway.VerifyAsync("{\"code\":\"00\",\"success\":true,\"data\":{\"orderCode\":12345,\"amount\":4000000,\"code\":\"00\"},\"signature\":\"invalid\"}"));
    }

    [Fact] public void SqlServerModelMatchesMigrationSnapshot() {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=true;TrustServerCertificate=true").Options);
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact] public async Task CashPaymentVerificationAndHandoverUseTheSameReceipts() {
        await using var f = await Fixture.Create();
        await f.PayOS.PayAtFacilityAsync(f.Order.CustomerId, f.Order.ReservationId);
        await ReservationAllocation.AllocateAsync(f.Db, 1, f.Order.FacilityId, f.Order.ReservationId, "K01", default);
        var staff = new StaffService(f.Db);
        await staff.ConfirmPaymentAsync(1, "SS-0001");
        await staff.VerifyCustomerAsync(1, "XM-0001", new VerifyCustomerRequest { DocType = "CCCD", DocNumber = "123456789012", PhotoMatched = true, InfoMatched = true });
        var board = await staff.GetStaffBoardAsync(1);
        Assert.Equal("DONE", Assert.Single(board.Verifications).Status);
        await staff.CompleteHandoverAsync(1, "BG-0001", new CompleteHandoverRequest { UnlockMethod = "CARD" });
        Assert.Equal("ACTIVE", (await f.Db.RentalContracts.SingleAsync()).Status);
        Assert.Equal("UNIT_ASSIGNED", f.Order.Status);
        Assert.Equal(2, await f.Db.Payments.CountAsync());
        Assert.Equal("DONE", Assert.Single((await staff.GetStaffBoardAsync(1)).Handovers).Status);
    }

    private static AccessService Access(AppDbContext db) => new(db, new StorageProject.Core.DTOs.Access.AccessQrOptions("test-access-secret-at-least-thirty-two-characters"));

    [Fact] public async Task PaidOrderAutomaticallyIssuesQrAndPinBeforeKeyReceiptButRejectsEarlyUse() {
        await using var f = await Fixture.Create();
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        var c = await f.Db.RentalContracts.Include(c => c.HandoverRecord).SingleAsync();
        Assert.Equal("ACTIVE", c.Status); Assert.Equal("SCHEDULED", c.HandoverRecord!.Status);
        var access = Access(f.Db); var qr = await access.GetQrAsync(f.Order.CustomerId, c.ContractId);
        Assert.Matches(@"^\d{6}$", qr.BackupCode); Assert.Equal(f.Order.StartDate.ToString("yyyy-MM-dd"), qr.ValidFrom);
        Assert.Equal("DENIED", (await access.ScanAsync(qr.Code, "test")).Result);
        c.StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)); await f.Db.SaveChangesAsync();
        Assert.Equal("OPEN", (await access.ScanAsync(qr.Code, "test")).Result);
        Assert.Equal("OPEN", (await access.ScanAsync(qr.BackupCode, "test", unitNumber: "K01")).Result);
        Assert.Equal("DENIED", (await access.ScanAsync(qr.BackupCode, "test")).Result);
        Assert.Equal("DENIED", (await access.ScanAsync(qr.Code, "test", unitNumber: "OTHER")).Result);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => access.GetQrAsync(1, c.ContractId));
    }

    [Fact] public async Task ContractEndIsExclusiveAndReturnedContractNeverReactivatedByPaymentReplay() {
        await using var f = await Fixture.Create(); await f.PayOS.ProcessWebhookAsync("{}", null);
        var c = await f.Db.RentalContracts.SingleAsync(); var qr = await Access(f.Db).GetQrAsync(f.Order.CustomerId, c.ContractId);
        c.StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)).AddDays(-1);
        c.EndDate = c.StartDate.AddDays(1); await f.Db.SaveChangesAsync();
        Assert.Equal("DENIED", (await Access(f.Db).ScanAsync(qr.Code, "test")).Result);
        c.Status = "COMPLETED"; await f.Db.SaveChangesAsync();
        await f.PayOS.ProcessWebhookAsync("{}", null);
        Assert.Equal("COMPLETED", (await f.Db.RentalContracts.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.AccessCredentials.CountAsync());
    }

    [Fact] public async Task ReissueQrAndPinIndependentlyInvalidatesOnlyOldCodeAndReplayKeepsRevocation() {
        await using var f = await Fixture.Create(); await f.PayOS.ProcessWebhookAsync("{}", null);
        var c = await f.Db.RentalContracts.SingleAsync(); c.StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)); await f.Db.SaveChangesAsync();
        var access = Access(f.Db); var before = await access.GetQrAsync(f.Order.CustomerId, c.ContractId);
        var staff = new StaffService(f.Db);
        await staff.ReissueCredentialAsync(1, new ReissueCredentialRequest { UnitCode = "K01", CredentialType = "QR", Reason = "Mất mã" });
        var afterQr = await access.GetQrAsync(f.Order.CustomerId, c.ContractId);
        Assert.NotEqual(before.Code, afterQr.Code); Assert.Equal(before.BackupCode, afterQr.BackupCode);
        Assert.Equal("DENIED", (await access.ScanAsync(before.Code, "test")).Result);
        await staff.ReissueCredentialAsync(1, new ReissueCredentialRequest { UnitCode = "K01", CredentialType = "PIN", Reason = "Đổi PIN" });
        var afterPin = await access.GetQrAsync(f.Order.CustomerId, c.ContractId);
        Assert.Equal(afterQr.Code, afterPin.Code); Assert.NotEqual(afterQr.BackupCode, afterPin.BackupCode);
        Assert.Equal("DENIED", (await access.ScanAsync(before.BackupCode, "test", unitNumber: "K01")).Result);
        c.Status = "RETURN_PENDING"; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => access.GetQrAsync(f.Order.CustomerId, c.ContractId));
        Assert.Equal("DENIED", (await access.ScanAsync(afterQr.Code, "test")).Result);
    }

    [Fact] public async Task KeyReceiptNeedsVerificationAndNeverChangesContractOrElectronicCredentials() {
        await using var f = await Fixture.Create(); await f.PayOS.ProcessWebhookAsync("{}", null);
        var c = await f.Db.RentalContracts.SingleAsync(); var access = Access(f.Db);
        var before = await access.GetQrAsync(f.Order.CustomerId, c.ContractId); var activated = c.ActivatedAt;
        var ops = new FacilityOpsService(f.Db); var actor = new StorageProject.Core.DTOs.FacilityOps.OpsActor(1, false);
        await Assert.ThrowsAsync<InvalidOperationException>(() => ops.RecordKeyReceiptAsync(actor, "BG-0001"));
        await ops.VerifyCustomerAsync(actor, "XM-0001", new("CCCD", "123456789012", true, true));
        await ops.RecordKeyReceiptAsync(actor, "BG-0001"); await ops.RecordKeyReceiptAsync(actor, "BG-0001");
        Assert.Equal(activated, c.ActivatedAt); Assert.Equal("ACTIVE", c.Status);
        Assert.Equal(before, await access.GetQrAsync(f.Order.CustomerId, c.ContractId));
        Assert.Single(await f.Db.AccessCredentials.Where(c => c.CredentialType == "KEY").ToListAsync());
        Assert.Equal(2, await f.Db.Payments.CountAsync());
    }

    [Fact] public async Task NoAvailableUnitKeepsRealReceiptsAndReplayedWebhookRecoversOnce() {
        await using var f = await Fixture.Create(); var unit = await f.Db.StorageUnits.SingleAsync();
        unit.Status = "MAINTENANCE"; await f.Db.SaveChangesAsync();
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null)); Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        Assert.Equal(2, await f.Db.Payments.CountAsync()); Assert.Empty(await f.Db.RentalContracts.ToListAsync());
        Assert.Single(await f.Db.ActivityLogs.Where(l => l.Action == "AUTO_ALLOCATION_PENDING").ToListAsync());
        unit.Status = "AVAILABLE"; await f.Db.SaveChangesAsync();
        Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null)); Assert.True(await f.PayOS.ProcessWebhookAsync("{}", null));
        Assert.Single(await f.Db.RentalContracts.ToListAsync()); Assert.Single(await f.Db.UnitAssignments.ToListAsync());
        Assert.All(await f.Db.Payments.ToListAsync(), p => Assert.NotNull(p.ContractId));
    }

    [Fact] public async Task OpenMaintenanceExcludesUnitEvenIfStatusSaysAvailable() {
        await using var f = await Fixture.Create(); var unit = await f.Db.StorageUnits.SingleAsync();
        f.Db.MaintenanceRequests.Add(new MaintenanceRequest { UnitId = unit.UnitId, ReportedBy = 1,
            MaintenanceType = "REPAIR", IssueDescription = "Cửa hỏng", Status = "OPEN", CreatedAt = DateTime.UtcNow });
        await f.Db.SaveChangesAsync(); await f.PayOS.ProcessWebhookAsync("{}", null);
        Assert.Empty(await f.Db.RentalContracts.ToListAsync()); Assert.Equal(2, await f.Db.Payments.CountAsync());
    }
}
