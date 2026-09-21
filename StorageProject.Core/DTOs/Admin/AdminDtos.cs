using StorageProject.Core.DTOs.Common;

namespace StorageProject.Core.DTOs.Admin;

// --- User Management DTOs ---

public record AdminUserListItemDto(
    long UserId,
    string Username,
    string FullName,
    string Email,
    string? Phone,
    string Status,
    DateTime CreatedAt,
    IReadOnlyList<string> Roles
);

public record AdminUserDetailDto(
    long UserId,
    string Username,
    string FullName,
    string Email,
    string? Phone,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<RoleDto> Roles,
    IReadOnlyList<UserFacilityDto> FacilityAssignments,
    int ActiveContractsCount,
    int OpenTicketsCount,
    DateTime? LastLoginAt
);

public record AdminCreateUserRequest(
    string Username,
    string Password,
    string FullName,
    string Email,
    string? Phone,
    long? InitialRoleId,
    string? Status = "ACTIVE"
);

public record AdminUpdateUserRequest(
    string FullName,
    string Email,
    string? Phone,
    string Status
);

public record AdminResetPasswordRequest(
    string NewPassword
);

public record UserQueryFilter(
    int Page = 1,
    int PageSize = 20,
    string? SearchTerm = null,
    string? Status = null,
    long? RoleId = null
);

// --- Role & Permission DTOs ---

public record RoleDto(
    long RoleId,
    string RoleName,
    string? Description
);

public record PermissionDto(
    long PermissionId,
    string PermissionCode,
    string PermissionName,
    string? Description
);

public record RoleWithPermissionsDto(
    long RoleId,
    string RoleName,
    string? Description,
    IReadOnlyList<PermissionDto> Permissions
);

public record AssignRoleRequest(
    long RoleId
);

public record AssignPermissionRequest(
    long PermissionId
);

// --- Facility Scope DTOs ---

public record UserFacilityDto(
    long UserFacilityId,
    long UserId,
    string Username,
    string UserFullName,
    long FacilityId,
    string FacilityName,
    DateOnly AssignedFrom,
    DateOnly? AssignedTo,
    string Status,
    long? AssignedBy,
    string? AssignerName,
    DateTime CreatedAt
);

public record AssignUserFacilityRequest(
    long UserId,
    long FacilityId,
    DateOnly AssignedFrom,
    DateOnly? AssignedTo = null
);

public record UpdateUserFacilityStatusRequest(
    string Status // ACTIVE, ENDED, SUSPENDED
);

// --- Audit & Log DTOs ---

public record LoginHistoryDto(
    long LoginHistoryId,
    long UserId,
    string Username,
    string FullName,
    DateTime LoginAt,
    DateTime? LogoutAt,
    string? IpAddress,
    string? DeviceInfo,
    string LoginStatus
);

public record ActivityLogDto(
    long LogId,
    long? UserId,
    string? Username,
    string Action,
    string EntityType,
    long? EntityId,
    string? OldValue,
    string? NewValue,
    string? IpAddress,
    DateTime LoggedAt
);

public record LogQueryFilter(
    int Page = 1,
    int PageSize = 20,
    long? UserId = null,
    string? Action = null,
    string? EntityType = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null
);

// --- Dashboard & System Statistics DTOs ---

public record AdminDashboardStatsDto(
    int TotalUsers,
    Dictionary<string, int> UsersByRole,
    int ActiveUsersCount,
    int InactiveUsersCount,
    int TotalFacilities,
    int TotalUnits,
    int OccupiedUnits,
    int AvailableUnits,
    int MaintenanceUnits,
    decimal OccupancyRate,
    int ActiveContractsCount,
    int PendingReservationsCount,
    int OpenTicketsCount,
    IReadOnlyList<ActivityLogDto> RecentActivities
);
