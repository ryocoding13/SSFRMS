using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints phục vụ quyền hạn của Quản lý cơ sở (Manager Operations - M01-M08 / UC11-UC14).
/// Quản lý bảng điều khiển Quản lý, duyệt phân bổ ô (M05), phân công nhân viên, duyệt gia hạn (M01), chốt hoàn cọc (M07) và quản lý danh sách ô kho.
/// </summary>
public static class ManagerEndpoints
{
    /// <summary>
    /// Đăng ký các route tác vụ của Quản lý cơ sở (/api/manager).
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api/manager đã cấu hình quyền MANAGER hoặc ADMIN.</returns>
    public static RouteGroupBuilder MapManagerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/manager")
            .WithTags("Manager Operations")
            .RequireAuthorization();

        // 1. GET /api/manager/board: Lấy bảng điều khiển quản lý và số liệu thống kê cơ sở
        group.MapGet("/board", async (ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            var userId = user.GetUserId();
            var board = await managerService.GetManagerBoardAsync(userId, ct);
            return Results.Ok(board);
        });

        // 2. POST /api/manager/allocations/{id}: Quản lý duyệt và phân bổ ô kho cho đơn đặt chỗ (M05 / D41)
        group.MapPost("/allocations/{id}", async (string id, AllocateUnitRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                await managerService.AllocateUnitAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Phân bổ kho thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 3. PUT /api/manager/assignments/{id}: Phân công nhân viên phụ trách ca kiểm tra hoặc bàn giao
        group.MapPut("/assignments/{id}", async (string id, AssignStaffRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                await managerService.AssignStaffAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Phân công nhân viên thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 4. POST /api/manager/renewals/{id}/approve: Quản lý phê duyệt yêu cầu gia hạn hợp đồng (M01 / D32)
        group.MapPost("/renewals/{id}/approve", async (string id, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                await managerService.ApproveRenewalAsync(userId, id, ct);
                return Results.Ok(new { message = "Phê duyệt gia hạn thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        // POST /api/manager/renewals/{id}/reject: Quản lý từ chối yêu cầu gia hạn kèm lý do
        group.MapPost("/renewals/{id}/reject", async (string id, RejectRenewalRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                await managerService.RejectRenewalAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Từ chối gia hạn thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 5. POST /api/manager/contracts/{id}/reminders: Ghi nhận lịch sử gọi điện/nhắc nhở khách quá hạn (M04 / D32)
        group.MapPost("/contracts/{id}/reminders", async (string id, AddReminderRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                await managerService.AddContractReminderAsync(userId, id, request, ct);
                return Results.Ok(new { message = "Ghi nhận lịch sử nhắc nhở." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/manager/contracts/{id}/refund: Đường dẫn cũ quản lý duyệt hoàn cọc trả kho (tương thích D27/D32)
        group.MapPost("/contracts/{id}/refund", async (string id, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
        {
            try
            {
                var actor = new OpsActor(user.GetUserId(), user.GetUserRole().Equals("MANAGER", StringComparison.OrdinalIgnoreCase));
                var result = await ops.ConfirmRefundAsync(actor, id, null, ct);
                return Results.Ok(new { message = "Đã chốt quyết toán trả kho.", refund = result.Refund, refundStatus = result.RefundStatus });
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Forbid();
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // 6. GET /api/manager/units: Danh sách ô kho và trạng thái chi tiết của cơ sở (UC13)
        group.MapGet("/units", async (ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            var userId = user.GetUserId();
            var units = await managerService.GetFacilityUnitsAsync(userId, ct);
            return Results.Ok(units);
        });

        // POST /api/manager/units: Tạo ô kho mới tại cơ sở
        group.MapPost("/units", async (CreateStorageUnitRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                var created = await managerService.CreateUnitAsync(userId, request, ct);
                return Results.Created($"/api/manager/units/{created.Code}", created);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // PUT /api/manager/units/{id}: Cập nhật thông tin ô kho (vị trí, mô tả)
        group.MapPut("/units/{id}", async (string id, UpdateStorageUnitRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                var updated = await managerService.UpdateUnitAsync(userId, id, request, ct);
                return Results.Ok(updated);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/manager/units/{id}/lock: Khóa tạm thời hoặc chuyển trạng thái ô kho sang OUT_OF_SERVICE
        group.MapPost("/units/{id}/lock", async (string id, LockUnitRequest request, ClaimsPrincipal user, IManagerService managerService, CancellationToken ct) =>
        {
            var role = user.GetUserRole();
            if (!role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase) && !role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            try
            {
                var userId = user.GetUserId();
                await managerService.LockUnitAsync(userId, id, request, ct);
                return Results.Ok(new { message = $"Đã khóa ô kho {id} thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        return group;
    }
}
