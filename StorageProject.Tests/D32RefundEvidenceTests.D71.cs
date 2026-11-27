using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using Xunit;

namespace StorageProject.Tests;

/// <summary>D71 · Quản lý trả biên bản trả kho cho nhân viên kiểm tra lại (ghi chú bắt buộc, biên bản mới).</summary>
public sealed partial class D32RefundEvidenceTests
{
    private static OpsReturnInspectionRequest Report(bool cleaning, decimal damage)
    {
        var ready = !cleaning && damage == 0;
        return new OpsReturnInspectionRequest(
            "Đạt · không còn đồ", ready ? "Đạt · tường sàn cửa nguyên vẹn" : "Trầy cửa", "Đã nhận đủ chìa",
            ready ? "Sẵn sàng cho thuê lại" : "Cần bảo trì trước khi cho thuê lại",
            damage, cleaning, damage > 0 ? "Cửa cuốn" : null, cleaning || damage > 0 ? "Theo biên bản" : null,
            new[] { Photo(Jpeg) });
    }

    private static async Task<ReturnInspection> RedoAsync(Fixture f, long inspectionId, string note = "Chụp lại ảnh tường trái")
    {
        await f.Ops.RedoReturnInspectionAsync(f.ManagerActor, $"TK-{inspectionId:0000}", new OpsNoteRequest(note));
        f.Db.ChangeTracker.Clear();
        return await f.Db.ReturnInspections.AsNoTracking()
            .SingleAsync(i => i.ContractId == f.Db.ReturnInspections.Where(x => x.InspectionId == inspectionId).Select(x => x.ContractId).First()
                              && i.Status == "SCHEDULED");
    }

    [Fact]
    public async Task Redo_ManagerSendsReportBack_StaffSubmitsNewReport_ThenSettles()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var oldId = await InspectAsync(f, c, cleaning: false, damage: 0);
        var oldCode = $"TK-{oldId:0000}";

        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.RedoReturnInspectionAsync(f.ManagerActor, oldCode, new OpsNoteRequest("  ")));
        await Assert.ThrowsAnyAsync<Exception>(() => f.Ops.RedoReturnInspectionAsync(f.StaffActor, oldCode, new OpsNoteRequest("Kiểm lại")));

        var redo = await RedoAsync(f, oldId);
        Assert.Equal("CANCELLED", (await f.Db.ReturnInspections.AsNoTracking().SingleAsync(i => i.InspectionId == oldId)).Status);
        Assert.NotEqual(oldId, redo.InspectionId);
        Assert.Equal("RETURN_PENDING", (await f.Db.RentalContracts.AsNoTracking().SingleAsync(x => x.ContractId == c.ContractId)).Status);

        // Chưa có biên bản mới thì không chốt được; trả lại lần nữa cũng không được.
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.RedoReturnInspectionAsync(f.ManagerActor, oldCode, new OpsNoteRequest("Lần nữa")));

        // Nhân viên thấy ghi chú của quản lý trên lịch kiểm tra mới.
        var board = await f.Ops.GetBoardAsync(f.StaffActor);
        var item = Assert.Single(board.Returns, r => r.Contract == Code(c));
        Assert.Equal("SCHEDULED", item.Status);
        Assert.Equal("Chụp lại ảnh tường trái", item.RedoNote);
        Assert.Equal(oldCode, item.PreviousReturnId);

        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, $"TK-{redo.InspectionId:0000}", Report(cleaning: false, damage: 0));
        f.Db.ChangeTracker.Clear();
        Assert.Equal(1_000_000m, (await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c))).Refund);
        // Đã chốt thì không trả lại được nữa.
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.RedoReturnInspectionAsync(f.ManagerActor, $"TK-{redo.InspectionId:0000}", new OpsNoteRequest("Muộn rồi")));
    }

    [Fact]
    public async Task Redo_SameDeduction_KeepsCustomerChoice()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var oldId = await InspectAsync(f, c, cleaning: true, damage: 0);
        Assert.Equal("SELF_CLEAN", (await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c),
            new ReturnDeductionDecisionRequest("SELF_CLEAN", "Tôi tự dọn"))).Status);

        var redo = await RedoAsync(f, oldId);
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, $"TK-{redo.InspectionId:0000}", Report(cleaning: true, damage: 0));
        f.Db.ChangeTracker.Clear();

        // Khấu trừ không đổi → khách không phải xác nhận lại; phương án tự dọn vẫn chờ nhân viên kiểm tra lại.
        Assert.Equal("SELF_CLEAN", (await f.Ops.GetReturnDeductionAsync(f.Customer.UserId, Code(c))).Status);
        await f.Ops.RecheckReturnAsync(f.StaffActor, $"TK-{redo.InspectionId:0000}", new ReturnRecheckRequest(true, null, "Khách đã dọn"));
        f.Db.ChangeTracker.Clear();
        Assert.Equal(1_000_000m, (await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c))).Refund);
    }

    [Fact]
    public async Task Redo_ChangedDeduction_CustomerConfirmsAgain()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var oldId = await InspectAsync(f, c, cleaning: true, damage: 0);
        await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("SELF_CLEAN", "Tôi tự dọn"));

        var redo = await RedoAsync(f, oldId, "Có hư hỏng cửa cuốn chưa ghi");
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, $"TK-{redo.InspectionId:0000}", Report(cleaning: true, damage: 200_000m));
        f.Db.ChangeTracker.Clear();

        var view = await f.Ops.GetReturnDeductionAsync(f.Customer.UserId, Code(c));
        Assert.Equal("WAITING", view.Status);
        Assert.Equal(200_000m, view.DamageFee);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c)));
    }
}
