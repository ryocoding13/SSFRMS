using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class ManagerEndpoints
{
    public static RouteGroupBuilder MapManagerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/manager")
            .WithTags("Manager Operations")
            .RequireAuthorization();

        // 1. Manager Board
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

        // 2. Allocations
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

        // 3. Assignments
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

        // 4. Renewals
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
        });

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

        // 5. Reminders & Refunds
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

        // Đường cũ giữ lại cho tương thích: dùng chung logic D27 với POST /api/ops/contracts/{id}/refund.
        group.MapPost("/contracts/{id}/refund", async (string id, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
        {
            try
            {
                var actor = new OpsActor(user.GetUserId(), user.GetUserRole().Equals("MANAGER", StringComparison.OrdinalIgnoreCase));
                var refund = await ops.ConfirmRefundAsync(actor, id, ct);
                return Results.Ok(new { message = "Xác nhận hoàn cọc thành công.", refund });
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

        // 6. Facility Storage Units Management (UC13)
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
