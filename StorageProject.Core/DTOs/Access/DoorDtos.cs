namespace StorageProject.Core.DTOs.Access;

/// <summary>Trạng thái cửa mô phỏng của một ô (D51: không tự khoá — cửa mở tới khi bấm "Đóng cửa").</summary>
/// <param name="Door">OPEN | LOCKED</param>
/// <param name="UpdatedAt">Thời điểm sự kiện gần nhất (giờ Việt Nam, yyyy-MM-ddTHH:mm:ss), null nếu chưa từng mở.</param>
/// <param name="Changed">false khi thao tác không đổi trạng thái (ví dụ đóng cửa đang đóng) — không ghi nhật ký trùng.</param>
public record DoorStateDto(string UnitNumber, string Door, string? UpdatedAt, bool Changed = false, string? FacilityName = null);

public record DoorUnitRequest(string? UnitNumber, long? FacilityId = null);

/// <summary>#50: gửi hỗ trợ từ máy quét; cơ sở và ô tự xác định từ ô đang thao tác.</summary>
public record DoorSupportRequest(string? UnitNumber, string? Reason = null, long? FacilityId = null);

/// <param name="Duplicate">true khi đã có yêu cầu đang mở cho ô này trong 30 phút gần nhất (không tạo trùng).</param>
public record DoorSupportResultDto(string TicketCode, string UnitNumber, string FacilityName, string Status, string CreatedAt, bool Duplicate);

/// <summary>#49: một dòng nhật ký cửa — không chứa nguyên QR/PIN.</summary>
/// <param name="Result">OPEN | DENIED | CLOSED</param>
/// <param name="Method">QR | PIN | CLOSE_DEVICE | CLOSE_APP | null</param>
public record DoorLogRowDto(long LogId, string At, string? FacilityName, string? UnitNumber, string? CustomerName, string? ContractCode,
    string Result, string? Method, string? Reason);

public record DoorLogFilter(long? FacilityId, string? UnitNumber, string? Result, DateOnly? From, DateOnly? To, int Page = 1, int PageSize = 20);
