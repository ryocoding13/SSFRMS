using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>S07 · Nhân viên chỉ thao tác hồ sơ của cơ sở mình; bấm lại không ghi biên bản lần hai.</summary>
public sealed partial class D32RefundEvidenceTests
{
    [Fact]
    public async Task S07_StaffOfOtherFacility_CannotReadOrInspect_AndResubmitDoesNotDuplicate()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var res = await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg)));
        var code = $"TK-{res.InspectionId:0000}";

        var other = new Facility { Name = "SafeSpace Cơ sở B", Address = "2 B", Status = "ACTIVE" };
        var staffB = new User { Username = "staff09", Email = "staff09@example.com", FullName = "Nhân Viên B", PasswordHash = "x", Status = "ACTIVE" };
        f.Db.AddRange(other, staffB);
        await f.Db.SaveChangesAsync();
        f.Db.UserFacilities.Add(new UserFacility { UserId = staffB.UserId, FacilityId = other.FacilityId, Status = "ACTIVE", AssignedBy = f.Manager.UserId, AssignedFrom = TodayVn.AddDays(-1), CreatedAt = DateTime.UtcNow });
        await f.Db.SaveChangesAsync();
        var actorB = new OpsActor(staffB.UserId, false);
        var report = new OpsReturnInspectionRequest("Đạt · không còn đồ", "Đạt · tường sàn cửa nguyên vẹn", "Đã nhận đủ chìa", "Sẵn sàng cho thuê lại", 0, false, null, null, [Photo(Jpeg)]);

        // Cơ sở B không thấy và không ghi được biên bản của cơ sở A
        await Assert.ThrowsAnyAsync<Exception>(() => f.Ops.SubmitReturnInspectionAsync(actorB, code, report));
        await Assert.ThrowsAnyAsync<Exception>(() => f.Ops.GetReturnDeductionAsync(staffB.UserId, Code(c)));
        Assert.NotEqual("COMPLETED", (await f.Db.ReturnInspections.AsNoTracking().SingleAsync(i => i.InspectionId == res.InspectionId)).Status);

        // Nhân viên đúng cơ sở gửi; bấm lại không tạo biên bản/ghi đè lần hai
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, code, report);
        try { await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, code, report); } catch (Exception) { }
        Assert.Single(await f.Db.ReturnInspections.AsNoTracking().Where(i => i.ContractId == c.ContractId).ToListAsync());
        Assert.Single(await f.Db.ActivityLogs.AsNoTracking().Where(l => l.Action == "RETURN_INSPECTED" && l.EntityId == res.InspectionId).ToListAsync());
    }

    [Fact]
    public async Task Cau7_SelfReplace_AttachesCustomerPhotos_OtherChoicesCannot()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        await InspectAsync(f, c, cleaning: false, damage: 200_000m);

        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c),
            new ReturnDeductionDecisionRequest("AGREE", null, [Photo(Jpeg)])));
        var view = await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c),
            new ReturnDeductionDecisionRequest("SELF_REPLACE", "Thay bản lề tương đương trong 3 ngày", [Photo(Jpeg)]));
        Assert.Equal("SELF_REPLACE", view.Status);
        Assert.Single(view.CustomerPhotos!);
        var board = await f.Ops.GetBoardAsync(f.StaffActor);
        Assert.Single(Assert.Single(board.Returns).DeductionPhotos!);
    }
}
