using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Services;
using System.Security.Claims;

namespace StorageProject.Api.Endpoints;
public static class SupportInquiryEndpoints
{
    public static void MapSupportInquiryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/support/inquiries").WithTags("Support Inquiries")
            .RequireAuthorization(p => p.RequireRole("CUSTOMER", "STAFF", "MANAGER"));
        group.MapGet("/", (ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.ListAsync(user.GetUserId(), ct))));
        group.MapGet("/{id}", (string id, ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.GetAsync(user.GetUserId(), id, ct))));
        group.MapPost("/actions", (InquiryActionRequest request, ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await service.ActAsync(user.GetUserId(), request, ct) })));
        group.MapPost("/", (InquiryActionRequest request, ClaimsPrincipal user, ISupportInquiryService service, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await service.ActAsync(user.GetUserId(), request with { Action = "CREATE_INQUIRY" }, ct) })));
    }
    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (UnauthorizedAccessException ex) { return Results.Json(new { error = ex.Message }, statusCode: 403); }
        catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        catch (OpsConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return Results.BadRequest(new { error = ex.Message }); }
    }
}
