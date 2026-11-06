using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using Xunit;

namespace StorageProject.Tests;

/// <summary>M01 / C09: mọi route duyệt gia hạn dùng chung một đường, khoá rồi mới kiểm lại.</summary>
public sealed partial class RenewalPolicyD32Tests
{
    [Fact]
    public async Task M01_AllApprovalRoutes_ShareRules_SecondApprovalOnOtherRouteIsRejected()
    {
        await using var f = await Fixture.CreateAsync();
        var dto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true));

        await f.ManagerSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId.ToString());
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId));

        Assert.Single(await f.Db.Payments.Where(p => p.RenewalId == dto.RenewalId).ToListAsync());
        Assert.Single(await f.Db.ActivityLogs.Where(l => l.EntityType == "RENEWAL" && l.EntityId == dto.RenewalId && l.Action == "RENEWAL_APPROVED").ToListAsync());
    }

    [Fact]
    public async Task M01_LegacyManagerRoute_BlocksUnitBookedByNextCustomer_D41()
    {
        await using var f = await Fixture.CreateAsync();
        var dto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true));

        var start = f.Contract.EndDate.AddDays(5);
        var next = new Reservation
        {
            CustomerId = f.StaffUser.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = f.Unit.UnitTypeId, StartDate = start,
            ExpectedEndDate = start.AddMonths(1), RentalPeriodMonths = 1, EstimatedAmount = 1_500_000m, RequiredDeposit = 1_500_000m,
            QuotedMonthlyRate = 1_500_000m, Status = "UNIT_ASSIGNED", CreatedAt = DateTime.UtcNow
        };
        f.Db.Reservations.Add(next);
        await f.Db.SaveChangesAsync();
        f.Db.RentalContracts.Add(new RentalContract
        {
            ReservationId = next.ReservationId, CustomerId = f.StaffUser.UserId, UnitId = f.Unit.UnitId, StartDate = start, EndDate = start.AddMonths(1),
            AgreedMonthlyRate = 1_500_000m, DepositAmount = 1_500_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        });
        await f.Db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => f.ManagerSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId.ToString()));
        Assert.Contains("đã có khách đặt", ex.Message);
        Assert.Equal("PENDING", (await f.Db.ContractRenewals.AsNoTracking().FirstAsync(r => r.RenewalId == dto.RenewalId)).Status);
    }

    [Fact]
    public async Task M01_StaleEndDate_IsRejectedAfterLock()
    {
        await using var f = await Fixture.CreateAsync();
        var dto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true));
        f.Contract.EndDate = f.Contract.EndDate.AddDays(30); // kỳ thuê đổi sau khi khách gửi yêu cầu
        await f.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId));
        Assert.Empty(await f.Db.Payments.Where(p => p.RenewalId == dto.RenewalId).ToListAsync());
    }

    [Fact]
    public async Task M04_ManagerReminder_ReusesOpenOverdueCase_NoDuplicate()
    {
        await using var f = await Fixture.CreateAsync();
        await f.ManagerSvc.AddContractReminderAsync(f.ManagerUser.UserId, f.Contract.ContractId.ToString(), new AddReminderRequest { Note = "Gọi lần 1" });
        await f.ManagerSvc.AddContractReminderAsync(f.ManagerUser.UserId, f.Contract.ContractId.ToString(), new AddReminderRequest { Note = "Gọi lần 2" });

        var cases = await f.Db.OverdueCases.AsNoTracking().Where(o => o.ContractId == f.Contract.ContractId).ToListAsync();
        var only = Assert.Single(cases);
        Assert.Contains("Gọi lần 2", only.Notes);
        Assert.Equal(f.Contract.EndDate.AddDays(1), only.OverdueFrom);
    }
}
