using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Demo;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Exceptions;
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

        // D57 · Chỉnh giá theo cơ sở (giống Bảng giá thuê của Vận hành KD): giá 4 loại kho của một cơ sở.
        group.MapGet("/rates", (long facilityId, IOperationsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetRatesAsync(facilityId, null, false, ct))))
            .WithSummary("Giá thuê tháng đang áp dụng của các loại kho trong một cơ sở");

        group.MapPost("/rates", (SetRateRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.SetRateAsync(request with { EffectiveFrom = null }, user.GetUserId(), ct))))
            .WithSummary("Đặt giá mới áp dụng từ hôm nay cho báo giá và đơn đặt mới; hợp đồng đang thuê giữ giá đã chốt (ghi RATE_SET)");
    }

    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
        catch (OperationConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
    }
}
