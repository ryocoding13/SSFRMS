using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints phục vụ ca làm việc của Nhân viên cơ sở (Staff Operations - S01-S09 / UC08-UC10).
/// Quản lý bảng việc Kanban nhân viên, xác nhận chuyển khoản, xác minh khách hàng, bàn giao chìa khóa, trả lời ticket và cấp lại mã.
/// </summary>
public static class StaffEndpoints
{
    /// <summary>
    /// Đăng ký các route tác vụ của nhân viên cơ sở (/api/staff).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api/staff đã cấu hình quyền STAFF hoặc MANAGER.</returns>
    public static RouteGroupBuilder MapStaffEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/staff")
            .WithTags("Staff Operations")
            .RequireAuthorization(policy => policy.RequireRole("STAFF", "MANAGER"));

        // 1. GET /api/staff/board: Lấy bảng điều khiển công việc 3x3 của nhân viên cơ sở
        group.MapGet("/board", async (ClaimsPrincipal user, IStaffService staffService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (role.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

            var userId = user.GetUserId();
            var board = await staffService.GetStaffBoardAsync(userId, ct);
            return Results.Ok(board);
        });

        // 2. POST /api/staff/payments/{id}/confirm: Nhân viên xác nhận đã nhận chuyển khoản đặt chỗ (S09 / F03)
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

        // D42: Bỏ báo cáo sai lệch thanh toán (POST /payments/{id}/mismatch đã gỡ; dữ liệu cũ trong DB giữ nguyên).

        // 3. POST /api/staff/verifications/{id}: Xác minh danh tính khách hàng (CCCD/Passport)
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

        // 4. POST /api/staff/handovers/{id}/complete: Hoàn tất bàn giao chìa khóa cơ sở (S02/S03)
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

        // 5. POST /api/staff/returns/{id}/inspection: Route cũ ngừng dùng (trả 410 Gone theo S03, dùng chuẩn ops /api/ops/returns/{id}/inspection)
        group.MapPost("/returns/{id}/inspection", (string id) =>
            Results.Json(new { error = "Đường kiểm tra trả kho này đã ngừng. Dùng POST /api/ops/returns/{id}/inspection.", code = "USE_OPS_RETURN_INSPECTION" },
                statusCode: StatusCodes.Status410Gone));

        // 6. POST /api/staff/tickets/{id}/responses: Nhân viên gửi phản hồi cho yêu cầu hỗ trợ của khách hàng
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

        // 7. PUT /api/staff/units/{id}/status: Cập nhật trạng thái bảo trì hoặc khóa ô kho thủ công (UC09 / UnitStatusRules)
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

        // 8. POST /api/staff/credentials/reissue: Cấp lại phương thức truy cập mở kho (PIN/QR) khi bị mất hoặc hỏng (UC08 / D26)
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

        return group;
    }
}
