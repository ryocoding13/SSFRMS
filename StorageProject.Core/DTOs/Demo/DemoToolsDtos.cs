namespace StorageProject.Core.DTOs.Demo;

/// <summary>#45 #54 · Công cụ demo: một hợp đồng kèm các giao dịch đã phát sinh.</summary>
public record DemoPaymentDto(long PaymentId, string PaymentType, decimal Amount, string Status, string? PaidAt, string? DueDate);

public record DemoContractDto(long ContractId, string ContractCode, string CustomerName, string FacilityName, string UnitNumber,
    DateOnly StartDate, DateOnly EndDate, decimal AgreedMonthlyRate, decimal DepositAmount, string Status, int OverdueDays,
    IReadOnlyList<DemoPaymentDto> Payments);

/// <summary>Chỉnh ngày bắt đầu / hết hạn và giá thuê tháng của hợp đồng (để demo chưa tới ngày, đang thuê, sắp hết hạn, quá hạn).</summary>
public record DemoContractEditRequest(DateOnly StartDate, DateOnly EndDate, decimal? AgreedMonthlyRate, string? Reason);

/// <summary>Chỉnh ngày thanh toán và số tiền của giao dịch đã phát sinh.</summary>
public record DemoPaymentEditRequest(DateTime? PaidAt, decimal? Amount, string? Reason);

/// <summary>Kết quả sau khi chỉnh: giá trị trước/sau để hiện popup xác nhận và ghi nhật ký.</summary>
public record DemoEditResultDto(string Target, IReadOnlyList<DemoChangeDto> Changes, DemoContractDto Contract);

public record DemoChangeDto(string Field, string? Before, string? After);
