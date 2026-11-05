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
    Task VerifyCustomerAsync(OpsActor actor, string id, OpsVerifyRequest request, CancellationToken ct = default);
    Task RecordKeyReceiptAsync(OpsActor actor, string id, CancellationToken ct = default);
    Task RecordKeyReceiptAsync(OpsActor actor, string id, OpsKeyReceiptRequest? request, CancellationToken ct = default);
    Task CompleteHandoverAsync(OpsActor actor, string id, OpsHandoverRequest request, CancellationToken ct = default);
    Task SubmitReturnInspectionAsync(OpsActor actor, string id, OpsReturnInspectionRequest request, CancellationToken ct = default);
    Task RespondTicketAsync(OpsActor actor, string id, OpsTicketResponseRequest request, CancellationToken ct = default);

    // Chỉ quản lý
    Task AllocateAsync(OpsActor actor, string id, OpsAllocateRequest request, CancellationToken ct = default);
    Task AssignAsync(OpsActor actor, string id, OpsAssignRequest request, CancellationToken ct = default);
    Task ApproveRenewalAsync(OpsActor actor, string id, CancellationToken ct = default);
    Task RejectRenewalAsync(OpsActor actor, string id, OpsRejectRequest request, CancellationToken ct = default);
    Task RemindAsync(OpsActor actor, string id, OpsNoteRequest request, CancellationToken ct = default);
    /// <summary>M07 · Chốt quyết toán trả kho: tạo khoản hoàn PENDING ("Chờ hoàn"), chưa ghi đã chuyển tiền (D32 / T07).</summary>
    Task<OpsSettlementResult> ConfirmRefundAsync(OpsActor actor, string id, string? note = null, CancellationToken ct = default);
    /// <summary>M08 · Ghi bằng chứng đã chuyển khoản hoàn cho đơn đã huỷ vào tài khoản chính chủ (D27, D32).</summary>
    Task<decimal> ConfirmReservationRefundAsync(OpsActor actor, string id, OpsReservationRefundRequest request, CancellationToken ct = default);

    // Hoàn cọc sau trả kho (D32 / T07)
    Task<IReadOnlyList<DepositRefundDto>> GetDepositRefundsAsync(OpsActor actor, CancellationToken ct = default);
    Task<DepositRefundDto> ConfirmDepositRefundAsync(OpsActor actor, DepositRefundActionRequest request, CancellationToken ct = default);
    /// <summary>Khách xem khoản hoàn cọc của chính mình (GET /api/deposit-refunds).</summary>
    Task<IReadOnlyList<DepositRefundDto>> GetCustomerDepositRefundsAsync(long customerId, CancellationToken ct = default);

    // T13 · Sự cố do cơ sở (D32)
    Task<IncidentListDto> GetIncidentsAsync(OpsActor actor, CancellationToken ct = default);
    Task<IncidentListDto> GetCustomerIncidentsAsync(long customerId, CancellationToken ct = default);
    Task<IncidentReceiptDto> SaveIncidentAsync(OpsActor actor, IncidentActionRequest request, CancellationToken ct = default);
    Task<IncidentReceiptDto> ChooseIncidentOptionAsync(long customerId, string contractCode, IncidentActionRequest request, CancellationToken ct = default);
    Task<IncidentReceiptDto> CompleteIncidentTransferAsync(OpsActor actor, string id, IncidentActionRequest request, CancellationToken ct = default);
    Task<IncidentReceiptDto> FinalizeIncidentTerminationAsync(OpsActor actor, string id, IncidentActionRequest request, CancellationToken ct = default);

    // T12 · Hồ sơ quá hạn ngày 20 và biên bản xử lý đồ (D32)
    Task<IReadOnlyList<OverdueCaseDto>> GetOverdueCasesAsync(OpsActor actor, CancellationToken ct = default);
    Task<OverdueCaseDto> HandleOverdueCaseActionAsync(OpsActor actor, OverdueCaseActionRequest request, CancellationToken ct = default);

    // D39/D40 · Khách xác nhận khấu trừ trả kho (48 giờ), cơ sở kiểm tra lại phương án khách chọn
    Task<ReturnDeductionDto> GetReturnDeductionAsync(long customerId, string contractCode, CancellationToken ct = default);
    Task<ReturnDeductionDto> DecideReturnDeductionAsync(long customerId, string contractCode, ReturnDeductionDecisionRequest request, CancellationToken ct = default);
    Task RecheckReturnAsync(OpsActor actor, string id, ReturnRecheckRequest request, CancellationToken ct = default);
    /// <summary>Tiến trình nền: quá 48 giờ khách chưa xác nhận → tự chốt hoàn cọc theo biên bản (D40).</summary>
    Task<int> AutoSettleExpiredDeductionsAsync(CancellationToken ct = default);

    // D42/D43 · Hoàn tiền mặt tại quầy
    Task<IReadOnlyList<CashRefundDto>> GetCashRefundsAsync(OpsActor actor, CancellationToken ct = default);
    Task<CashRefundDto> ApproveCashRefundAsync(OpsActor actor, string id, OpsAssignRequest request, CancellationToken ct = default);
    Task<CashRefundDto> RecordCashRefundCallAsync(OpsActor actor, string id, CashRefundCallRequest request, CancellationToken ct = default);
    Task<CashRefundDto> PayCashRefundAsync(OpsActor actor, string id, CashRefundPayRequest request, CancellationToken ct = default);

    // D42 · Báo cáo việc tồn cuối ngày (22:00)
    Task<DailyStaffReportDto> GetDailyReportAsync(OpsActor actor, DateOnly? date = null, CancellationToken ct = default);
    /// <summary>Tiến trình nền: từ 22:00 giờ Việt Nam ghi báo cáo một lần mỗi cơ sở mỗi ngày.</summary>
    Task<int> WriteDailyReportsAsync(CancellationToken ct = default);
}
