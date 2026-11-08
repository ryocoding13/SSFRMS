using StorageProject.Core.Exceptions;
using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints quản lý chính sách điều khoản thuê kho và ghi nhận chấp thuận (BO07).
/// Cho phép xem chính sách hiện hành công khai, xem lịch sử phiên bản, công bố phiên bản mới và lưu bằng chứng khách hàng đồng ý điều khoản.
/// </summary>
public static class RentalPolicyEndpoints
{
    /// <summary>
    /// Đăng ký các route chính sách thuê kho (/api/rental-policy, /api/reservations/.../policy-consent).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api đã cấu hình.</returns>
    public static RouteGroupBuilder MapRentalPolicyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Rental Policy");

        // GET /api/rental-policy: Xem nội dung điều khoản chính sách thuê kho hiện hành (công khai)
        group.MapGet("/rental-policy", async (IRentalPolicyService policyService, CancellationToken ct) =>
        {
            var policy = await policyService.GetCurrentPolicyAsync(ct);
            return Results.Ok(policy);
        }).AllowAnonymous();

        // GET /api/rental-policy/versions/{version}: Xem chi tiết một phiên bản chính sách theo số hiệu phiên bản
        group.MapGet("/rental-policy/versions/{version:int}", async (int version, IRentalPolicyService policyService, CancellationToken ct) =>
        {
            var policy = await policyService.GetPolicyVersionAsync(version, ct);
            if (policy == null)
            {
                return Results.NotFound(new { error = $"Không tìm thấy phiên bản chính sách {version}." });
            }
            return Results.Ok(policy);
        }).AllowAnonymous();

        // POST /api/rental-policy/actions: Vận hành KD hoặc Admin ban hành và lưu phiên bản điều khoản mới
        group.MapPost("/rental-policy/actions", async (SaveRentalPolicyRequest request, ClaimsPrincipal user, IRentalPolicyService policyService, CancellationToken ct) =>
        {
            try
            {
                var role = user.GetUserRole();
                if (role != "OPERATIONS" && role != "ADMIN")
                {
                    return Results.Json(new { error = "Chỉ Quản lý vận hành (OPERATIONS) hoặc Quản trị hệ thống mới có quyền lưu chính sách." }, statusCode: StatusCodes.Status403Forbidden);
                }

                var userId = user.GetUserId();
                var result = await policyService.SaveRentalPolicyAsync(userId, request, ct);
                return Results.Ok(result);
            }
            catch (OperationConflictException ex)
            {
                return Results.Conflict(new { error = ex.Message, details = ex.Details });
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("người khác cập nhật") || ex.Message.Contains("xung đột"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        // POST /api/reservations/{id}/policy-consent: Khách hàng xác nhận đồng ý điều khoản khi đặt chỗ
        group.MapPost("/reservations/{id:long}/policy-consent", async (long id, PolicyConsentRequest request, ClaimsPrincipal user, IRentalPolicyService policyService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var consent = await policyService.RecordReservationConsentAsync(customerId, id, request, "WEB", ct);
                return Results.Ok(consent);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        return group;
    }
}
