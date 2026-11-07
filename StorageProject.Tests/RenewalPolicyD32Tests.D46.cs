using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>D46 · Gia hạn sang ô khác: giữ ô khi duyệt, thu cọc chênh cùng khoản gia hạn, chuyển đồ 3 ngày cuối kỳ, kiểm tra ô cũ.</summary>
public sealed partial class RenewalPolicyD32Tests
{
    private static async Task<StorageUnit> AddFreeUnitAsync(Fixture f, string number = "K02")
    {
        var unit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Unit.UnitTypeId, UnitNumber = number, Status = "AVAILABLE" };
        f.Db.StorageUnits.Add(unit);
        await f.Db.SaveChangesAsync();
        return unit;
    }

    private static async Task AddDepositPolicyAsync(Fixture f, decimal fixedDeposit)
    {
        f.Db.Policies.Add(new Policy
        {
            PolicyName = "Cọc", RuleDescription = "Cọc cố định", CreatedBy = f.ManagerUser.UserId, PolicyType = "DEPOSIT",
            CalculationType = "FIXED", Value = fixedDeposit, EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        await f.Db.SaveChangesAsync();
    }

    private static async Task<RenewalDto> RequestApprovePayAsync(Fixture f, StorageUnit target)
    {
        var dto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true, target.UnitId));
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId);
        Assert.True(await RenewalSettlement.RecordAsync(f.Db, f.Contract.ContractId, dto.RenewalId, "CASH", $"TEST-{dto.RenewalId}", f.StaffUser.UserId, default));
        await f.Db.SaveChangesAsync();
        return dto;
    }

    private static async Task SetOldEndDateAsync(Fixture f, long renewalId, DateOnly oldEnd)
    {
        var r = await f.Db.ContractRenewals.SingleAsync(x => x.RenewalId == renewalId);
        r.OldEndDate = oldEnd;
        await f.Db.SaveChangesAsync();
    }

    [Fact]
    public async Task D46_Swap_HoldOnApprove_TopUpSplitOnPayment_MoveSwitchesUnitAndCodes_InspectionFreesOldUnit()
    {
        await using var f = await Fixture.CreateAsync();
        var k02 = await AddFreeUnitAsync(f);
        await AddDepositPolicyAsync(f, 1_800_000m); // ô mới cần cọc 1.800.000, đang giữ 1.500.000 → chênh 300.000

        var options = await f.RenewalSvc.GetRenewalUnitOptionsAsync(f.CustomerUser.UserId, f.Contract.ContractId);
        var option = Assert.Single(options.Options);
        Assert.Equal(("K02", "SWAP", 300_000m), (option.UnitNumber, option.Kind, option.DepositTopUp));

        var dto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true, k02.UnitId));
        Assert.Equal("AVAILABLE", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == k02.UnitId)).Status); // chưa giữ khi mới gửi
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId);
        Assert.Equal("RESERVED", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == k02.UnitId)).Status);
        var pending = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.RenewalId == dto.RenewalId);
        Assert.Equal(1_500_000m + 300_000m, pending.Amount); // một khoản gộp tiền gia hạn + cọc chênh

        Assert.True(await RenewalSettlement.RecordAsync(f.Db, f.Contract.ContractId, dto.RenewalId, "CASH", "TEST-PAY", f.StaffUser.UserId, default));
        await f.Db.SaveChangesAsync();
        var payments = await f.Db.Payments.AsNoTracking().Where(p => p.RenewalId == dto.RenewalId).ToListAsync();
        Assert.Equal(1_500_000m, payments.Single(p => p.PaymentType == "RENEWAL").Amount);
        Assert.Equal(300_000m, payments.Single(p => p.PaymentType == "DEPOSIT" && p.Status == "PAID").Amount);
        Assert.Equal("TEST-PAY-COC", payments.Single(p => p.PaymentType == "DEPOSIT").TransactionReference); // mã giao dịch không trùng (unique)
        var contract = await f.Db.RentalContracts.AsNoTracking().SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal((1_800_000m, f.Unit.UnitId), (contract.DepositAmount, contract.UnitId)); // vẫn ở ô cũ tới khi chuyển đồ

        // Chưa tới 3 ngày cuối kỳ cũ (hết hạn sau 10 ngày) → chưa chuyển được, ô mới chưa mở bằng mã hiện tại.
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.RenewalSvc.MarkUnitMovedAsync(f.CustomerUser.UserId, f.Contract.ContractId));
        Assert.False(await RenewalUnitMove.CanOpenTargetAsync(f.Db, f.Contract.ContractId, "K02", default));

        await SetOldEndDateAsync(f, dto.RenewalId, OpsRules.TodayLocal.AddDays(1));
        Assert.True(await RenewalUnitMove.CanOpenTargetAsync(f.Db, f.Contract.ContractId, "K02", default));
        var oldCodes = await f.Db.AccessCredentials.AsNoTracking().Where(c => c.ContractId == f.Contract.ContractId).Select(c => c.CredentialId).ToListAsync();
        var moved = await f.RenewalSvc.MarkUnitMovedAsync(f.CustomerUser.UserId, f.Contract.ContractId);
        Assert.Equal(("MOVED", false), (moved.Status, moved.AutoMoved));
        contract = await f.Db.RentalContracts.AsNoTracking().Include(c => c.AccessCredentials).SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal(k02.UnitId, contract.UnitId);
        Assert.Equal(2, contract.AccessCredentials.Count(c => c.Status == "ACTIVE" && c.UnitId == k02.UnitId && !oldCodes.Contains(c.CredentialId)));
        Assert.DoesNotContain(contract.AccessCredentials, c => c.Status == "ACTIVE" && oldCodes.Contains(c.CredentialId));
        Assert.Equal("INSPECTION", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == f.Unit.UnitId)).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.RenewalSvc.MarkUnitMovedAsync(f.CustomerUser.UserId, f.Contract.ContractId)); // bấm lại

        var tasks = await f.RenewalSvc.GetOldUnitInspectionsAsync(f.StaffUser.UserId);
        Assert.Equal("K01", Assert.Single(tasks).FromUnit);
        var inspected = await f.RenewalSvc.InspectOldUnitAsync(f.StaffUser.UserId, dto.RenewalId, new UnitMoveInspectionRequest(false, false, 0, "Đạt tiêu chuẩn"));
        Assert.Equal(("INSPECTED", 0m), (inspected.Status, inspected.Deduction ?? -1));
        Assert.Equal("AVAILABLE", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == f.Unit.UnitId)).Status);
        Assert.Empty(await f.RenewalSvc.GetOldUnitInspectionsAsync(f.StaffUser.UserId));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.RenewalSvc.InspectOldUnitAsync(f.StaffUser.UserId, dto.RenewalId, new UnitMoveInspectionRequest(false, false, 0, null)));
    }

    [Fact]
    public async Task D46_UnitBookedByNextCustomer_NormalRenewalBlocked_ButRenewalToOtherUnitAllowed()
    {
        await using var f = await Fixture.CreateAsync();
        var k02 = await AddFreeUnitAsync(f);
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
            AgreedMonthlyRate = 1_500_000m, DepositAmount = 1_500_000m, Status = "DRAFT", CreatedAt = DateTime.UtcNow
        });
        await f.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true)));
        var options = await f.RenewalSvc.GetRenewalUnitOptionsAsync(f.CustomerUser.UserId, f.Contract.ContractId);
        Assert.Equal(start, options.BookedFrom);
        var dto = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true, k02.UnitId));
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, dto.RenewalId);
        Assert.Equal("APPROVED", (await f.Db.ContractRenewals.AsNoTracking().SingleAsync(r => r.RenewalId == dto.RenewalId)).Status);
    }

    [Fact]
    public async Task D46_TargetTakenBeforeApproval_IsRejected_AndExpiredPaymentReleasesHeldUnit()
    {
        await using var f = await Fixture.CreateAsync();
        var k02 = await AddFreeUnitAsync(f);
        var k03 = await AddFreeUnitAsync(f, "K03");

        var first = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true, k02.UnitId));
        var taken = await f.Db.StorageUnits.SingleAsync(u => u.UnitId == k02.UnitId);
        taken.Status = "RESERVED"; // ô vừa bị giữ cho đơn khác trước khi quản lý duyệt
        await f.Db.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, first.RenewalId));
        Assert.Contains("vừa có người đặt", ex.Message);
        await f.RenewalSvc.RejectRenewalAsync(f.ManagerUser.UserId, first.RenewalId, "Ô vừa có người đặt, chọn ô khác");

        var second = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true, k03.UnitId));
        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, second.RenewalId);
        Assert.Equal("RESERVED", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == k03.UnitId)).Status);
        var r = await f.Db.ContractRenewals.SingleAsync(x => x.RenewalId == second.RenewalId);
        r.PaymentDeadlineAt = DateTime.UtcNow.AddMinutes(-1);
        await f.Db.SaveChangesAsync();
        await f.RenewalSvc.ExpirePendingRenewalsAsync();
        Assert.Equal("EXPIRED", (await f.Db.ContractRenewals.AsNoTracking().SingleAsync(x => x.RenewalId == second.RenewalId)).Status);
        Assert.Equal("AVAILABLE", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == k03.UnitId)).Status);
    }

    [Fact]
    public async Task D48_NotMovedByEndOfOldTerm_AutoMoves_GoodsLeftAreAbandoned_NoOverdueFee()
    {
        await using var f = await Fixture.CreateAsync();
        var k02 = await AddFreeUnitAsync(f);
        var dto = await RequestApprovePayAsync(f, k02);
        await SetOldEndDateAsync(f, dto.RenewalId, OpsRules.TodayLocal.AddDays(-2));

        Assert.Equal(1, await RenewalUnitMove.AutoCompleteAsync(f.Db, default));
        Assert.Equal(0, await RenewalUnitMove.AutoCompleteAsync(f.Db, default)); // chạy lại không chuyển lần nữa
        var move = await f.RenewalSvc.GetUnitMoveAsync(f.CustomerUser.UserId, f.Contract.ContractId);
        Assert.Equal(("MOVED", true), (move!.Status, move.AutoMoved));
        Assert.Equal(k02.UnitId, (await f.Db.RentalContracts.AsNoTracking().SingleAsync(c => c.ContractId == f.Contract.ContractId)).UnitId);

        // D48: còn đồ → ghi nhận đồ khách bỏ, không báo lỗi, chưa hoàn tất kiểm tra; gửi lại không ghi trùng.
        var abandoned = await f.RenewalSvc.InspectOldUnitAsync(f.StaffUser.UserId, dto.RenewalId, new UnitMoveInspectionRequest(true, false, 0, "2 thùng carton"));
        Assert.Equal(("MOVED", true, "2 thùng carton"), (abandoned.Status, abandoned.GoodsAbandoned, abandoned.GoodsNote));
        await f.RenewalSvc.InspectOldUnitAsync(f.StaffUser.UserId, dto.RenewalId, new UnitMoveInspectionRequest(true, false, 0, null));
        Assert.Equal(1, await f.Db.ActivityLogs.CountAsync(l => l.Action == RenewalUnitMove.GoodsAbandoned && l.EntityId == dto.RenewalId));

        // Dọn xong ghi kết quả: hệ thống tự chuyển nhưng không tính phí quá hạn ô cũ (thay ý D46b).
        var inspected = await f.RenewalSvc.InspectOldUnitAsync(f.StaffUser.UserId, dto.RenewalId, new UnitMoveInspectionRequest(false, false, 0, null));
        Assert.Equal(("INSPECTED", 0m), (inspected.Status, inspected.Deduction ?? -1));
        Assert.False(await f.Db.Payments.AnyAsync(p => p.RenewalId == dto.RenewalId && p.PaymentType == "OVERDUE_FEE"));
        Assert.Equal(1_500_000m, (await f.Db.RentalContracts.AsNoTracking().SingleAsync(c => c.ContractId == f.Contract.ContractId)).DepositAmount);
    }

    [Fact]
    public async Task D46_LargeDamage_DeductionCappedAtDepositHeld()
    {
        await using var f = await Fixture.CreateAsync();
        var k02 = await AddFreeUnitAsync(f);
        var dto = await RequestApprovePayAsync(f, k02);
        await SetOldEndDateAsync(f, dto.RenewalId, OpsRules.TodayLocal);
        await f.RenewalSvc.MarkUnitMovedAsync(f.CustomerUser.UserId, f.Contract.ContractId);

        var inspected = await f.RenewalSvc.InspectOldUnitAsync(f.StaffUser.UserId, dto.RenewalId, new UnitMoveInspectionRequest(false, true, 5_000_000m, "Hư cửa"));
        Assert.Equal(1_500_000m, inspected.Deduction); // không vượt cọc đang giữ (D31)
        Assert.Equal(0m, (await f.Db.RentalContracts.AsNoTracking().SingleAsync(c => c.ContractId == f.Contract.ContractId)).DepositAmount);
        Assert.Equal("MAINTENANCE", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == f.Unit.UnitId)).Status);
        var refs = await f.Db.Payments.AsNoTracking().Where(p => p.RenewalId == dto.RenewalId && p.PaymentType != "RENEWAL" && p.PaymentType != "DEPOSIT")
            .Select(p => p.TransactionReference).ToListAsync();
        Assert.Equal(2, refs.Count); // vệ sinh + hư hỏng, mỗi khoản một mã giao dịch
        Assert.Equal(refs.Count, refs.Distinct().Count());
        // Khoản khấu trừ đã trừ vào cọc nên phải là PAID (doanh thu) và có thời điểm tạo.
        var fees = await f.Db.Payments.AsNoTracking().Where(p => p.RenewalId == dto.RenewalId && p.PaymentType != "RENEWAL" && p.PaymentType != "DEPOSIT").ToListAsync();
        Assert.All(fees, p => { Assert.Equal("PAID", p.Status); Assert.NotEqual(default, p.CreatedAt); });
    }

    [Fact]
    public async Task D46_ManagerBoard_ShowsTargetUnitAndDepositTopUp()
    {
        await using var f = await Fixture.CreateAsync();
        var k02 = await AddFreeUnitAsync(f);
        await AddDepositPolicyAsync(f, 1_800_000m);
        var swap = await f.RenewalSvc.RequestRenewalAsync(f.CustomerUser.UserId, f.Contract.ContractId, new CreateRenewalRequest(1, 1, true, k02.UnitId));

        var board = await new FacilityOpsService(f.Db).GetBoardAsync(new OpsActor(f.ManagerUser.UserId, true));
        var row = Assert.Single(board.Renewals, r => r.Status == "PENDING");
        Assert.Equal(("K02", 300_000m), (row.TargetUnit, row.DepositTopUp)); // quản lý thấy ô mới và cọc chênh trước khi duyệt

        await f.RenewalSvc.ApproveRenewalAsync(f.ManagerUser.UserId, swap.RenewalId);
        board = await new FacilityOpsService(f.Db).GetBoardAsync(new OpsActor(f.ManagerUser.UserId, true));
        row = Assert.Single(board.Renewals);
        Assert.Equal(("K02", 300_000m, 1_800_000m), (row.TargetUnit, row.DepositTopUp, row.Amount + row.DepositTopUp));
        // Màn quản lý lấy /api/manager/board (ManagerService) — cũng phải có ô mới và cọc chênh.
        var managerBoard = await new ManagerService(f.Db, new StaffService(f.Db)).GetManagerBoardAsync(f.ManagerUser.UserId);
        var mrow = Assert.Single(managerBoard.Renewals, r => r.Id == $"GH-{swap.RenewalId:D4}");
        Assert.Equal(("K02", 300_000m), (mrow.TargetUnit, mrow.DepositTopUp));
    }
}
