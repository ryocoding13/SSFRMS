using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Demo;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>Lượt 6 · #45 #54: Công cụ demo của admin — chỉnh ngày hợp đồng, ngày giao dịch và giá (ghi nhật ký trước/sau).</summary>
public static class DemoToolsEndpoints
{
    public static void MapDemoToolsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/demo").WithTags("Admin Management").RequireAuthorization(p => p.RequireRole("ADMIN"));

        group.MapGet("/contracts", (string? search, IDemoToolsService demo, CancellationToken ct) =>
            Run(async () => Results.Ok(await demo.ListContractsAsync(search, ct))));

        group.MapPut("/contracts/{id:long}", (long id, DemoContractEditRequest request, ClaimsPrincipal user, IDemoToolsService demo, CancellationToken ct) =>
                Run(async () => Results.Ok(await demo.EditContractAsync(user.GetUserId(), id, request, ct))))
            .WithSummary("Chỉnh ngày bắt đầu / hết hạn và giá thuê tháng; đồng bộ trạng thái hợp đồng, ô, số ngày quá hạn");

        group.MapPut("/payments/{id:long}", (long id, DemoPaymentEditRequest request, ClaimsPrincipal user, IDemoToolsService demo, CancellationToken ct) =>
                Run(async () => Results.Ok(await demo.EditPaymentAsync(user.GetUserId(), id, request, ct))))
            .WithSummary("Chỉnh ngày thanh toán (giờ Việt Nam) và số tiền của giao dịch đã phát sinh");
    }

    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
    }
}
