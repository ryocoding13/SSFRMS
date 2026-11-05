using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// Phiên 4 (05/11/2026) · D41 đặt trước theo ngày + xử lý xung đột ô do khách cũ chưa trả / chưa kiểm tra đạt.
/// SQLite trong bộ nhớ — chưa thay cho kiểm SQL Server thật.
/// </summary>
public sealed partial class D32RefundEvidenceTests
{
    private static async Task<User> NewCustomerAsync(Fixture f, string username, string name)
    {
        var u = new User { Username = username, Email = $"{username}@example.com", FullName = name, PasswordHash = "x", Status = "ACTIVE" };
        f.Db.Users.Add(u);
        await f.Db.SaveChangesAsync();
        return u;
    }

    private static async Task<StorageUnit> UnitAsync(Fixture f, string number, string status = "AVAILABLE", UnitType? type = null)
    {
        var unit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = (type ?? f.Type).UnitTypeId, UnitNumber = number, Status = status };
        f.Db.StorageUnits.Add(unit);
        await f.Db.SaveChangesAsync();
        return unit;
    }

    /// <summary>Hợp đồng đã thanh toán trên ô cho trước (đơn UNIT_ASSIGNED + phân bổ + QR/PIN).</summary>
    private static async Task<RentalContract> BookedAsync(Fixture f, User customer, StorageUnit unit, DateOnly start, int months = 1, string status = "ACTIVE")
    {
        var r = new Reservation
        {
            CustomerId = customer.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = unit.UnitTypeId, StartDate = start,
            ExpectedEndDate = start.AddMonths(months), RentalPeriodMonths = months, EstimatedAmount = 1_000_000m * months,
            RequiredDeposit = 1_000_000m, QuotedMonthlyRate = 1_000_000m, Status = "UNIT_ASSIGNED", CreatedAt = DateTime.UtcNow
        };
        f.Db.Reservations.Add(r);
        await f.Db.SaveChangesAsync();
        var c = new RentalContract
        {
            ReservationId = r.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId, StartDate = start, EndDate = start.AddMonths(months),
            AgreedMonthlyRate = 1_000_000m, DepositAmount = 1_000_000m, Status = status, CreatedAt = DateTime.UtcNow
        };
        f.Db.RentalContracts.Add(c);
        await f.Db.SaveChangesAsync();
        var now = DateTime.UtcNow;
        f.Db.UnitAssignments.Add(new UnitAssignment { ReservationId = r.ReservationId, UnitId = unit.UnitId, AssignedAt = now, Status = "ACTIVE" });
        f.Db.AccessCredentials.AddRange(
            new AccessCredential { ContractId = c.ContractId, UnitId = unit.UnitId, IssuedBy = customer.UserId, CredentialType = "ACCESS_CODE", CredentialReference = $"QR-{r.ReservationId}", IssuedAt = now, Status = "ACTIVE" },
            new AccessCredential { ContractId = c.ContractId, UnitId = unit.UnitId, IssuedBy = customer.UserId, CredentialType = "ACCESS_CODE", CredentialReference = $"PIN-{r.ReservationId}", IssuedAt = now, Status = "ACTIVE" });
        f.Db.Payments.AddRange(
            new Payment { ReservationId = r.ReservationId, ContractId = c.ContractId, PaymentType = "RENT", Amount = 1_000_000m * months, PaymentMethod = "PAYMENT_GATEWAY", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now },
            new Payment { ReservationId = r.ReservationId, ContractId = c.ContractId, PaymentType = "DEPOSIT", Amount = 1_000_000m, PaymentMethod = "PAYMENT_GATEWAY", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now });
        await f.Db.SaveChangesAsync();
        return c;
    }

    // ------------------------------------------------------------------ trống theo ngày

    [Fact]
    public async Task Availability_RentedUnitFreeAfterEndPlusBuffer_PrefersTrulyFreeUnit_BlocksOverdue()
    {
        await using var f = await Fixture.CreateAsync();
        var old = await f.ActiveContractAsync(); // ô K01 hết hạn hôm nay (OCCUPIED)
        var today = TodayVn;
        var fid = f.Facility.FacilityId;
        var tid = f.Type.UnitTypeId;

        Assert.Equal(0, await UnitAvailability.CountBookableAsync(f.Db, fid, tid, today.AddDays(2), today.AddMonths(1)));
        Assert.Equal(1, await UnitAvailability.CountBookableAsync(f.Db, fid, tid, today.AddDays(3), today.AddMonths(1))); // 3 ngày đệm mặc định

        var units = await new FacilityService(f.Db).GetUnitsByFacilityIdAsync(fid);
        Assert.Equal(today.AddDays(3), Assert.Single(units).FreeFrom);

        var k02 = await UnitAsync(f, "K02");
        var slots = await UnitAvailability.SlotsAsync(f.Db, fid, tid, default);
        Assert.Equal(k02.UnitId, UnitAvailability.Pick(slots, today.AddDays(5), today.AddMonths(2), 3, today)!.Unit.UnitId); // ưu tiên ô trống thật

        // Chính sách RELET_BUFFER 7 ngày do Vận hành KD đặt
        f.Db.Policies.Add(new Policy { PolicyName = "Đệm cho thuê lại", PolicyType = UnitAvailability.BufferPolicyType, CalculationType = "FIXED",
            Value = 7, RuleDescription = "7 ngày", EffectiveFrom = today.AddDays(-1), Status = "ACTIVE", CreatedBy = f.Manager.UserId,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await f.Db.SaveChangesAsync();
        Assert.Equal(7, await UnitAvailability.BufferDaysAsync(f.Db, fid, tid, today, default));

        // Ô có hợp đồng quá hạn không đặt trước được
        k02.Status = "OUT_OF_SERVICE";
        old.Status = "OVERDUE";
        await f.Db.SaveChangesAsync();
        Assert.Equal(0, await UnitAvailability.CountBookableAsync(f.Db, fid, tid, today.AddDays(30), today.AddMonths(3)));
        Assert.True(Assert.Single(await new FacilityService(f.Db).GetUnitsByFacilityIdAsync(fid)).Overdue);
    }

    [Fact]
    public async Task Renewal_LockedWhenUnitAlreadyBookedByNextCustomer()
    {
        await using var f = await Fixture.CreateAsync();
        var today = TodayVn;
        var unit = await UnitAsync(f, "K09", "OCCUPIED");
        var oldContract = await BookedAsync(f, f.Customer, unit, today.AddDays(-20), months: 1);
        var next = await NewCustomerAsync(f, "customer09", "Phạm Khách Mới");
        var booked = await BookedAsync(f, next, unit, oldContract.EndDate.AddDays(3));

        Assert.Equal(booked.StartDate, await UnitAvailability.NextBookingAsync(f.Db, oldContract, default));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => new RenewalService(f.Db, null!)
            .RequestRenewalAsync(f.Customer.UserId, oldContract.ContractId, new CreateRenewalRequest(1, 1, true)));
        Assert.Contains($"Ô đã có khách đặt từ {booked.StartDate:dd/MM/yyyy}", ex.Message);
    }

    // ------------------------------------------------------------------ xung đột ô

    [Fact]
    public async Task Conflict_FiveDaysBefore_ProposesSwap_HoldsUnit_CustomerAcceptsAndGetsNewCodes()
    {
        await using var f = await Fixture.CreateAsync();
        var today = TodayVn;
        var k01 = await UnitAsync(f, "K01", "OCCUPIED");
        await BookedAsync(f, f.Customer, k01, today.AddDays(-30)); // khách cũ hết hạn hôm nay, chưa trả
        var spare = await UnitAsync(f, "K02");
        var newbie = await NewCustomerAsync(f, "customer07", "Lý Khách Mới");
        var c = await BookedAsync(f, newbie, k01, today.AddDays(4));
        f.Db.ChangeTracker.Clear();

        Assert.Equal(1, await f.Ops.DetectUnitConflictsAsync());
        Assert.Equal(0, await f.Ops.DetectUnitConflictsAsync()); // chỉ một đề xuất đang mở
        var proposal = Assert.Single(await f.Ops.GetCustomerUnitConflictsAsync(newbie.UserId));
        Assert.Equal("SWAP", proposal.Option);
        Assert.Equal("K02", proposal.ProposedUnit);
        Assert.Equal("OPEN", proposal.Status);
        Assert.NotNull(proposal.ExpiresAt);
        Assert.Equal("RESERVED", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == spare.UnitId)).Status);
        Assert.Single(await f.Ops.GetUnitConflictsAsync(f.ManagerActor));
        // Ô đang giữ cho đề xuất không bị đơn khác lấy
        Assert.Equal(0, await UnitAvailability.CountBookableAsync(f.Db, f.Facility.FacilityId, f.Type.UnitTypeId, today.AddDays(4), today.AddMonths(1)));

        var done = await f.Ops.ChooseUnitConflictAsync(newbie.UserId, $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}", new UnitConflictChoiceRequest("ACCEPT"));
        Assert.Equal("RESOLVED", done.Status);
        Assert.Equal("SWAP", done.Resolution);
        var moved = await f.Db.RentalContracts.AsNoTracking().Include(x => x.AccessCredentials).SingleAsync(x => x.ContractId == c.ContractId);
        Assert.Equal(spare.UnitId, moved.UnitId);
        Assert.Equal(1_000_000m, moved.AgreedMonthlyRate);
        Assert.All(moved.AccessCredentials.Where(a => a.UnitId == k01.UnitId), a => Assert.Equal("REPLACED", a.Status));
        Assert.Equal(2, moved.AccessCredentials.Count(a => a.UnitId == spare.UnitId && a.Status == "ACTIVE"));
        Assert.Equal("OCCUPIED", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == k01.UnitId)).Status); // khách cũ vẫn dùng
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ChooseUnitConflictAsync(newbie.UserId,
            $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}", new UnitConflictChoiceRequest("ACCEPT")));
    }

    [Fact]
    public async Task Conflict_NoSameType_UpgradesFreeAfter48Hours_KeepsPriceAndDeposit()
    {
        await using var f = await Fixture.CreateAsync();
        var today = TodayVn;
        var k01 = await UnitAsync(f, "K01", "OCCUPIED");
        await BookedAsync(f, f.Customer, k01, today.AddDays(-30));
        var big = new UnitType { TypeName = "Kho thường L", Area = 25, ClimateControlled = false, Status = "ACTIVE" };
        f.Db.UnitTypes.Add(big);
        await f.Db.SaveChangesAsync();
        var l01 = await UnitAsync(f, "L01", type: big);
        var newbie = await NewCustomerAsync(f, "customer08", "Đỗ Khách Mới");
        var c = await BookedAsync(f, newbie, k01, today.AddDays(5));
        f.Db.ChangeTracker.Clear();

        Assert.Equal(1, await f.Ops.DetectUnitConflictsAsync());
        var proposal = Assert.Single(await f.Ops.GetCustomerUnitConflictsAsync(newbie.UserId));
        Assert.Equal("UPGRADE", proposal.Option);
        Assert.Equal("L01", proposal.ProposedUnit);

        Assert.Equal(0, await f.Ops.ExpireUnitConflictsAsync()); // chưa hết 48 giờ
        var log = await f.Db.ActivityLogs.SingleAsync(l => l.Action == "UNIT_CONFLICT_PROPOSED");
        log.LoggedAt = DateTime.UtcNow.AddHours(-49);
        log.NewValue = System.Text.RegularExpressions.Regex.Replace(log.NewValue!, "\"expiresAt\":\"[^\"]+\"",
            $"\"expiresAt\":\"{DateTime.UtcNow.AddHours(-1):o}\"");
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();

        Assert.Equal(1, await f.Ops.ExpireUnitConflictsAsync());
        var moved = await f.Db.RentalContracts.AsNoTracking().SingleAsync(x => x.ContractId == c.ContractId);
        Assert.Equal(l01.UnitId, moved.UnitId);
        Assert.Equal(1_000_000m, moved.AgreedMonthlyRate); // giữ giá
        Assert.Equal(1_000_000m, moved.DepositAmount);     // giữ cọc
        Assert.Equal("AUTO_UPGRADE", Assert.Single(await f.Ops.GetCustomerUnitConflictsAsync(newbie.UserId)).Resolution);
        var resolved = await f.Db.ActivityLogs.SingleAsync(l => l.Action == "UNIT_CONFLICT_RESOLVED");
        Assert.Null(resolved.UserId); // hệ thống tự làm
    }

    [Fact]
    public async Task Conflict_NoUnit_CustomerReschedulesOrCancelsWithFullRefundNoFee()
    {
        await using var f = await Fixture.CreateAsync();
        var today = TodayVn;
        var k01 = await UnitAsync(f, "K01", "OCCUPIED");
        var oldContract = await BookedAsync(f, f.Customer, k01, today.AddDays(-20)); // khách cũ còn ~10 ngày (dữ liệu thử: chồng kỳ)
        var a = await NewCustomerAsync(f, "customer10", "Khách Dời Ngày");
        var b = await NewCustomerAsync(f, "customer11", "Khách Huỷ");
        var k02 = await UnitAsync(f, "K02", "OCCUPIED");
        await BookedAsync(f, f.Customer, k02, today.AddDays(-25)); // ô thứ hai cũng còn khách cũ
        var ca = await BookedAsync(f, a, k01, today.AddDays(4));
        var cb = await BookedAsync(f, b, k02, today.AddDays(4));
        f.Db.ChangeTracker.Clear();

        Assert.Equal(2, await f.Ops.DetectUnitConflictsAsync());
        var pa = Assert.Single(await f.Ops.GetCustomerUnitConflictsAsync(a.UserId));
        Assert.Equal("NONE", pa.Option);
        Assert.Null(pa.ProposedUnit);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ChooseUnitConflictAsync(a.UserId, $"{ca.ContractId}", new UnitConflictChoiceRequest("ACCEPT")));

        // Dời ngày: chưa trống → từ chối; sau ngày hết hạn + đệm của khách cũ → giữ ô cũ, cùng độ dài kỳ thuê
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ChooseUnitConflictAsync(a.UserId, $"{ca.ContractId}",
            new UnitConflictChoiceRequest("RESCHEDULE", today.AddDays(5))));
        var newStart = oldContract.EndDate.AddDays(3);
        var rescheduled = await f.Ops.ChooseUnitConflictAsync(a.UserId, $"{ca.ContractId}", new UnitConflictChoiceRequest("RESCHEDULE", newStart));
        Assert.Equal("RESCHEDULE", rescheduled.Resolution);
        var movedA = await f.Db.RentalContracts.AsNoTracking().Include(x => x.Reservation).SingleAsync(x => x.ContractId == ca.ContractId);
        Assert.Equal(newStart, movedA.StartDate);
        Assert.Equal(newStart.AddMonths(1), movedA.EndDate);
        Assert.Equal(newStart, movedA.Reservation.StartDate);

        // Huỷ: hoàn 100% tiền thuê + cọc đã trả (2.000.000), không phí 5%; chọn tiền mặt (D42)
        await f.Ops.ChooseUnitConflictAsync(b.UserId, $"{cb.ContractId}", new UnitConflictChoiceRequest("CANCEL", RefundBank: new RefundBankInput(null, null, null, "CASH")));
        var refund = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.ContractId == cb.ContractId && p.PaymentType == "REFUND");
        Assert.Equal(2_000_000m, refund.Amount);
        Assert.Equal("CASH", refund.PaymentMethod);
        Assert.Equal("CANCELLED", (await f.Db.RentalContracts.AsNoTracking().SingleAsync(x => x.ContractId == cb.ContractId)).Status);
        Assert.Equal("CANCELLED", (await f.Db.Reservations.AsNoTracking().SingleAsync(x => x.ReservationId == cb.ReservationId)).Status);
        Assert.Equal("OCCUPIED", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == k02.UnitId)).Status);
    }
}
