using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints quản lý hợp đồng thuê và trả kho của khách hàng (UC05 / UC06 / F05 / F06).
/// Cho phép xem danh sách hợp đồng của tôi, xem chi tiết, xác nhận bàn giao và đăng ký trả kho kèm ảnh bằng chứng.
/// </summary>
public static class ContractEndpoints
{
    /// <summary>
    /// Đăng ký các route hợp đồng và trả kho (/api/contracts, /api/handovers) vào ứng dụng.
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình quyền xác thực.</returns>
    public static RouteGroupBuilder MapContractEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Contracts & Handovers")
            .RequireAuthorization();

        // GET /api/contracts: Xem danh sách các hợp đồng thuê của khách hàng đăng nhập
        group.MapGet("/contracts", async (ClaimsPrincipal user, IContractService contractService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var contracts = await contractService.GetMyContractsAsync(customerId, ct);
            return Results.Ok(contracts);
        });

        // GET /api/contracts/{id}: Xem chi tiết một hợp đồng cụ thể
        group.MapGet("/contracts/{id:long}", async (long id, ClaimsPrincipal user, IContractService contractService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var detail = await contractService.GetContractDetailAsync(customerId, id, ct);
            return detail is not null ? Results.Ok(detail) : Results.NotFound(new { error = "Không tìm thấy hợp đồng." });
        });

        // POST /api/handovers/{id}/confirm: Khách hàng xác nhận đã nhận bàn giao kho
        group.MapPost("/handovers/{id:long}/confirm", async (long id, ClaimsPrincipal user, IHandoverService handoverService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                await handoverService.ConfirmCustomerHandoverAsync(customerId, id, ct);
                return Results.Ok(new { message = "Khách hàng đã xác nhận bàn giao kho thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/contracts/{id}/move-out: Đăng ký trả kho (Move-out) kèm ảnh bằng chứng và phương thức hoàn cọc (D42/D44)
        group.MapPost("/contracts/{id:long}/move-out", async (long id, StorageProject.Core.DTOs.Contract.MoveOutRequest request, ClaimsPrincipal user, IContractService contractService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var result = await contractService.RegisterMoveOutAsync(customerId, id, request, ct);
                return Results.Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(StorageProject.Infrastructure.Services.EvidencePhotos.RequestBodyLimit));

        return group;
    }
}
