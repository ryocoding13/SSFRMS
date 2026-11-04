using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Support;
using StorageProject.Infrastructure.Services;
using StorageProject.IntegrationTests.Infrastructure;
using Xunit;
namespace StorageProject.IntegrationTests.Tests;

public sealed class SupportInquirySqlServerTests(SqlServerFixture fixture) : IClassFixture<SqlServerFixture>
{
    [Fact] public async Task SqlServer_ConcurrentRepliesRespectExpectedVersionAndReplayIsIdempotent()
    {
        if (!fixture.IsAvailable) return; // Gate phải đặt REQUIRE_SQLSERVER=true; không coi return là bằng chứng SQL.
        long customerId,staffId,facilityId;
        await using(var db=fixture.CreateContext())
        {
            customerId=await db.Users.Where(x=>x.Username=="customer01").Select(x=>x.UserId).SingleAsync();
            staffId=await db.Users.Where(x=>x.Username=="staff01").Select(x=>x.UserId).SingleAsync();
            facilityId=await db.UserFacilities.Where(x=>x.UserId==staffId&&x.Status=="ACTIVE").Select(x=>x.FacilityId).FirstAsync();
        }
        var create=new InquiryActionRequest("CREATE_INQUIRY",FacilityId:facilityId,Title:"Kiểm tra đồng thời",Description:"Tư vấn trước hợp đồng",ClientRequestId:Guid.NewGuid());
        InquiryDto item;
        await using(var db=fixture.CreateContext()) item=await new SupportInquiryService(db).ActAsync(customerId,create);
        async Task<bool> Reply(string note)
        {
            await using var db=fixture.CreateContext();
            try { await new SupportInquiryService(db).ActAsync(staffId,new("REPLY_INQUIRY",Id:item.Id,Note:note,ExpectedVersion:item.Version,ClientRequestId:Guid.NewGuid()));return true; }
            catch(OpsConflictException) { return false; }
        }
        var results=await Task.WhenAll(Reply("Phản hồi A"),Reply("Phản hồi B"));Assert.Single(results,x=>x);
        await using var verify=fixture.CreateContext();var service=new SupportInquiryService(verify);
        var saved=await service.GetAsync(customerId,item.Id);Assert.Equal(2,saved.Version);Assert.Single(saved.Responses);
        var replay=await service.ActAsync(customerId,create);Assert.Equal(item.Id,replay.Id);Assert.Single(replay.Responses);
    }
}
