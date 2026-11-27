using StorageProject.Core.DTOs.FacilityOps;
using Xunit;

namespace StorageProject.Tests;

/// <summary>D72 · Nhân viên / quản lý thấy nội dung khách phản hồi khoản khấu trừ trả kho và kết quả kiểm tra lại.</summary>
public sealed partial class D32RefundEvidenceTests
{
    [Fact]
    public async Task Board_ShowsCustomerDeductionReplyAndRecheckNote()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var inspectionId = await InspectAsync(f, c, cleaning: true, damage: 0);

        var before = Assert.Single((await f.Ops.GetBoardAsync(f.StaffActor)).Returns, r => r.Contract == Code(c));
        Assert.Null(before.DeductionNote);
        Assert.Null(before.CleaningDecision);

        await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("DISPUTE", "Vết bẩn có từ trước khi tôi thuê"));
        f.Db.ChangeTracker.Clear();
        var replied = Assert.Single((await f.Ops.GetBoardAsync(f.StaffActor)).Returns, r => r.Contract == Code(c));
        Assert.Equal("DISPUTE", replied.DeductionStatus);
        Assert.Equal("DISPUTE", replied.CleaningDecision);
        Assert.Equal("Vết bẩn có từ trước khi tôi thuê", replied.DeductionNote);
        Assert.NotNull(replied.DeductionDecidedAt);

        await f.Ops.RecheckReturnAsync(f.StaffActor, $"TK-{inspectionId:0000}", new ReturnRecheckRequest(true, null, "Đã xem ảnh nhận kho, chấp nhận khiếu nại"));
        f.Db.ChangeTracker.Clear();
        var rechecked = Assert.Single((await f.Ops.GetBoardAsync(f.ManagerActor)).Returns, r => r.Contract == Code(c));
        Assert.Equal("Đã xem ảnh nhận kho, chấp nhận khiếu nại", rechecked.RecheckNote);
    }
}
