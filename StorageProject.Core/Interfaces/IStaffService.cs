using StorageProject.Core.DTOs.Ops;

namespace StorageProject.Core.Interfaces;

public interface IStaffService
{
    Task<OpsBoardDto> GetStaffBoardAsync(long userId, CancellationToken ct = default);
    Task ConfirmPaymentAsync(long userId, string id, CancellationToken ct = default);
    Task MismatchPaymentAsync(long userId, string id, MismatchPaymentRequest request, CancellationToken ct = default);
    Task VerifyCustomerAsync(long userId, string id, VerifyCustomerRequest request, CancellationToken ct = default);
    Task CompleteHandoverAsync(long userId, string id, CompleteHandoverRequest request, CancellationToken ct = default);
    Task SubmitReturnInspectionAsync(long userId, string id, ReturnInspectionRequest request, CancellationToken ct = default);
    Task AddTicketResponseAsync(long userId, string id, TicketResponseRequest request, CancellationToken ct = default);
    Task UpdateUnitStatusAsync(long userId, string id, UpdateUnitStatusRequest request, CancellationToken ct = default);
    Task ReissueCredentialAsync(long userId, ReissueCredentialRequest request, CancellationToken ct = default);
}
