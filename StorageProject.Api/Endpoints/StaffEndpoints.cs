using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class StaffEndpoints
{
    public static RouteGroupBuilder MapStaffEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/staff")
            .WithTags("Staff Operations")
            .RequireAuthorization();

        // 1. Staff Board
        group.MapGet("/board", async (ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            var userId = user.GetUserId();
            var board = await staffService.GetStaffBoardAsync(userId, ct);
            return Results.Ok(board);
        });

        // 2. Payments Verification
        group.MapPost("/payments/{id}/confirm", async (string id, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.ConfirmPaymentAsync(userId, id, ct);
                return Results.Ok(new { message = "Xác nhận thanh toán thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/payments/{id}/mismatch", async (string id, MismatchPaymentRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.MismatchPaymentAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Ghi nhận sai lệch thanh toán." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 3. Customer Verification
        group.MapPost("/verifications/{id}", async (string id, VerifyCustomerRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.VerifyCustomerAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Xác minh thông tin khách hàng thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 4. Handover
        group.MapPost("/handovers/{id}/complete", async (string id, CompleteHandoverRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.CompleteHandoverAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Hoàn tất bàn giao kho." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 5. Return Inspection
        group.MapPost("/returns/{id}/inspection", async (string id, ReturnInspectionRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.SubmitReturnInspectionAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Lưu biên bản kiểm tra trả kho thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 6. Support Tickets
        group.MapPost("/tickets/{id}/responses", async (string id, TicketResponseRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.AddTicketResponseAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Phản hồi yêu cầu hỗ trợ thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 7. Unit Status Management (UC09)
        group.MapPut("/units/{id}/status", async (string id, UpdateUnitStatusRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.UpdateUnitStatusAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Cập nhật trạng thái ô kho thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 8. Access Credentials Management (UC08)
        group.MapPost("/credentials/{id}/revoke", async (string id, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.RevokeCredentialAsync(userId, id, ct);
                return Results.Ok(new { message = "Thu hồi phương thức truy cập thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/credentials/reissue", async (ReissueCredentialRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            try
            {
                var userId = user.GetUserId();
                await staffService.ReissueCredentialAsync(userId, request, ct);
                return Results.Ok(new { message = "Cấp lại phương thức truy cập thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // Backward compatibility routes for /api/ops/
        var opsGroup = app.MapGroup("/api/ops").WithTags("Operations (Compatibility)").RequireAuthorization();
        opsGroup.MapPost("/payments/{id}/confirm", async (string id, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var userId = user.GetUserId();
            await staffService.ConfirmPaymentAsync(userId, id, ct);
            return Results.Ok(new { message = "Xác nhận thanh toán thành công." });
        });
        opsGroup.MapPost("/payments/{id}/mismatch", async (string id, MismatchPaymentRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var userId = user.GetUserId();
            await staffService.MismatchPaymentAsync(userId, id, request, ct);
            return Results.Ok(new { message = "Ghi nhận sai lệch thanh toán." });
        });
        opsGroup.MapPost("/verifications/{id}", async (string id, VerifyCustomerRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var userId = user.GetUserId();
            await staffService.VerifyCustomerAsync(userId, id, request, ct);
            return Results.Ok(new { message = "Xác minh thông tin khách hàng thành công." });
        });
        opsGroup.MapPost("/handovers/{id}/complete", async (string id, CompleteHandoverRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var userId = user.GetUserId();
            await staffService.CompleteHandoverAsync(userId, id, request, ct);
            return Results.Ok(new { message = "Hoàn tất bàn giao kho." });
        });
        opsGroup.MapPost("/returns/{id}/inspection", async (string id, ReturnInspectionRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var userId = user.GetUserId();
            await staffService.SubmitReturnInspectionAsync(userId, id, request, ct);
            return Results.Ok(new { message = "Lưu biên bản kiểm tra trả kho thành công." });
        });
        opsGroup.MapPost("/tickets/{id}/responses", async (string id, TicketResponseRequest request, ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var userId = user.GetUserId();
            await staffService.AddTicketResponseAsync(userId, id, request, ct);
            return Results.Ok(new { message = "Phản hồi yêu cầu hỗ trợ thành công." });
        });

        return group;
    }
}
