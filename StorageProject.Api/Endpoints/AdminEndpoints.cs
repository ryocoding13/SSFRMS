using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Admin;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admin")
            .WithTags("Admin Management")
            .RequireAuthorization(policy => policy.RequireRole("ADMIN"));

        // ==========================================
        // 1. Dashboard Stats
        // ==========================================
        group.MapGet("/dashboard/stats", async (IAdminService adminService, CancellationToken ct) =>
        {
            var stats = await adminService.GetDashboardStatsAsync(ct);
            return Results.Ok(stats);
        })
        .WithName("GetAdminDashboardStats")
        .WithSummary("Thống kê tổng quan hệ thống cho Admin");

        // ==========================================
        // 2. User Management (UC24)
        // ==========================================
        group.MapGet("/users", async (
            IAdminService adminService,
            int? page,
            int? pageSize,
            string? searchTerm,
            string? status,
            long? roleId,
            CancellationToken ct) =>
        {
            var filter = new UserQueryFilter(
                Page: page ?? 1,
                PageSize: pageSize ?? 20,
                SearchTerm: searchTerm,
                Status: status,
                RoleId: roleId
            );
            var result = await adminService.GetUsersAsync(filter, ct);
            return Results.Ok(result);
        })
        .WithName("GetAdminUsers")
        .WithSummary("Danh sách tài khoản người dùng có phân trang và tìm kiếm");

        group.MapGet("/users/{id:long}", async (long id, IAdminService adminService, CancellationToken ct) =>
        {
            var user = await adminService.GetUserDetailAsync(id, ct);
            return user != null ? Results.Ok(user) : Results.NotFound(new { message = $"Không tìm thấy người dùng với ID: {id}" });
        })
        .WithName("GetAdminUserDetail")
        .WithSummary("Xem chi tiết hồ sơ tài khoản người dùng");

        group.MapPost("/users", async (
            AdminCreateUserRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                var createdUser = await adminService.CreateUserAsync(request, currentAdminId, ct);
                return Results.Created($"/api/admin/users/{createdUser.UserId}", createdUser);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("CreateAdminUser")
        .WithSummary("Tạo tài khoản người dùng mới (Staff/Manager/Admin/Customer)");

        group.MapPut("/users/{id:long}", async (
            long id,
            AdminUpdateUserRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                var updatedUser = await adminService.UpdateUserAsync(id, request, currentAdminId, ct);
                return Results.Ok(updatedUser);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("UpdateAdminUser")
        .WithSummary("Cập nhật thông tin hoặc thay đổi trạng thái người dùng");

        group.MapPost("/users/{id:long}/reset-password", async (
            long id,
            AdminResetPasswordRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                await adminService.ResetUserPasswordAsync(id, request, currentAdminId, ct);
                return Results.Ok(new { message = "Đặt lại mật khẩu người dùng thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("ResetAdminUserPassword")
        .WithSummary("Đặt lại mật khẩu cho tài khoản người dùng");

        // ==========================================
        // 3. Role & Permission Management (UC25, UC26)
        // ==========================================
        group.MapGet("/roles", async (IAdminService adminService, CancellationToken ct) =>
        {
            var roles = await adminService.GetAllRolesAsync(ct);
            return Results.Ok(roles);
        })
        .WithName("GetAdminRoles")
        .WithSummary("Danh sách các vai trò và quyền hạn tương ứng");

        group.MapPost("/users/{id:long}/roles", async (
            long id,
            AssignRoleRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                await adminService.AssignRoleAsync(id, request.RoleId, currentAdminId, ct);
                return Results.Ok(new { message = "Gán vai trò cho người dùng thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("AssignRoleToUser")
        .WithSummary("Gán vai trò cho người dùng");

        group.MapDelete("/users/{id:long}/roles/{roleId:long}", async (
            long id,
            long roleId,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                await adminService.RevokeRoleAsync(id, roleId, currentAdminId, ct);
                return Results.Ok(new { message = "Thu hồi vai trò của người dùng thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("RevokeRoleFromUser")
        .WithSummary("Thu hồi vai trò của người dùng");

        group.MapGet("/permissions", async (IAdminService adminService, CancellationToken ct) =>
        {
            var permissions = await adminService.GetAllPermissionsAsync(ct);
            return Results.Ok(permissions);
        })
        .WithName("GetAdminPermissions")
        .WithSummary("Danh mục toàn bộ quyền hạn trong hệ thống");

        group.MapPost("/roles/{roleId:long}/permissions", async (
            long roleId,
            AssignPermissionRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                await adminService.AssignPermissionToRoleAsync(roleId, request.PermissionId, currentAdminId, ct);
                return Results.Ok(new { message = "Gán quyền hạn cho vai trò thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("AssignPermissionToRole")
        .WithSummary("Gán quyền hạn cho vai trò");

        group.MapDelete("/roles/{roleId:long}/permissions/{permissionId:long}", async (
            long roleId,
            long permissionId,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                await adminService.RevokePermissionFromRoleAsync(roleId, permissionId, currentAdminId, ct);
                return Results.Ok(new { message = "Thu hồi quyền hạn khỏi vai trò thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
        })
        .WithName("RevokePermissionFromRole")
        .WithSummary("Thu hồi quyền hạn khỏi vai trò");

        // ==========================================
        // 4. Facility Scope Management (UC26)
        // ==========================================
        group.MapGet("/users/{id:long}/facilities", async (long id, IAdminService adminService, CancellationToken ct) =>
        {
            var facilities = await adminService.GetUserFacilitiesAsync(id, ct);
            return Results.Ok(facilities);
        })
        .WithName("GetAdminUserFacilities")
        .WithSummary("Lịch sử phân công cơ sở của nhân viên/quản lý");

        group.MapPost("/user-facilities", async (
            AssignUserFacilityRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                var assignment = await adminService.AssignUserFacilityAsync(request, currentAdminId, ct);
                return Results.Created($"/api/admin/user-facilities/{assignment.UserFacilityId}", assignment);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("AssignAdminUserFacility")
        .WithSummary("Phân công cơ sở kho cho nhân viên/quản lý (ràng buộc tối đa 1 ACTIVE)");

        group.MapPut("/user-facilities/{id:long}/status", async (
            long id,
            UpdateUserFacilityStatusRequest request,
            IAdminService adminService,
            ClaimsPrincipal principal,
            CancellationToken ct) =>
        {
            try
            {
                var currentAdminId = principal.GetUserId();
                await adminService.UpdateUserFacilityStatusAsync(id, request.Status, currentAdminId, ct);
                return Results.Ok(new { message = "Cập nhật trạng thái phân công cơ sở thành công." });
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("UpdateAdminUserFacilityStatus")
        .WithSummary("Kết thúc hoặc cập nhật trạng thái phân công cơ sở");

        // ==========================================
        // 5. Audit & Logs (UC27)
        // ==========================================
        group.MapGet("/logs/login-history", async (
            IAdminService adminService,
            int? page,
            int? pageSize,
            long? userId,
            string? status,
            DateTime? fromDate,
            DateTime? toDate,
            CancellationToken ct) =>
        {
            var filter = new LogQueryFilter(
                Page: page ?? 1,
                PageSize: pageSize ?? 20,
                UserId: userId,
                Action: status,
                FromDate: fromDate,
                ToDate: toDate
            );
            var result = await adminService.GetLoginHistoriesAsync(filter, ct);
            return Results.Ok(result);
        })
        .WithName("GetAdminLoginHistory")
        .WithSummary("Tra cứu lịch sử đăng nhập hệ thống");

        group.MapGet("/logs/activity-logs", async (
            IAdminService adminService,
            int? page,
            int? pageSize,
            long? userId,
            string? action,
            string? entityType,
            DateTime? fromDate,
            DateTime? toDate,
            CancellationToken ct) =>
        {
            var filter = new LogQueryFilter(
                Page: page ?? 1,
                PageSize: pageSize ?? 20,
                UserId: userId,
                Action: action,
                EntityType: entityType,
                FromDate: fromDate,
                ToDate: toDate
            );
            var result = await adminService.GetActivityLogsAsync(filter, ct);
            return Results.Ok(result);
        })
        .WithName("GetAdminActivityLogs")
        .WithSummary("Tra cứu nhật ký hoạt động kiểm toán (Audit Logs)");
    }
}
