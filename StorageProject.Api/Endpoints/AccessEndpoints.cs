using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints phục vụ kiểm soát ra vào ô kho và quét mã (UC13 / D26 / D33).
/// Cung cấp endpoint lấy mã QR mở kho cho khách hàng đăng nhập và endpoint quét mã mở cửa tại thiết bị kho.
/// </summary>
public static class AccessEndpoints
{
    /// <summary>
    /// Đăng ký các route kiểm soát ra vào và quét mã mở kho vào ứng dụng.
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình.</returns>
    public static RouteGroupBuilder MapAccessEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Access & QR");

        // GET /api/contracts/{id}/access-qr: Khách hàng lấy mã QR mở cửa & mã dự phòng (cần đăng nhập)
        group.MapGet("/contracts/{id}/access-qr", async (
            string id,
            ClaimsPrincipal user,
            IAccessService accessService,
            CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                if (!long.TryParse(id, out var contractId))
                {
                    var lastPart = id.Split('-').LastOrDefault();
                    if (!long.TryParse(lastPart, out contractId))
                    {
                        return Results.NotFound(new { error = "Không tìm thấy hợp đồng." });
                    }
                }

                var qr = await accessService.GetQrAsync(customerId, contractId, ct);
                return Results.Ok(qr);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        // POST /api/access/scan: Máy quét tại cửa kho / thiết bị kiểm tra mã (công khai / không cần đăng nhập)
        group.MapPost("/access/scan", async (
            ScanAccessRequest request,
            HttpContext context,
            IAccessService accessService,
            CancellationToken ct) =>
        {
            var ip = context.Connection.RemoteIpAddress?.ToString();
            var result = await accessService.ScanAsync(request.Code, ip, ct, request.UnitNumber);
            return Results.Ok(result);
        }).AllowAnonymous().RequireRateLimiting("access-scan");

        return group;
    }
}
