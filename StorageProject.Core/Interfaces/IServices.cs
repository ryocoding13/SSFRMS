using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Facility;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.DTOs.Support;

namespace StorageProject.Core.Interfaces;

public interface IAuthService
{
    Task<AuthUserDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<LoginResponse> LoginAsync(LoginRequest request, string? ipAddress, string? deviceInfo, CancellationToken ct = default);
    Task LogoutAsync(long loginHistoryId, CancellationToken ct = default);
}

public interface IFacilityService
{
    Task<IReadOnlyList<FacilityDto>> GetActiveFacilitiesAsync(CancellationToken ct = default);
    Task<FacilityDto?> GetFacilityByIdAsync(long facilityId, CancellationToken ct = default);
    Task<IReadOnlyList<UnitTypeDto>> GetActiveUnitTypesAsync(CancellationToken ct = default);
    Task<UnitTypeDto?> GetUnitTypeByIdAsync(long unitTypeId, CancellationToken ct = default);
    Task<IReadOnlyList<RentalRateDto>> GetActiveRatesAsync(long? facilityId, long? unitTypeId, CancellationToken ct = default);
    Task<AvailabilityResultDto?> CheckAvailabilityAsync(AvailabilityQueryRequest request, CancellationToken ct = default);
}

public interface IReservationService
{
    Task<IReadOnlyList<ReservationDto>> GetMyReservationsAsync(long customerId, CancellationToken ct = default);
    Task<ReservationDetailDto?> GetReservationDetailAsync(long customerId, long reservationId, CancellationToken ct = default);
    Task<ReservationDto> CreateReservationAsync(long customerId, CreateReservationRequest request, CancellationToken ct = default);
    Task CancelReservationAsync(long customerId, long reservationId, string reason, CancellationToken ct = default);
}

public interface IContractService
{
    Task<IReadOnlyList<ContractSummaryDto>> GetMyContractsAsync(long customerId, CancellationToken ct = default);
    Task<ContractDetailDto?> GetContractDetailAsync(long customerId, long contractId, CancellationToken ct = default);
}

public interface IPaymentService
{
    Task<IReadOnlyList<PaymentDto>> GetContractPaymentsAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<PaymentDto?> GetPaymentByIdAsync(long customerId, long paymentId, CancellationToken ct = default);
}

public interface IRenewalService
{
    Task<IReadOnlyList<RenewalDto>> GetContractRenewalsAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<RenewalDto> RequestRenewalAsync(long customerId, long contractId, CreateRenewalRequest request, CancellationToken ct = default);
}

public interface ISupportTicketService
{
    Task<IReadOnlyList<SupportTicketDto>> GetMyTicketsAsync(long customerId, CancellationToken ct = default);
    Task<SupportTicketDetailDto?> GetTicketDetailAsync(long customerId, long ticketId, CancellationToken ct = default);
    Task<SupportTicketDto> CreateTicketAsync(long customerId, CreateTicketRequest request, CancellationToken ct = default);
    Task CancelTicketAsync(long customerId, long ticketId, CancellationToken ct = default);
}

public interface IHandoverService
{
    Task ConfirmCustomerHandoverAsync(long customerId, long handoverId, CancellationToken ct = default);
}

public interface IAdminService
{
    // UC24: User Management
    Task<StorageProject.Core.DTOs.Common.PagedResult<StorageProject.Core.DTOs.Admin.AdminUserListItemDto>> GetUsersAsync(StorageProject.Core.DTOs.Admin.UserQueryFilter filter, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Admin.AdminUserDetailDto?> GetUserDetailAsync(long userId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Admin.AdminUserDetailDto> CreateUserAsync(StorageProject.Core.DTOs.Admin.AdminCreateUserRequest request, long currentAdminId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Admin.AdminUserDetailDto> UpdateUserAsync(long userId, StorageProject.Core.DTOs.Admin.AdminUpdateUserRequest request, long currentAdminId, CancellationToken ct = default);
    Task ResetUserPasswordAsync(long userId, StorageProject.Core.DTOs.Admin.AdminResetPasswordRequest request, long currentAdminId, CancellationToken ct = default);

    // UC25: Roles & UserRoles
    Task<IReadOnlyList<StorageProject.Core.DTOs.Admin.RoleWithPermissionsDto>> GetAllRolesAsync(CancellationToken ct = default);
    Task AssignRoleAsync(long userId, long roleId, long currentAdminId, CancellationToken ct = default);
    Task RevokeRoleAsync(long userId, long roleId, long currentAdminId, CancellationToken ct = default);

    // UC26: Permissions & Facility Scopes
    Task<IReadOnlyList<StorageProject.Core.DTOs.Admin.PermissionDto>> GetAllPermissionsAsync(CancellationToken ct = default);
    Task AssignPermissionToRoleAsync(long roleId, long permissionId, long currentAdminId, CancellationToken ct = default);
    Task RevokePermissionFromRoleAsync(long roleId, long permissionId, long currentAdminId, CancellationToken ct = default);
    Task<IReadOnlyList<StorageProject.Core.DTOs.Admin.UserFacilityDto>> GetUserFacilitiesAsync(long userId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Admin.UserFacilityDto> AssignUserFacilityAsync(StorageProject.Core.DTOs.Admin.AssignUserFacilityRequest request, long currentAdminId, CancellationToken ct = default);
    Task UpdateUserFacilityStatusAsync(long userFacilityId, string status, long currentAdminId, CancellationToken ct = default);

    // UC27: Logs & Auditing
    Task<StorageProject.Core.DTOs.Common.PagedResult<StorageProject.Core.DTOs.Admin.LoginHistoryDto>> GetLoginHistoriesAsync(StorageProject.Core.DTOs.Admin.LogQueryFilter filter, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Common.PagedResult<StorageProject.Core.DTOs.Admin.ActivityLogDto>> GetActivityLogsAsync(StorageProject.Core.DTOs.Admin.LogQueryFilter filter, CancellationToken ct = default);

    // Dashboard Stats
    Task<StorageProject.Core.DTOs.Admin.AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default);
}

