using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class RentalPolicyEndpoints
{
    public static RouteGroupBuilder MapRentalPolicyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Rental Policy");

        // Public GET /api/rental-policy
        group.MapGet("/rental-policy", async (IRentalPolicyService policyService, CancellationToken ct) =>
        {
            var policy = await policyService.GetCurrentPolicyAsync(ct);
            return Results.Ok(policy);
        }).AllowAnonymous();

        // Public GET /api/rental-policy/versions/{version:int}
        group.MapGet("/rental-policy/versions/{version:int}", async (int version, IRentalPolicyService policyService, CancellationToken ct) =>
        {
            var policy = await policyService.GetPolicyVersionAsync(version, ct);
            if (policy == null)
            {
                return Results.NotFound(new { error = $"Không tìm thấy phiên bản chính sách {version}." });
            }
            return Results.Ok(policy);
        }).AllowAnonymous();

        // POST /api/rental-policy/actions - OPERATIONS or ADMIN only
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
            catch (InvalidOperationException ex) when (ex.Message.Contains("người khác cập nhật") || ex.Message.Contains("xung đột"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        // POST /api/reservations/{id:long}/policy-consent - Customer consent
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
