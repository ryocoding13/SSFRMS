using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.DTOs.Renewal;

namespace StorageProject.Core.DTOs.Contract;

public record ContractOverdueDto(
    long? PolicyId,
    string PolicyScope,
    decimal RatePerDay,
    string CalculationType,
    DateOnly AsOfDate,
    int OverdueDays,
    decimal OverdueFee,
    decimal RemainingDeposit,
    int DepletionDay,
    int DisposalDay,
    bool IsSettled
);

public record ContractSummaryDto(
    long ContractId,
    long ReservationId,
    long UnitId,
    string UnitNumber,
    string FacilityName,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal AgreedMonthlyRate,
    decimal DepositAmount,
    string Status,
    DateTime? ActivatedAt,
    ContractOverdueDto? Overdue = null
);

public record ContractDetailDto(
    long ContractId,
    long ReservationId,
    long UnitId,
    string UnitNumber,
    string FacilityName,
    string UnitTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal AgreedMonthlyRate,
    decimal DepositAmount,
    string Status,
    string? TerminationReason,
    DateTime CreatedAt,
    DateTime? ActivatedAt,
    DateTime? CompletedAt,
    HandoverSummaryDto? Handover,
    IReadOnlyList<PaymentDto> Payments,
    IReadOnlyList<RenewalDto> Renewals,
    DateTime? AccessUpdatedAt = null,
    int? PolicyVersion = null,
    DateTime? PolicyAcceptedAt = null,
    // D41: ô đã có khách mới đặt từ ngày này → nút gia hạn mờ "Ô đã có khách đặt từ dd/mm"
    DateOnly? NextBookingFrom = null,
    PolicyConsentDto? PolicyConsent = null,
    ContractOverdueDto? Overdue = null
);

public record HandoverSummaryDto(
    long HandoverId,
    string Status,
    DateTime? ScheduledAt,
    DateTime? HandoverAt,
    bool CustomerConfirmed,
    bool StaffConfirmed
);

/// <summary>
/// Gửi trả kho (D32 / T08 / Task #8 & #9). Bắt buộc: xác nhận đã chuyển hết đồ, ngày mong muốn trả kho,
/// phương thức nhận tiền hoàn (chuyển khoản hoặc tiền mặt). Ảnh kho trống và khung giờ không bắt buộc với khách.
/// </summary>
public record MoveOutRequest(
    DateOnly Date,
    string? Slot = null,
    string? Note = null,
    string? BankName = null,
    string? AccountNumber = null,
    string? AccountHolder = null,
    bool? Emptied = null,
    IReadOnlyList<StorageProject.Core.DTOs.Evidence.EvidencePhotoUpload>? Photos = null,
    string? RefundMethod = null // D42: BANK_TRANSFER (mặc định) hoặc CASH (tiền mặt tại quầy)
);

public record MoveOutResponseDto(
    long InspectionId,
    long ContractId,
    string Status,
    DateTime? ScheduledAt,
    string Message
);

