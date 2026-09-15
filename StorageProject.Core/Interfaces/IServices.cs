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
