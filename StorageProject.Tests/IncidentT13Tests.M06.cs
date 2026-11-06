using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>M06 · Sự cố cơ sở từ đầu đến cuối: bấm lại / phiên bản cũ không cấp mã lần hai, không hoàn tiền lần hai.</summary>
public sealed partial class IncidentT13Tests
{
    // Bấm lại có thể bị từ chối (phiên bản cũ) hoặc bỏ qua; điều cần kiểm là dữ liệu không bị ghi lần hai.
    private static async Task Retry(Func<Task> action) { try { await action(); } catch (Exception) { } }

    [Fact]
    public async Task M06_TransferRetry_DoesNotIssueCodesTwice_OrMoveUnitAgain()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = Assert.Single((await f.Ops.GetIncidentsAsync(f.ManagerActor)).Items);
        var candidate = Assert.Single(draft.Candidates);
        var sent = (await f.Ops.SaveIncidentAsync(f.ManagerActor, new IncidentActionRequest("SEND_INCIDENT_PROPOSAL", draft.Id, draft.Version,
            "Thấm nước mái kho", Iso(DateTime.UtcNow.AddHours(-1)), true, "TRANSFER", candidate.Id, candidate.Version))).Incident;
        var chosen = (await f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId, new IncidentActionRequest(
            "CHOOSE_INCIDENT_OPTION", sent.Id, sent.Version, TargetUnitId: sent.TargetUnit!.Id, ExpectedTargetVersion: sent.TargetUnit.Version,
            Choice: "TRANSFER", Note: ""))).Incident;
        // Khách bấm chọn lần hai với phiên bản cũ bị từ chối
        await Retry(() => f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId, new IncidentActionRequest(
            "CHOOSE_INCIDENT_OPTION", sent.Id, sent.Version, TargetUnitId: sent.TargetUnit.Id, ExpectedTargetVersion: sent.TargetUnit.Version,
            Choice: "TRANSFER", Note: "")));

        var complete = new IncidentActionRequest("COMPLETE_INCIDENT_TRANSFER", chosen.Id, chosen.Version, Confirmed: true,
            TargetUnitId: chosen.TargetUnit!.Id, ExpectedTargetVersion: chosen.TargetUnit.Version, MovedAt: Iso(DateTime.UtcNow));
        await f.Ops.CompleteIncidentTransferAsync(f.ManagerActor, chosen.Id, complete);
        await Retry(() => f.Ops.CompleteIncidentTransferAsync(f.ManagerActor, chosen.Id, complete));

        var creds = await f.Db.AccessCredentials.AsNoTracking().Where(a => a.ContractId == f.Contract.ContractId && a.Status == "ACTIVE").ToListAsync();
        Assert.Equal(2, creds.Count);
        Assert.All(creds, a => Assert.Equal(f.Spare.UnitId, a.UnitId));
        Assert.Equal(f.Spare.UnitId, (await f.Db.RentalContracts.AsNoTracking().SingleAsync(c => c.ContractId == f.Contract.ContractId)).UnitId);
    }

    [Fact]
    public async Task M06_TerminateRetry_CreatesOneRefund_AndRefundIsPaidOnce()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = Assert.Single((await f.Ops.GetIncidentsAsync(f.ManagerActor)).Items);
        var sent = (await f.Ops.SaveIncidentAsync(f.ManagerActor, new IncidentActionRequest("SEND_INCIDENT_PROPOSAL", draft.Id, draft.Version,
            "Sập kệ trong kho", Iso(DateTime.UtcNow.AddHours(-1)), true, "TERMINATE"))).Incident;
        var chosen = (await f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId, new IncidentActionRequest("CHOOSE_INCIDENT_OPTION",
            sent.Id, sent.Version, Choice: "TERMINATE", Note: "", RefundBank: new RefundBankInput("Vietcombank", "0011223344", "NGUYEN THI MAI")))).Incident;
        var finalize = new IncidentActionRequest("FINALIZE_INCIDENT_TERMINATION", chosen.Id, chosen.Version, Confirmed: true);
        await f.Ops.FinalizeIncidentTerminationAsync(f.ManagerActor, chosen.Id, finalize);
        await Retry(() => f.Ops.FinalizeIncidentTerminationAsync(f.ManagerActor, chosen.Id, finalize));

        var refunds = await f.Db.Payments.AsNoTracking().Where(p => p.ContractId == f.Contract.ContractId && p.PaymentType == "REFUND").ToListAsync();
        Assert.Single(refunds);

        var item = Assert.Single(await f.Ops.GetDepositRefundsAsync(f.ManagerActor));
        var confirm = new DepositRefundActionRequest("CONFIRM_DEPOSIT_REFUND", item.Id, item.Version, "FT26310000888", DateTime.UtcNow, true);
        await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, confirm);
        await Retry(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, confirm));
        var paid = await f.Db.Payments.AsNoTracking().Where(p => p.ContractId == f.Contract.ContractId && p.PaymentType == "REFUND").ToListAsync();
        Assert.Equal("PAID", Assert.Single(paid).Status);
        Assert.Empty(await f.Db.AccessCredentials.AsNoTracking().Where(a => a.ContractId == f.Contract.ContractId && a.Status == "ACTIVE").ToListAsync());
    }
}
