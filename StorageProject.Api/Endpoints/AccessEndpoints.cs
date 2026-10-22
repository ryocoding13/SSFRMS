using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class AccessEndpoints
{
    public static RouteGroupBuilder MapAccessEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Access & QR");

        // Khách hàng lấy mã QR mở cửa & mã dự phòng (cần đăng nhập)
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

        // Máy quét tại cửa kho / thiết bị kiểm tra mã (công khai / không cần đăng nhập)
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
