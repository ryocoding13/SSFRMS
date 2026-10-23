using StorageProject.Core.DTOs.FacilityOps;

namespace StorageProject.Core.Interfaces;

/// <summary>
/// Khu Nhân viên cơ sở (UC07–UC12) và Quản lý cơ sở (UC13–UC18), chỉ trong cơ sở được phân công (SRS A06).
/// Lỗi: KeyNotFoundException → 404 · InvalidOperationException/ArgumentException → 400 ·
/// UnauthorizedAccessException → 403 (chưa được phân công cơ sở / không đủ quyền).
/// Id trong đường dẫn là mã hiển thị ("SS-20261014-0012", "BG-0007", "HĐ-2026-0003"…).
/// </summary>
public interface IFacilityOpsService
{
    Task<OpsBoardDto> GetBoardAsync(OpsActor actor, CancellationToken ct = default);

    // Nhân viên (và quản lý)
    Task ConfirmPaymentAsync(OpsActor actor, string id, CancellationToken ct = default);
    Task ReportMismatchAsync(OpsActor actor, string id, OpsNoteRequest request, CancellationToken ct = default);
    Task VerifyCustomerAsync(OpsActor actor, string id, OpsVerifyRequest request, CancellationToken ct = default);
    Task RecordKeyReceiptAsync(OpsActor actor, string id, CancellationToken ct = default);
    Task CompleteHandoverAsync(OpsActor actor, string id, OpsHandoverRequest request, CancellationToken ct = default);
    Task SubmitReturnInspectionAsync(OpsActor actor, string id, OpsReturnInspectionRequest request, CancellationToken ct = default);
    Task RespondTicketAsync(OpsActor actor, string id, OpsTicketResponseRequest request, CancellationToken ct = default);

    // Chỉ quản lý
    Task AllocateAsync(OpsActor actor, string id, OpsAllocateRequest request, CancellationToken ct = default);
    Task AssignAsync(OpsActor actor, string id, OpsAssignRequest request, CancellationToken ct = default);
    Task ApproveRenewalAsync(OpsActor actor, string id, CancellationToken ct = default);
    Task RejectRenewalAsync(OpsActor actor, string id, OpsRejectRequest request, CancellationToken ct = default);
    Task RemindAsync(OpsActor actor, string id, OpsNoteRequest request, CancellationToken ct = default);
    Task<decimal> ConfirmRefundAsync(OpsActor actor, string id, CancellationToken ct = default);
    /// <summary>M07 · Xác nhận đã chuyển khoản hoàn tiền cho đơn đã huỷ (D27).</summary>
    Task<decimal> ConfirmReservationRefundAsync(OpsActor actor, string id, CancellationToken ct = default);
}
