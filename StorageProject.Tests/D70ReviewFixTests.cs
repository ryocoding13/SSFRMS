using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// D70 (27/11/2026) — sửa các lỗi rà soát:
/// gia hạn / chọn ô khác không lấy ô khách khác đang giữ chỗ thanh toán; gia hạn chỉ chặn khi trùng lịch;
/// huỷ đơn trước ngày bắt đầu hoàn cả tiền gia hạn; đồng ý chính sách không kéo dài giữ chỗ 24 giờ;
/// ngày hết hạn vẫn là ngày còn dùng; cửa coi như khoá khi hợp đồng hết quyền ra vào.
/// </summary>
public sealed class D70ReviewFixTests
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

    private static DateOnly Today => OpsRules.TodayLocal;

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Tenant = null!;   // khách đang thuê K01
        public User Newcomer = null!; // khách mới đặt K01 / K02
        public Facility Facility = null!;
        public UnitType Type = null!;
        public StorageUnit K01 = null!, K02 = null!, K03 = null!;

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.connection).Options);
            await f.Db.Database.EnsureCreatedAsync();
            f.Tenant = new User { Username = "khach_dang_thue", Email = "a@storage.vn", PasswordHash = "x", FullName = "Nguyễn Văn An", Status = "ACTIVE" };
            f.Newcomer = new User { Username = "khach_moi", Email = "b@storage.vn", PasswordHash = "x", FullName = "Trần Thị Bình", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "1 Nguyễn Lương Bằng", Status = "ACTIVE" };
            f.Type = new UnitType { TypeName = "Kho M", Area = 15m, ClimateControlled = false, Status = "ACTIVE" };
            f.Db.AddRange(f.Tenant, f.Newcomer, f.Facility, f.Type);
            await f.Db.SaveChangesAsync();
            f.K01 = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, UnitNumber = "K01", Status = "OCCUPIED" };
            f.K02 = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, UnitNumber = "K02", Status = "AVAILABLE" };
            f.K03 = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, UnitNumber = "K03", Status = "AVAILABLE" };
            f.Db.AddRange(f.K01, f.K02, f.K03);
            f.Db.RentalRates.Add(new RentalRate
            {
                FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, SetBy = f.Tenant.UserId, CreatedAt = DateTime.UtcNow,
                MonthlyRate = 1_000_000m, EffectiveFrom = Today.AddDays(-30), Status = "ACTIVE"
            });
            f.Db.Policies.Add(new Policy
            {
                FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, PolicyName = "Ngày đệm", PolicyType = "RELET_BUFFER",
                CalculationType = "FIXED", Value = 3m, Status = "ACTIVE", CreatedBy = f.Tenant.UserId, EffectiveFrom = Today.AddDays(-30),
                RuleDescription = "3 ngày đệm"
            });
            f.Db.RentalPolicyVersions.Add(new RentalPolicyVersion
            {
                Version = 1, DisplayVersion = "11/2026", Rate = 5m, SectionsJson = "{}", PublishedBy = f.Tenant.UserId,
                PublishedAt = DateTime.UtcNow, IsCurrent = true
            });
            await f.Db.SaveChangesAsync();
            return f;
        }

        /// <summary>Hợp đồng đang thuê (đã cấp mã) của khách <paramref name="customer"/> trên ô <paramref name="unit"/>.</summary>
        public async Task<RentalContract> ContractAsync(User customer, StorageUnit unit, DateOnly start, DateOnly end, string status = "ACTIVE",
            string reservationStatus = "UNIT_ASSIGNED")
        {
            var r = new Reservation
            {
                CustomerId = customer.UserId, FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, StartDate = start, ExpectedEndDate = end,
                RentalPeriodMonths = 1, QuotedMonthlyRate = 1_000_000m, EstimatedAmount = 1_000_000m, RequiredDeposit = 1_000_000m,
                Status = reservationStatus, PaidAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow
            };
            Db.Reservations.Add(r);
            await Db.SaveChangesAsync();
            var c = new RentalContract
            {
                ReservationId = r.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId, StartDate = start, EndDate = end,
                AgreedMonthlyRate = 1_000_000m, DepositAmount = 1_000_000m, Status = status, CreatedAt = DateTime.UtcNow, ActivatedAt = DateTime.UtcNow
            };
            Db.RentalContracts.Add(c);
            await Db.SaveChangesAsync();
            Db.AccessCredentials.Add(new AccessCredential
            {
                ContractId = c.ContractId, UnitId = unit.UnitId, IssuedBy = customer.UserId, CredentialType = "ACCESS_CODE",
                CredentialReference = $"QR-{r.ReservationId}", IssuedAt = DateTime.UtcNow, Status = "ACTIVE"
            });
            await Db.SaveChangesAsync();
            return c;
        }

        public ValueTask DisposeAsync()
        {
            Db.Dispose();
            connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private static CreateRenewalRequest Renew(int months, long? target = null) => new(months, 1, true, target);

    [Fact]
    public void Max_renewal_months_stops_before_next_booking_plus_buffer()
    {
        var end = new DateOnly(2026, 11, 30);
        Assert.Null(UnitAvailability.MaxRenewalMonths(end, null, 3));
        Assert.Equal(0, UnitAvailability.MaxRenewalMonths(end, new DateOnly(2026, 12, 3), 3));
        Assert.Equal(1, UnitAvailability.MaxRenewalMonths(end, new DateOnly(2027, 1, 2), 3)); // 30/12 + 3 = 02/01
        Assert.Equal(1, UnitAvailability.MaxRenewalMonths(end, new DateOnly(2027, 1, 31), 3));
        Assert.Equal(2, UnitAvailability.MaxRenewalMonths(end, new DateOnly(2027, 2, 2), 3));
    }

    [Fact]
    public async Task Renewal_is_blocked_when_another_customer_is_paying_for_the_unit_after_current_end()
    {
        await using var f = await Fixture.CreateAsync();
        var tenant = await f.ContractAsync(f.Tenant, f.K01, Today.AddMonths(-1), Today.AddDays(10));
        // Khách mới chọn đúng K01 từ ngày trống lại (hết hạn + 3 ngày đệm), đang chờ thanh toán (chưa có hợp đồng).
        var booking = await new ReservationService(f.Db).CreateReservationAsync(f.Newcomer.UserId,
            new CreateReservationRequest(f.Facility.FacilityId, f.Type.UnitTypeId, tenant.EndDate.AddDays(3), 2, SelectedUnitId: f.K01.UnitId));
        Assert.Equal("EXACT", booking.AllocationMode);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new RenewalService(f.Db, null!).RequestRenewalAsync(f.Tenant.UserId, tenant.ContractId, Renew(1)));
        Assert.Contains("đã có khách đặt", ex.Message);
        Assert.Equal(0, await f.Db.ContractRenewals.CountAsync());
    }

    [Fact]
    public async Task Renewal_is_allowed_when_it_ends_before_the_next_booking()
    {
        await using var f = await Fixture.CreateAsync();
        var tenant = await f.ContractAsync(f.Tenant, f.K01, Today.AddMonths(-1), Today.AddDays(10));
        // Khách sau đã có hợp đồng trên K01 từ 4 tháng sau.
        await f.ContractAsync(f.Newcomer, f.K01, tenant.EndDate.AddMonths(4), tenant.EndDate.AddMonths(6));

        var detail = await new ContractService(f.Db).GetContractDetailAsync(f.Tenant.UserId, tenant.ContractId);
        Assert.NotNull(detail);
        Assert.Equal(3, detail.MaxRenewalMonths);

        var ok = await new RenewalService(f.Db, null!).RequestRenewalAsync(f.Tenant.UserId, tenant.ContractId, Renew(3));
        Assert.Equal("APPROVED", ok.Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => // đã có yêu cầu đang chờ
            new RenewalService(f.Db, null!).RequestRenewalAsync(f.Tenant.UserId, tenant.ContractId, Renew(4)));
    }

    [Fact]
    public async Task Renewal_longer_than_gap_is_blocked()
    {
        await using var f = await Fixture.CreateAsync();
        var tenant = await f.ContractAsync(f.Tenant, f.K01, Today.AddMonths(-1), Today.AddDays(10));
        await f.ContractAsync(f.Newcomer, f.K01, tenant.EndDate.AddMonths(4), tenant.EndDate.AddMonths(6));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new RenewalService(f.Db, null!).RequestRenewalAsync(f.Tenant.UserId, tenant.ContractId, Renew(4)));
        Assert.Contains("4 tháng", ex.Message);
    }

    [Fact]
    public async Task Renewal_to_another_unit_cannot_pick_a_unit_held_by_a_pending_reservation()
    {
        await using var f = await Fixture.CreateAsync();
        var tenant = await f.ContractAsync(f.Tenant, f.K01, Today.AddMonths(-1), Today.AddDays(10));
        await new ReservationService(f.Db).CreateReservationAsync(f.Newcomer.UserId,
            new CreateReservationRequest(f.Facility.FacilityId, f.Type.UnitTypeId, Today.AddDays(2), 3, SelectedUnitId: f.K02.UnitId));

        var contract = await f.Db.RentalContracts.Include(c => c.Unit).SingleAsync(c => c.ContractId == tenant.ContractId);
        var options = await RenewalUnitMove.OptionsAsync(f.Db, contract, default);
        Assert.DoesNotContain(options.Options, o => o.UnitId == f.K02.UnitId);
        Assert.Contains(options.Options, o => o.UnitId == f.K03.UnitId);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new RenewalService(f.Db, null!).RequestRenewalAsync(f.Tenant.UserId, tenant.ContractId, Renew(1, f.K02.UnitId)));
    }

    [Fact]
    public async Task Renewal_on_last_day_is_allowed_and_access_still_opens()
    {
        await using var f = await Fixture.CreateAsync();
        var tenant = await f.ContractAsync(f.Tenant, f.K01, Today.AddMonths(-1), Today, status: "EXPIRING");
        Assert.True(await AccessService.StillUsableAsync(f.Db, tenant.ContractId, default));
        Assert.Equal(Today, OpsRules.LastVisitDay(tenant.EndDate, Today));

        var renewal = await new RenewalService(f.Db, null!).RequestRenewalAsync(f.Tenant.UserId, tenant.ContractId, Renew(1));
        Assert.Equal("APPROVED", renewal.Status);
        Assert.True(renewal.PaymentDeadlineAt > DateTime.UtcNow);

        tenant.EndDate = Today.AddDays(-1);
        await f.Db.SaveChangesAsync();
        Assert.False(await AccessService.StillUsableAsync(f.Db, tenant.ContractId, default));
    }

    [Fact]
    public async Task Policy_consent_no_longer_extends_the_hold_to_24_hours()
    {
        await using var f = await Fixture.CreateAsync();
        var booking = await new ReservationService(f.Db).CreateReservationAsync(f.Newcomer.UserId,
            new CreateReservationRequest(f.Facility.FacilityId, f.Type.UnitTypeId, Today.AddDays(2), 1, SelectedUnitId: f.K02.UnitId));
        var before = (await f.Db.Reservations.AsNoTracking().SingleAsync(r => r.ReservationId == booking.ReservationId)).ExpiresAt;

        await new RentalPolicyService(f.Db).RecordReservationConsentAsync(f.Newcomer.UserId, booking.ReservationId, new PolicyConsentRequest(1, true));

        var after = (await f.Db.Reservations.AsNoTracking().SingleAsync(r => r.ReservationId == booking.ReservationId)).ExpiresAt;
        Assert.Equal(before, after);
        Assert.True(after <= DateTime.UtcNow.AddMinutes(OpsRules.DefaultOnlineReservationHoldMinutes));
    }

    [Fact]
    public async Task Cancel_before_start_refunds_rent_deposit_and_paid_renewal_and_closes_open_renewal()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ContractAsync(f.Newcomer, f.K02, Today.AddDays(10), Today.AddDays(10).AddMonths(1));
        var now = DateTime.UtcNow;
        f.Db.Payments.AddRange(
            new Payment { ReservationId = c.ReservationId, ContractId = c.ContractId, PaymentType = "RENT", Amount = 1_000_000m, PaymentMethod = "CASH", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now },
            new Payment { ReservationId = c.ReservationId, ContractId = c.ContractId, PaymentType = "DEPOSIT", Amount = 1_000_000m, PaymentMethod = "CASH", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now });
        var paidRenewal = new ContractRenewal
        {
            ContractId = c.ContractId, OldEndDate = c.EndDate, NewEndDate = c.EndDate.AddMonths(2), RenewalPeriodMonths = 2,
            OldMonthlyRate = 1_000_000m, NewMonthlyRate = 1_000_000m, RenewalAmount = 2_000_000m, Status = "PAID",
            RequestedAt = now, ApprovedAt = now, AppliedAt = now, CreatedAt = now
        };
        var openRenewal = new ContractRenewal
        {
            ContractId = c.ContractId, OldEndDate = c.EndDate.AddMonths(2), NewEndDate = c.EndDate.AddMonths(3), RenewalPeriodMonths = 1,
            OldMonthlyRate = 1_000_000m, NewMonthlyRate = 1_000_000m, RenewalAmount = 1_000_000m, Status = "APPROVED",
            RequestedAt = now, ApprovedAt = now, PaymentDeadlineAt = now.AddHours(24), CreatedAt = now
        };
        f.Db.ContractRenewals.AddRange(paidRenewal, openRenewal);
        await f.Db.SaveChangesAsync();
        f.Db.Payments.AddRange(
            new Payment { ContractId = c.ContractId, RenewalId = paidRenewal.RenewalId, PaymentType = "RENEWAL", Amount = 2_000_000m, PaymentMethod = "CASH", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now },
            new Payment { ContractId = c.ContractId, RenewalId = openRenewal.RenewalId, PaymentType = "RENEWAL", Amount = 1_000_000m, PaymentMethod = "BANK_TRANSFER", Status = "PENDING", CreatedAt = now, UpdatedAt = now });
        await f.Db.SaveChangesAsync();

        var service = new ReservationService(f.Db);
        var preview = await service.GetCancelPreviewAsync(f.Newcomer.UserId, c.ReservationId);
        Assert.Equal(4_000_000m, preview.PaidAmount);
        Assert.Equal(4_000_000m, preview.RefundAmount);

        await service.CancelReservationAsync(f.Newcomer.UserId, c.ReservationId, "Đổi kế hoạch", new RefundBankInput(null, null, null, "CASH"));

        f.Db.ChangeTracker.Clear();
        var refund = await f.Db.Payments.SingleAsync(p => p.ReservationId == c.ReservationId && p.PaymentType == "REFUND");
        Assert.Equal(4_000_000m, refund.Amount);
        Assert.Equal("CANCELLED", (await f.Db.ContractRenewals.SingleAsync(r => r.RenewalId == openRenewal.RenewalId)).Status);
        Assert.Equal("FAILED", (await f.Db.Payments.SingleAsync(p => p.RenewalId == openRenewal.RenewalId)).Status);
        Assert.Equal("CANCELLED", (await f.Db.RentalContracts.SingleAsync(x => x.ContractId == c.ContractId)).Status);
    }

    [Fact]
    public async Task Access_is_not_usable_after_return_day_or_when_overdue()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ContractAsync(f.Tenant, f.K01, Today.AddMonths(-1), Today.AddDays(5));
        Assert.True(await AccessService.StillUsableAsync(f.Db, c.ContractId, default));

        c.Status = "OVERDUE";
        await f.Db.SaveChangesAsync();
        Assert.False(await AccessService.StillUsableAsync(f.Db, c.ContractId, default));

        // Hẹn trả kho ngày mai: hôm nay vẫn dùng được; hẹn hôm nay: khoá từ 00:00 hôm nay.
        c.Status = "RETURN_PENDING";
        var staff = f.Tenant.UserId;
        var inspection = new ReturnInspection
        {
            ContractId = c.ContractId, StaffId = staff, Status = "SCHEDULED", CreatedAt = DateTime.UtcNow,
            ScheduledAt = DateTime.SpecifyKind(Today.AddDays(1).ToDateTime(new TimeOnly(9, 0)).AddHours(-7), DateTimeKind.Utc)
        };
        f.Db.ReturnInspections.Add(inspection);
        await f.Db.SaveChangesAsync();
        Assert.True(await AccessService.StillUsableAsync(f.Db, c.ContractId, default));

        inspection.ScheduledAt = DateTime.SpecifyKind(Today.ToDateTime(new TimeOnly(9, 0)).AddHours(-7), DateTimeKind.Utc);
        await f.Db.SaveChangesAsync();
        Assert.False(await AccessService.StillUsableAsync(f.Db, c.ContractId, default));
    }
}
