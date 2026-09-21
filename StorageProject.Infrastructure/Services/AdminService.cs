using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Admin;
using StorageProject.Core.DTOs.Common;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class AdminService(AppDbContext dbContext) : IAdminService
{
    // --- Helper: Audit Logging ---
    private async Task LogActivityAsync(
        long? userId,
        string action,
        string entityType,
        long? entityId,
        object? oldValue = null,
        object? newValue = null,
        CancellationToken ct = default)
    {
        var log = new ActivityLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValue = oldValue != null ? (oldValue is string s1 ? s1 : JsonSerializer.Serialize(oldValue)) : null,
            NewValue = newValue != null ? (newValue is string s2 ? s2 : JsonSerializer.Serialize(newValue)) : null,
            LoggedAt = DateTime.UtcNow
        };
        dbContext.ActivityLogs.Add(log);
    }

    // ==========================================
    // UC24: User Management
    // ==========================================

    public async Task<PagedResult<AdminUserListItemDto>> GetUsersAsync(UserQueryFilter filter, CancellationToken ct = default)
    {
        var query = dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var search = filter.SearchTerm.Trim().ToLower();
            query = query.Where(u =>
                u.Username.ToLower().Contains(search) ||
                u.FullName.ToLower().Contains(search) ||
                u.Email.ToLower().Contains(search) ||
                (u.Phone != null && u.Phone.Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(u => u.Status == filter.Status.ToUpper());
        }

        if (filter.RoleId.HasValue)
        {
            query = query.Where(u => u.UserRoles.Any(ur => ur.RoleId == filter.RoleId.Value));
        }

        var totalItems = await query.CountAsync(ct);

        var page = filter.Page < 1 ? 1 : filter.Page;
        var pageSize = filter.PageSize < 1 ? 20 : filter.PageSize;

        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserListItemDto(
                u.UserId,
                u.Username,
                u.FullName,
                u.Email,
                u.Phone,
                u.Status,
                u.CreatedAt,
                u.UserRoles.Select(ur => ur.Role.RoleName).ToList()
            ))
            .ToListAsync(ct);

        return new PagedResult<AdminUserListItemDto>(items, totalItems, page, pageSize);
    }

    public async Task<AdminUserDetailDto?> GetUserDetailAsync(long userId, CancellationToken ct = default)
    {
        var user = await dbContext.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserFacilities)
                .ThenInclude(uf => uf.Facility)
            .Include(u => u.UserFacilities)
                .ThenInclude(uf => uf.Assigner)
            .Include(u => u.RentalContracts)
            .Include(u => u.SupportTickets)
            .Include(u => u.LoginHistories)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == userId, ct);

        if (user == null) return null;

        var roles = user.UserRoles
            .Select(ur => new RoleDto(ur.Role.RoleId, ur.Role.RoleName, ur.Role.Description))
            .ToList();

        var facilities = user.UserFacilities
            .OrderByDescending(uf => uf.CreatedAt)
            .Select(uf => new UserFacilityDto(
                uf.UserFacilityId,
                uf.UserId,
                user.Username,
                user.FullName,
                uf.FacilityId,
                uf.Facility.Name,
                uf.AssignedFrom,
                uf.AssignedTo,
                uf.Status,
                uf.AssignedBy,
                uf.Assigner?.FullName,
                uf.CreatedAt
            ))
            .ToList();

        var activeContractsCount = user.RentalContracts.Count(c => c.Status == "ACTIVE");
        var openTicketsCount = user.SupportTickets.Count(t => t.Status == "OPEN" || t.Status == "ASSIGNED" || t.Status == "IN_PROGRESS");
        var lastLoginAt = user.LoginHistories.OrderByDescending(h => h.LoginAt).Select(h => (DateTime?)h.LoginAt).FirstOrDefault();

        return new AdminUserDetailDto(
            user.UserId,
            user.Username,
            user.FullName,
            user.Email,
            user.Phone,
            user.Status,
            user.CreatedAt,
            user.UpdatedAt,
            roles,
            facilities,
            activeContractsCount,
            openTicketsCount,
            lastLoginAt
        );
    }

    public async Task<AdminUserDetailDto> CreateUserAsync(AdminCreateUserRequest request, long currentAdminId, CancellationToken ct = default)
    {
        var usernameExists = await dbContext.Users.AnyAsync(u => u.Username == request.Username, ct);
        if (usernameExists)
        {
            throw new InvalidOperationException($"Tên đăng nhập '{request.Username}' đã tồn tại trong hệ thống.");
        }

        var emailExists = await dbContext.Users.AnyAsync(u => u.Email == request.Email, ct);
        if (emailExists)
        {
            throw new InvalidOperationException($"Email '{request.Email}' đã được sử dụng.");
        }

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Email = request.Email,
            Phone = request.Phone,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "ACTIVE" : request.Status.ToUpper(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(ct);

        if (request.InitialRoleId.HasValue)
        {
            var role = await dbContext.Roles.FindAsync([request.InitialRoleId.Value], ct);
            if (role != null)
            {
                dbContext.UserRoles.Add(new UserRole
                {
                    UserId = user.UserId,
                    RoleId = role.RoleId,
                    AssignedBy = currentAdminId,
                    AssignedAt = DateTime.UtcNow
                });
                await dbContext.SaveChangesAsync(ct);
            }
        }

        await LogActivityAsync(
            currentAdminId,
            "USER_CREATE",
            "users",
            user.UserId,
            null,
            new { user.Username, user.FullName, user.Email, user.Status },
            ct
        );
        await dbContext.SaveChangesAsync(ct);

        return (await GetUserDetailAsync(user.UserId, ct))!;
    }

    public async Task<AdminUserDetailDto> UpdateUserAsync(long userId, AdminUpdateUserRequest request, long currentAdminId, CancellationToken ct = default)
    {
        var user = await dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId, ct);

        if (user == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy người dùng với ID: {userId}");
        }

        var newStatus = request.Status.ToUpper();

        // Check Last Active Admin Protection Rule
        if (user.Status == "ACTIVE" && newStatus != "ACTIVE")
        {
            var isAdmin = user.UserRoles.Any(ur => ur.Role.RoleName == "ADMIN");
            if (isAdmin)
            {
                var otherActiveAdminsCount = await dbContext.Users
                    .Where(u => u.UserId != userId && u.Status == "ACTIVE" && u.UserRoles.Any(ur => ur.Role.RoleName == "ADMIN"))
                    .CountAsync(ct);

                if (otherActiveAdminsCount == 0)
                {
                    throw new InvalidOperationException("Không thể khóa hoặc ngưng hoạt động tài khoản Quản trị viên (ADMIN) đang hoạt động duy nhất của hệ thống.");
                }
            }
        }

        var emailChanged = !string.Equals(user.Email, request.Email, StringComparison.OrdinalIgnoreCase);
        if (emailChanged)
        {
            var emailExists = await dbContext.Users.AnyAsync(u => u.Email == request.Email && u.UserId != userId, ct);
            if (emailExists)
            {
                throw new InvalidOperationException($"Email '{request.Email}' đã được tài khoản khác sử dụng.");
            }
        }

        var oldInfo = new { user.FullName, user.Email, user.Phone, user.Status };

        user.FullName = request.FullName;
        user.Email = request.Email;
        user.Phone = request.Phone;
        user.Status = newStatus;
        user.UpdatedAt = DateTime.UtcNow;

        await LogActivityAsync(
            currentAdminId,
            "USER_UPDATE",
            "users",
            user.UserId,
            oldInfo,
            new { user.FullName, user.Email, user.Phone, user.Status },
            ct
        );

        await dbContext.SaveChangesAsync(ct);

        return (await GetUserDetailAsync(userId, ct))!;
    }

    public async Task ResetUserPasswordAsync(long userId, AdminResetPasswordRequest request, long currentAdminId, CancellationToken ct = default)
    {
        var user = await dbContext.Users.FindAsync([userId], ct);
        if (user == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy người dùng với ID: {userId}");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            throw new ArgumentException("Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await LogActivityAsync(
            currentAdminId,
            "USER_RESET_PASSWORD",
            "users",
            user.UserId,
            null,
            "Mật khẩu đã được đặt lại bởi quản trị viên",
            ct
        );

        await dbContext.SaveChangesAsync(ct);
    }

    // ==========================================
    // UC25: Roles & UserRoles
    // ==========================================

    public async Task<IReadOnlyList<RoleWithPermissionsDto>> GetAllRolesAsync(CancellationToken ct = default)
    {
        var roles = await dbContext.Roles
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .AsNoTracking()
            .ToListAsync(ct);

        return roles.Select(r => new RoleWithPermissionsDto(
            r.RoleId,
            r.RoleName,
            r.Description,
            r.RolePermissions.Select(rp => new PermissionDto(
                rp.Permission.PermissionId,
                rp.Permission.PermissionCode,
                rp.Permission.PermissionName,
                rp.Permission.Description
            )).ToList()
        )).ToList();
    }

    public async Task AssignRoleAsync(long userId, long roleId, long currentAdminId, CancellationToken ct = default)
    {
        var user = await dbContext.Users.FindAsync([userId], ct);
        if (user == null) throw new KeyNotFoundException($"Không tìm thấy user với ID: {userId}");

        var role = await dbContext.Roles.FindAsync([roleId], ct);
        if (role == null) throw new KeyNotFoundException($"Không tìm thấy vai trò với ID: {roleId}");

        var exists = await dbContext.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == roleId, ct);
        if (exists)
        {
            throw new InvalidOperationException($"Người dùng đã có vai trò '{role.RoleName}'.");
        }

        dbContext.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = roleId,
            AssignedBy = currentAdminId,
            AssignedAt = DateTime.UtcNow
        });

        await LogActivityAsync(
            currentAdminId,
            "ROLE_ASSIGN",
            "user_roles",
            userId,
            null,
            new { UserId = userId, RoleId = roleId, role.RoleName },
            ct
        );

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task RevokeRoleAsync(long userId, long roleId, long currentAdminId, CancellationToken ct = default)
    {
        var userRole = await dbContext.UserRoles
            .Include(ur => ur.Role)
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId, ct);

        if (userRole == null)
        {
            throw new KeyNotFoundException("Liên kết vai trò của người dùng không tồn tại.");
        }

        // Last Active Admin Protection
        if (userRole.Role.RoleName == "ADMIN")
        {
            var user = await dbContext.Users.FindAsync([userId], ct);
            if (user?.Status == "ACTIVE")
            {
                var otherActiveAdminsCount = await dbContext.Users
                    .Where(u => u.UserId != userId && u.Status == "ACTIVE" && u.UserRoles.Any(ur => ur.Role.RoleName == "ADMIN"))
                    .CountAsync(ct);

                if (otherActiveAdminsCount == 0)
                {
                    throw new InvalidOperationException("Không thể thu hồi vai trò Quản trị viên (ADMIN) từ tài khoản Admin hoạt động duy nhất của hệ thống.");
                }
            }
        }

        dbContext.UserRoles.Remove(userRole);

        await LogActivityAsync(
            currentAdminId,
            "ROLE_REVOKE",
            "user_roles",
            userId,
            new { UserId = userId, RoleId = roleId, userRole.Role.RoleName },
            null,
            ct
        );

        await dbContext.SaveChangesAsync(ct);
    }

    // ==========================================
    // UC26: Permissions & Facility Scopes
    // ==========================================

    public async Task<IReadOnlyList<PermissionDto>> GetAllPermissionsAsync(CancellationToken ct = default)
    {
        var permissions = await dbContext.Permissions.AsNoTracking().ToListAsync(ct);
        return permissions.Select(p => new PermissionDto(
            p.PermissionId,
            p.PermissionCode,
            p.PermissionName,
            p.Description
        )).ToList();
    }

    public async Task AssignPermissionToRoleAsync(long roleId, long permissionId, long currentAdminId, CancellationToken ct = default)
    {
        var role = await dbContext.Roles.FindAsync([roleId], ct);
        if (role == null) throw new KeyNotFoundException($"Không tìm thấy role: {roleId}");

        var perm = await dbContext.Permissions.FindAsync([permissionId], ct);
        if (perm == null) throw new KeyNotFoundException($"Không tìm thấy permission: {permissionId}");

        var exists = await dbContext.RolePermissions.AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId, ct);
        if (exists)
        {
            throw new InvalidOperationException("Quyền này đã được gán cho vai trò.");
        }

        dbContext.RolePermissions.Add(new RolePermission
        {
            RoleId = roleId,
            PermissionId = permissionId
        });

        await LogActivityAsync(
            currentAdminId,
            "PERMISSION_ASSIGN",
            "role_permissions",
            roleId,
            null,
            new { RoleId = roleId, role.RoleName, PermissionId = permissionId, perm.PermissionCode },
            ct
        );

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task RevokePermissionFromRoleAsync(long roleId, long permissionId, long currentAdminId, CancellationToken ct = default)
    {
        var rolePerm = await dbContext.RolePermissions
            .Include(rp => rp.Role)
            .Include(rp => rp.Permission)
            .FirstOrDefaultAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId, ct);

        if (rolePerm == null)
        {
            throw new KeyNotFoundException("Liên kết quyền của vai trò không tồn tại.");
        }

        dbContext.RolePermissions.Remove(rolePerm);

        await LogActivityAsync(
            currentAdminId,
            "PERMISSION_REVOKE",
            "role_permissions",
            roleId,
            new { RoleId = roleId, rolePerm.Role.RoleName, PermissionId = permissionId, rolePerm.Permission.PermissionCode },
            null,
            ct
        );

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<UserFacilityDto>> GetUserFacilitiesAsync(long userId, CancellationToken ct = default)
    {
        var assignments = await dbContext.UserFacilities
            .Include(uf => uf.User)
            .Include(uf => uf.Facility)
            .Include(uf => uf.Assigner)
            .Where(uf => uf.UserId == userId)
            .OrderByDescending(uf => uf.CreatedAt)
            .AsNoTracking()
            .ToListAsync(ct);

        return assignments.Select(uf => new UserFacilityDto(
            uf.UserFacilityId,
            uf.UserId,
            uf.User.Username,
            uf.User.FullName,
            uf.FacilityId,
            uf.Facility.Name,
            uf.AssignedFrom,
            uf.AssignedTo,
            uf.Status,
            uf.AssignedBy,
            uf.Assigner?.FullName,
            uf.CreatedAt
        )).ToList();
    }

    public async Task<UserFacilityDto> AssignUserFacilityAsync(AssignUserFacilityRequest request, long currentAdminId, CancellationToken ct = default)
    {
        var user = await dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == request.UserId, ct);

        if (user == null) throw new KeyNotFoundException($"Không tìm thấy người dùng với ID: {request.UserId}");

        var isStaffOrManager = user.UserRoles.Any(ur => ur.Role.RoleName == "STAFF" || ur.Role.RoleName == "MANAGER");
        if (!isStaffOrManager)
        {
            throw new InvalidOperationException("Chỉ có thể phân công cơ sở cho tài khoản có vai trò STAFF hoặc MANAGER.");
        }

        var facility = await dbContext.Facilities.FindAsync([request.FacilityId], ct);
        if (facility == null) throw new KeyNotFoundException($"Không tìm thấy cơ sở với ID: {request.FacilityId}");

        if (request.AssignedTo.HasValue && request.AssignedTo.Value < request.AssignedFrom)
        {
            throw new ArgumentException("Ngày kết thúc phân công không thể trước ngày bắt đầu.");
        }

        // Rule A06: Mỗi nhân viên hoặc quản lý có tối đa một phân công cơ sở ACTIVE tại một thời điểm
        var currentActiveAssignments = await dbContext.UserFacilities
            .Where(uf => uf.UserId == request.UserId && uf.Status == "ACTIVE")
            .ToListAsync(ct);

        foreach (var oldAssignment in currentActiveAssignments)
        {
            oldAssignment.Status = "ENDED";
            if (!oldAssignment.AssignedTo.HasValue || oldAssignment.AssignedTo.Value > request.AssignedFrom)
            {
                oldAssignment.AssignedTo = request.AssignedFrom;
            }
        }

        var newAssignment = new UserFacility
        {
            UserId = request.UserId,
            FacilityId = request.FacilityId,
            AssignedBy = currentAdminId,
            AssignedFrom = request.AssignedFrom,
            AssignedTo = request.AssignedTo,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };

        dbContext.UserFacilities.Add(newAssignment);

        await LogActivityAsync(
            currentAdminId,
            "FACILITY_SCOPE_ASSIGN",
            "user_facilities",
            request.UserId,
            null,
            new { request.UserId, request.FacilityId, FacilityName = facility.Name, request.AssignedFrom, request.AssignedTo },
            ct
        );

        await dbContext.SaveChangesAsync(ct);

        var assigner = await dbContext.Users.FindAsync([currentAdminId], ct);

        return new UserFacilityDto(
            newAssignment.UserFacilityId,
            newAssignment.UserId,
            user.Username,
            user.FullName,
            newAssignment.FacilityId,
            facility.Name,
            newAssignment.AssignedFrom,
            newAssignment.AssignedTo,
            newAssignment.Status,
            newAssignment.AssignedBy,
            assigner?.FullName,
            newAssignment.CreatedAt
        );
    }

    public async Task UpdateUserFacilityStatusAsync(long userFacilityId, string status, long currentAdminId, CancellationToken ct = default)
    {
        var assignment = await dbContext.UserFacilities
            .Include(uf => uf.Facility)
            .FirstOrDefaultAsync(uf => uf.UserFacilityId == userFacilityId, ct);

        if (assignment == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy bản ghi phân công cơ sở với ID: {userFacilityId}");
        }

        var newStatus = status.ToUpper();
        if (newStatus != "ACTIVE" && newStatus != "ENDED" && newStatus != "SUSPENDED")
        {
            throw new ArgumentException("Trạng thái phân công không hợp lệ (chỉ chấp nhận ACTIVE, ENDED, SUSPENDED).");
        }

        // If setting to ACTIVE, check A06
        if (newStatus == "ACTIVE" && assignment.Status != "ACTIVE")
        {
            var otherActive = await dbContext.UserFacilities
                .AnyAsync(uf => uf.UserId == assignment.UserId && uf.UserFacilityId != userFacilityId && uf.Status == "ACTIVE", ct);

            if (otherActive)
            {
                throw new InvalidOperationException("Người dùng đang có phân công ACTIVE khác. Hãy kết thúc phân công hiện tại trước khi kích hoạt phân công này.");
            }
        }

        var oldStatus = assignment.Status;
        assignment.Status = newStatus;

        await LogActivityAsync(
            currentAdminId,
            "FACILITY_SCOPE_STATUS_CHANGE",
            "user_facilities",
            assignment.UserFacilityId,
            new { Status = oldStatus },
            new { Status = newStatus },
            ct
        );

        await dbContext.SaveChangesAsync(ct);
    }

    // ==========================================
    // UC27: Logs & Auditing
    // ==========================================

    public async Task<PagedResult<LoginHistoryDto>> GetLoginHistoriesAsync(LogQueryFilter filter, CancellationToken ct = default)
    {
        var query = dbContext.LoginHistories
            .Include(h => h.User)
            .AsNoTracking()
            .AsQueryable();

        if (filter.UserId.HasValue)
        {
            query = query.Where(h => h.UserId == filter.UserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
        {
            query = query.Where(h => h.LoginStatus == filter.Action.ToUpper());
        }

        if (filter.FromDate.HasValue)
        {
            query = query.Where(h => h.LoginAt >= filter.FromDate.Value);
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(h => h.LoginAt <= filter.ToDate.Value);
        }

        var total = await query.CountAsync(ct);
        var page = filter.Page < 1 ? 1 : filter.Page;
        var pageSize = filter.PageSize < 1 ? 20 : filter.PageSize;

        var items = await query
            .OrderByDescending(h => h.LoginAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(h => new LoginHistoryDto(
                h.LoginHistoryId,
                h.UserId,
                h.User.Username,
                h.User.FullName,
                h.LoginAt,
                h.LogoutAt,
                h.IpAddress,
                h.DeviceInfo,
                h.LoginStatus
            ))
            .ToListAsync(ct);

        return new PagedResult<LoginHistoryDto>(items, total, page, pageSize);
    }

    public async Task<PagedResult<ActivityLogDto>> GetActivityLogsAsync(LogQueryFilter filter, CancellationToken ct = default)
    {
        var query = dbContext.ActivityLogs
            .Include(l => l.User)
            .AsNoTracking()
            .AsQueryable();

        if (filter.UserId.HasValue)
        {
            query = query.Where(l => l.UserId == filter.UserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
        {
            query = query.Where(l => l.Action == filter.Action.ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(filter.EntityType))
        {
            query = query.Where(l => l.EntityType == filter.EntityType.ToLower());
        }

        if (filter.FromDate.HasValue)
        {
            query = query.Where(l => l.LoggedAt >= filter.FromDate.Value);
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(l => l.LoggedAt <= filter.ToDate.Value);
        }

        var total = await query.CountAsync(ct);
        var page = filter.Page < 1 ? 1 : filter.Page;
        var pageSize = filter.PageSize < 1 ? 20 : filter.PageSize;

        var items = await query
            .OrderByDescending(l => l.LoggedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new ActivityLogDto(
                l.LogId,
                l.UserId,
                l.User != null ? l.User.Username : "SYSTEM",
                l.Action,
                l.EntityType,
                l.EntityId,
                l.OldValue,
                l.NewValue,
                l.IpAddress,
                l.LoggedAt
            ))
            .ToListAsync(ct);

        return new PagedResult<ActivityLogDto>(items, total, page, pageSize);
    }

    // ==========================================
    // Dashboard Stats
    // ==========================================

    public async Task<AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default)
    {
        var totalUsers = await dbContext.Users.CountAsync(ct);
        var activeUsersCount = await dbContext.Users.CountAsync(u => u.Status == "ACTIVE", ct);
        var inactiveUsersCount = totalUsers - activeUsersCount;

        var rolesGroup = await dbContext.UserRoles
            .Include(ur => ur.Role)
            .GroupBy(ur => ur.Role.RoleName)
            .Select(g => new { RoleName = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var usersByRole = rolesGroup.ToDictionary(r => r.RoleName, r => r.Count);

        var totalFacilities = await dbContext.Facilities.CountAsync(ct);
        var totalUnits = await dbContext.StorageUnits.CountAsync(ct);
        var occupiedUnits = await dbContext.StorageUnits.CountAsync(u => u.Status == "OCCUPIED", ct);
        var availableUnits = await dbContext.StorageUnits.CountAsync(u => u.Status == "AVAILABLE", ct);
        var maintenanceUnits = await dbContext.StorageUnits.CountAsync(u => u.Status == "MAINTENANCE", ct);

        var occupancyRate = totalUnits > 0
            ? Math.Round((decimal)occupiedUnits / totalUnits * 100, 2)
            : 0m;

        var activeContractsCount = await dbContext.RentalContracts.CountAsync(c => c.Status == "ACTIVE", ct);
        var pendingReservationsCount = await dbContext.Reservations.CountAsync(r => r.Status == "PENDING_PAYMENT" || r.Status == "UNIT_ASSIGNED", ct);
        var openTicketsCount = await dbContext.SupportTickets.CountAsync(t => t.Status == "OPEN" || t.Status == "ASSIGNED" || t.Status == "IN_PROGRESS", ct);

        var recentActivities = await dbContext.ActivityLogs
            .Include(l => l.User)
            .OrderByDescending(l => l.LoggedAt)
            .Take(10)
            .Select(l => new ActivityLogDto(
                l.LogId,
                l.UserId,
                l.User != null ? l.User.Username : "SYSTEM",
                l.Action,
                l.EntityType,
                l.EntityId,
                l.OldValue,
                l.NewValue,
                l.IpAddress,
                l.LoggedAt
            ))
            .ToListAsync(ct);

        return new AdminDashboardStatsDto(
            totalUsers,
            usersByRole,
            activeUsersCount,
            inactiveUsersCount,
            totalFacilities,
            totalUnits,
            occupiedUnits,
            availableUnits,
            maintenanceUnits,
            occupancyRate,
            activeContractsCount,
            pendingReservationsCount,
            openTicketsCount,
            recentActivities
        );
    }
}
