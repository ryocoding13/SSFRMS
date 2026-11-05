using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Entities;
using Xunit;
namespace StorageProject.Tests;

public sealed class SupportInquiryTests
{
    private const string Base = "/api/support/inquiries";
    private static object Create(long facility=1, Guid? key=null, string title="Tư vấn đặt kho") => new {
        action="CREATE_INQUIRY", facilityId=facility, title, description="Chưa có hợp đồng, cần tư vấn kho lạnh.", clientRequestId=key??Guid.NewGuid() };
    private static object Reply(InquiryDto i,string note="Nội dung phản hồi",bool close=false,Guid? key=null) => new {
        action="REPLY_INQUIRY",id=i.Id,note,close,expectedVersion=i.Version,clientRequestId=key??Guid.NewGuid() };
    private sealed record Saved(InquiryDto Item);
    private static async Task<InquiryDto> Save(HttpClient client,object body)
    {
        var response=await client.PostAsJsonAsync(Base+"/actions",body);response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Saved>())!.Item;
    }
    [Fact] public async Task NoContractCustomerAndCorrectFacilityCanConverseCloseAndReloadThroughHttp()
    {
        await using var f=await AuthSupportHttpFixture.Create(withInquiries:true);
        using var customer=f.Client(await f.Login("customer02","Customer@123"));
        using var other=f.Client(await f.Login("customer01","Customer@123"));
        using var staff=f.Client(await f.Login("staff01","Staff@123"));
        using var wrong=f.Client(await f.Login("staff02","Staff@123"));
        await f.WithDb(async db=>Assert.False(await db.RentalContracts.AnyAsync(x=>x.Customer.Username=="customer02")));
        var created=await Save(customer,Create());Assert.Equal("OPEN",created.Status);Assert.Empty(created.Responses);
        Assert.Empty((await other.GetFromJsonAsync<InquiryDto[]>(Base))!);Assert.Empty((await wrong.GetFromJsonAsync<InquiryDto[]>(Base))!);
        Assert.Equal(HttpStatusCode.NotFound,(await other.GetAsync(Base+"/"+created.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await wrong.PostAsJsonAsync(Base+"/actions",Reply(created))).StatusCode);
        var first=await Save(staff,Reply(created,"Cơ sở có kho lạnh 15 m²."));Assert.Equal("WAITING_CUSTOMER",first.Status);Assert.Equal(2,first.Version);
        using var reloaded=f.Client(await f.Login("customer02","Customer@123"));
        var read=await reloaded.GetFromJsonAsync<InquiryDto>(Base+"/"+created.Id);
        Assert.Equal("Cơ sở có kho lạnh 15 m².",Assert.Single(read!.Responses).Text);Assert.Equal("staff01",read.Responses[0].By);
        var answer=await Save(reloaded,Reply(read,"Cảm ơn, cơ sở mở cửa lúc nào?"));Assert.Equal("OPEN",answer.Status);
        // D43: không có thao tác đóng — cờ close của giao diện cũ bị bỏ qua, khách vẫn nhắn tiếp được.
        var closed=await Save(staff,Reply(answer,"Theo giờ cơ sở công bố.",close:true));Assert.Equal("WAITING_CUSTOMER",closed.Status);Assert.Equal(3,closed.Responses.Count);
        var again=await Save(customer,Reply(closed,"Cảm ơn cơ sở."));Assert.Equal("OPEN",again.Status);Assert.Equal(4,again.Responses.Count);
        await f.WithDb(async db=>{Assert.Single(await db.SupportInquiries.ToListAsync());Assert.Equal(4,await db.SupportInquiryReplies.CountAsync());});
    }
    [Fact] public async Task ClientRequestIdPreventsDuplicateCreateAndReplyAndRejectsChangedPayload()
    {
        await using var f=await AuthSupportHttpFixture.Create(withInquiries:true);
        using var customer=f.Client(await f.Login("customer02","Customer@123"));using var staff=f.Client(await f.Login("staff01","Staff@123"));
        var key=Guid.NewGuid();var created=await Save(customer,Create(key:key));Assert.Equal(created.Id,(await Save(customer,Create(key:key))).Id);
        Assert.Equal(HttpStatusCode.Conflict,(await customer.PostAsJsonAsync(Base+"/actions",Create(key:key,title:"Khác"))).StatusCode);
        var rk=Guid.NewGuid();var first=await Save(staff,Reply(created,key:rk));var replay=await Save(staff,Reply(created,key:rk));
        Assert.Equal(first.Version,replay.Version);Assert.Single(replay.Responses);
        Assert.Equal(HttpStatusCode.Conflict,(await staff.PostAsJsonAsync(Base+"/actions",Reply(first,"Khác",key:rk))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await staff.PostAsJsonAsync(Base+"/actions",Reply(created))).StatusCode);
        await f.WithDb(async db=>{Assert.Single(await db.SupportInquiries.ToListAsync());Assert.Single(await db.SupportInquiryReplies.ToListAsync());});
    }
    [Fact] public async Task OwnershipAssignmentDatesAndRoleAreEnforcedByServer()
    {
        await using var f=await AuthSupportHttpFixture.Create(withInquiries:true);using var anonymous=f.Client();
        Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync(Base)).StatusCode);
        using var customer=f.Client(await f.Login("customer02","Customer@123"));using var staff=f.Client(await f.Login("staff01","Staff@123"));
        var created=await Save(customer,Create());
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.PostAsJsonAsync(Base+"/actions",Create())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await customer.PostAsJsonAsync(Base+"/actions",Reply(created,close:true))).StatusCode);
        await f.WithDb(async db=>{(await db.UserFacilities.SingleAsync(x=>x.User.Username=="staff01")).AssignedTo=DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)).AddDays(-1);await db.SaveChangesAsync();});
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.GetAsync(Base)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.PostAsJsonAsync(Base+"/actions",Reply(created))).StatusCode);
    }
    [Fact] public async Task ActiveManagerCanRespondButFutureAssignmentAndLockedAccountCannot()
    {
        await using var f=await AuthSupportHttpFixture.Create(withInquiries:true);
        await f.WithDb(async db=>{var u=await db.Users.SingleAsync(x=>x.Username=="staff01");var role=new Role{RoleName="MANAGER"};db.Roles.Add(role);await db.SaveChangesAsync();db.UserRoles.Add(new UserRole{UserId=u.UserId,RoleId=role.RoleId,AssignedAt=DateTime.UtcNow});await db.SaveChangesAsync();});
        using var customer=f.Client(await f.Login("customer02","Customer@123"));using var manager=f.Client(await f.Login("staff01","Staff@123"));
        var created=await Save(customer,Create());Assert.Equal("WAITING_CUSTOMER",(await Save(manager,Reply(created,"Đã hỗ trợ",close:true))).Status);
        await f.WithDb(async db=>{(await db.UserFacilities.SingleAsync(x=>x.User.Username=="staff01")).AssignedFrom=DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)).AddDays(1);await db.SaveChangesAsync();});
        Assert.Equal(HttpStatusCode.Forbidden,(await manager.GetAsync(Base)).StatusCode);
        await f.WithDb(async db=>{(await db.Users.SingleAsync(x=>x.Username=="customer02")).Status="INACTIVE";await db.SaveChangesAsync();});
        Assert.Equal(HttpStatusCode.Forbidden,(await customer.GetAsync(Base)).StatusCode);
    }
    [Theory]
    [InlineData(0,"Tiêu đề","Nội dung")]
    [InlineData(1," ","Nội dung")]
    [InlineData(1,"Tiêu đề"," ")]
    [InlineData(999,"Tiêu đề","Nội dung")]
    public async Task InvalidInputDoesNotWriteData(long facility,string title,string description)
    {
        await using var f=await AuthSupportHttpFixture.Create(withInquiries:true);using var customer=f.Client(await f.Login("customer02","Customer@123"));
        var response=await customer.PostAsJsonAsync(Base+"/actions",new{action="CREATE_INQUIRY",facilityId=facility,title,description,clientRequestId=Guid.NewGuid()});
        Assert.Equal(HttpStatusCode.BadRequest,response.StatusCode);await f.WithDb(async db=>Assert.Empty(await db.SupportInquiries.ToListAsync()));
    }
    [Fact] public async Task InactiveFacilityRejectsNewInquiryButExistingCustomersCanReadReplies()
    {
        await using var f=await AuthSupportHttpFixture.Create(withInquiries:true);using var customer=f.Client(await f.Login("customer02","Customer@123"));var i=await Save(customer,Create());
        await f.WithDb(async db=>{(await db.Facilities.SingleAsync(x=>x.FacilityId==1)).Status="TEMPORARILY_CLOSED";await db.SaveChangesAsync();});
        Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync(Base+"/actions",Create())).StatusCode);
        (await customer.GetAsync(Base+"/"+i.Id)).EnsureSuccessStatusCode();
    }
}
