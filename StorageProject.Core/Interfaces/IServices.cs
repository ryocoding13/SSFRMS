using StorageProject.Core.DTOs.Access;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Facility;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.DTOs.Support;

namespace StorageProject.Core.Interfaces;

/// <summary>
/// Dịch vụ xác thực và quản lý tài khoản người dùng (Đăng ký, Đăng nhập, Hồ sơ, Đổi mật khẩu).
/// </summary>
public interface IAuthService
{
    Task<AuthUserDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<LoginResponse> LoginAsync(LoginRequest request, string? ipAddress, string? deviceInfo, CancellationToken ct = default);
    Task LogoutAsync(long loginHistoryId, CancellationToken ct = default);
    Task<UserProfileDto> GetUserProfileAsync(long userId, CancellationToken ct = default);
    Task<UserProfileDto> UpdateUserProfileAsync(long userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task ChangePasswordAsync(long userId, ChangePasswordRequest request, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ tra cứu cơ sở kho, loại kho, bảng giá và kiểm tra phòng trống cho khách hàng (F01 / UC01).
/// </summary>
public interface IFacilityService
{
    Task<IReadOnlyList<FacilityDto>> GetActiveFacilitiesAsync(CancellationToken ct = default);
    Task<FacilityDto?> GetFacilityByIdAsync(long facilityId, CancellationToken ct = default);
    Task<IReadOnlyList<UnitTypeDto>> GetActiveUnitTypesAsync(CancellationToken ct = default);
    Task<UnitTypeDto?> GetUnitTypeByIdAsync(long unitTypeId, CancellationToken ct = default);
    Task<IReadOnlyList<RentalRateDto>> GetActiveRatesAsync(long? facilityId, long? unitTypeId, CancellationToken ct = default);
    Task<AvailabilityResultDto?> CheckAvailabilityAsync(AvailabilityQueryRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<FacilityUnitDto>> GetUnitsByFacilityIdAsync(long facilityId, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ quản lý đơn đặt chỗ của khách hàng (Tạo đơn, Hủy đơn, Xác nhận chuyển khoản theo F02, F03, D02).
/// </summary>
public interface IReservationService
{
    Task<IReadOnlyList<ReservationDto>> GetMyReservationsAsync(long customerId, CancellationToken ct = default);
    Task<ReservationDetailDto?> GetReservationDetailAsync(long customerId, long reservationId, CancellationToken ct = default);
    Task<ReservationDto> CreateReservationAsync(long customerId, CreateReservationRequest request, CancellationToken ct = default);
    Task<CancelPreviewDto> GetCancelPreviewAsync(long customerId, long reservationId, CancellationToken ct = default);
    Task CancelReservationAsync(long customerId, long reservationId, string reason, CancellationToken ct = default);
    /// <summary>Huỷ đơn kèm tài khoản chính chủ nhận hoàn (bắt buộc khi đơn đã thanh toán — D32 / T08).</summary>
    Task CancelReservationAsync(long customerId, long reservationId, string reason, StorageProject.Core.DTOs.Evidence.RefundBankInput? bank, CancellationToken ct = default);
    Task<ReservationDto> ConfirmTransferAsync(long customerId, long reservationId, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ quản lý hợp đồng thuê của khách hàng và đăng ký trả kho (F05, F06).
/// </summary>
public interface IContractService
{
    Task<IReadOnlyList<ContractSummaryDto>> GetMyContractsAsync(long customerId, CancellationToken ct = default);
    Task<ContractDetailDto?> GetContractDetailAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<MoveOutResponseDto> RegisterMoveOutAsync(long customerId, long contractId, MoveOutRequest request, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ cấp mã QR/PIN mở cửa kho và xác thực quét mã tại cửa kho (F11 / T16).
/// </summary>
public interface IAccessService
{
    Task<AccessQrDto> GetQrAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<ScanResultDto> ScanAsync(string? code, string? ipAddress, CancellationToken ct = default, string? unitNumber = null);
}

/// <summary>
/// Dịch vụ tra cứu lịch sử và chi tiết các khoản thanh toán của hợp đồng (F07 / UC07).
/// </summary>
public interface IPaymentService
{
    Task<IReadOnlyList<PaymentDto>> GetContractPaymentsAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<PaymentDto?> GetPaymentByIdAsync(long customerId, long paymentId, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ gia hạn hợp đồng thuê kho (F06 / B06 / D32).
/// </summary>
public interface IRenewalService
{
    Task<IReadOnlyList<RenewalDto>> GetContractRenewalsAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<RenewalDto> RequestRenewalAsync(long customerId, long contractId, CreateRenewalRequest request, CancellationToken ct = default);
    Task<RenewalDto> SelectCounterPaymentAsync(long customerId, long renewalId, CancellationToken ct = default);
    Task<IReadOnlyList<StorageProject.Core.DTOs.Renewal.CounterRenewalDto>> GetCounterRenewalsAsync(long userId, CancellationToken ct = default);
    Task CollectCounterRenewalAsync(long userId, string id, CancellationToken ct = default);
    Task<RenewalDto> ApproveRenewalAsync(long userId, long renewalId, CancellationToken ct = default);
    Task RejectRenewalAsync(long userId, long renewalId, string reason, CancellationToken ct = default);
    /// <summary>L5 (D40): khách huỷ yêu cầu gia hạn còn chờ duyệt để chuyển sang trả kho.</summary>
    Task CancelRenewalAsync(long customerId, long renewalId, CancellationToken ct = default);
    Task ExpirePendingRenewalsAsync(CancellationToken ct = default);
    // D46 · Gia hạn sang ô khác / về loại cũ sau nâng cấp miễn phí
    Task<StorageProject.Core.DTOs.Renewal.RenewalUnitOptionsDto> GetRenewalUnitOptionsAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Renewal.UnitMoveDto?> GetUnitMoveAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Renewal.UnitMoveDto> MarkUnitMovedAsync(long customerId, long contractId, CancellationToken ct = default);
    Task<IReadOnlyList<StorageProject.Core.DTOs.Renewal.UnitMoveDto>> GetOldUnitInspectionsAsync(long userId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Renewal.UnitMoveDto> InspectOldUnitAsync(long userId, long renewalId, StorageProject.Core.DTOs.Renewal.UnitMoveInspectionRequest request, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ quản lý các phiên bản điều khoản hợp đồng cho thuê và ghi nhận chấp thuận (D32 / T20).
/// </summary>
public interface IRentalPolicyService
{
    Task<StorageProject.Core.DTOs.Policy.RentalPolicyDto> GetCurrentPolicyAsync(CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Policy.RentalPolicyDto?> GetPolicyVersionAsync(int version, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Policy.RentalPolicyDto> SaveRentalPolicyAsync(long userId, StorageProject.Core.DTOs.Policy.SaveRentalPolicyRequest request, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Policy.PolicyConsentDto> RecordReservationConsentAsync(long customerId, long reservationId, StorageProject.Core.DTOs.Policy.PolicyConsentRequest request, string channel = "WEB_CUSTOMER", CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Policy.PolicyConsentDto> RecordRenewalConsentAsync(long customerId, long renewalId, StorageProject.Core.DTOs.Policy.PolicyConsentRequest request, string channel = "WEB_CUSTOMER", CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ quản lý yêu cầu hỗ trợ kỹ thuật và sự cố của khách hàng (F08 / UC11 / C12).
/// </summary>
public interface ISupportTicketService
{
    Task<IReadOnlyList<SupportTicketDto>> GetMyTicketsAsync(long customerId, CancellationToken ct = default);
    Task<SupportTicketDetailDto?> GetTicketDetailAsync(long customerId, long ticketId, CancellationToken ct = default);
    Task<SupportTicketDto> CreateTicketAsync(long customerId, CreateTicketRequest request, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ xác nhận nhận bàn giao kho phía khách hàng (F04 / UC04).
/// </summary>
public interface IHandoverService
{
    Task ConfirmCustomerHandoverAsync(long customerId, long handoverId, CancellationToken ct = default);
}

/// <summary>
/// Dịch vụ quản trị hệ thống (Người dùng, Phân vai trò, Phân cơ sở, Nhật ký Audit theo UC24–UC27).
/// </summary>
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
    Task ChangeRoleAsync(long userId, StorageProject.Core.DTOs.Admin.ChangeRoleRequest request, long currentAdminId, CancellationToken ct = default);

    // UC26: Permissions & Facility Scopes
    Task<IReadOnlyList<StorageProject.Core.DTOs.Admin.PermissionDto>> GetAllPermissionsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<StorageProject.Core.DTOs.Admin.UserFacilityDto>> GetUserFacilitiesAsync(long userId, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Admin.UserFacilityDto> AssignUserFacilityAsync(StorageProject.Core.DTOs.Admin.AssignUserFacilityRequest request, long currentAdminId, CancellationToken ct = default);
    Task UpdateUserFacilityStatusAsync(long userFacilityId, string status, long currentAdminId, CancellationToken ct = default);

    // UC27: Logs & Auditing
    Task<StorageProject.Core.DTOs.Common.PagedResult<StorageProject.Core.DTOs.Admin.LoginHistoryDto>> GetLoginHistoriesAsync(StorageProject.Core.DTOs.Admin.LogQueryFilter filter, CancellationToken ct = default);
    Task<StorageProject.Core.DTOs.Common.PagedResult<StorageProject.Core.DTOs.Admin.ActivityLogDto>> GetActivityLogsAsync(StorageProject.Core.DTOs.Admin.LogQueryFilter filter, CancellationToken ct = default);

    // Dashboard Stats
    Task<StorageProject.Core.DTOs.Admin.AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default);
}
