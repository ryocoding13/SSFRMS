using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Services;
using System.Security.Claims;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints xử lý yêu cầu tư vấn hỗ trợ chung của khách hàng (C12-0 / T19).
/// Phục vụ cho khách hàng gửi thắc mắc trước khi thuê kho và nhân viên/quản lý cơ sở trả lời, trao đổi.
/// </summary>
public static class SupportInquiryEndpoints
{
    /// <summary>
    /// Đăng ký các route yêu cầu tư vấn hỗ trợ (/api/support/inquiries) vào ứng dụng.
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    public static void MapSupportInquiryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/support/inquiries").WithTags("Support Inquiries")
            .RequireAuthorization(p => p.RequireRole("CUSTOMER", "STAFF", "MANAGER"));

        // GET /api/support/inquiries: Lấy danh sách các yêu cầu tư vấn của người dùng hiện tại
        group.MapGet("/", (ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.ListAsync(user.GetUserId(), ct))));

        // GET /api/support/inquiries/{id}: Xem chi tiết yêu cầu tư vấn và lịch sử trao đổi
        group.MapGet("/{id}", (string id, ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.GetAsync(user.GetUserId(), id, ct))));

        // POST /api/support/inquiries/actions: Thực hiện hành động CREATE_INQUIRY hoặc REPLY_INQUIRY
        group.MapPost("/actions", (InquiryActionRequest request, ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await service.ActAsync(user.GetUserId(), request, ct) })));

        // POST /api/support/inquiries: Tạo yêu cầu tư vấn hỗ trợ mới
        group.MapPost("/", (InquiryActionRequest request, ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await service.ActAsync(user.GetUserId(), request with { Action = "CREATE_INQUIRY" }, ct) })));
    }

    /// <summary>Bọc thực thi xử lý lỗi chuẩn hóa HTTP Status Code cho các thao tác tư vấn hỗ trợ.</summary>
    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (UnauthorizedAccessException ex) { return Results.Json(new { error = ex.Message }, statusCode: 403); }
        catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        catch (OpsConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return Results.BadRequest(new { error = ex.Message }); }
    }
}
