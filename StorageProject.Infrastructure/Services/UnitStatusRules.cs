namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Bộ quy tắc chuẩn hóa và chuyển đổi trạng thái ô kho (Unit Status Rules - F12 / UC12).
/// Định nghĩa các bước chuyển trạng thái hợp lệ khi nhân viên/quản lý bảo trì hoặc đổi trạng thái thủ công,
/// đồng thời bảo vệ các trạng thái thuộc về vòng đời hợp đồng (RESERVED, OCCUPIED, RETURN_PENDING).
/// </summary>
public static class UnitStatusRules
{
    /// <summary>
    /// Chuẩn hóa chuỗi trạng thái đầu vào về giá trị chuẩn của cơ sở dữ liệu.
    /// </summary>
    /// <param name="status">Chuỗi trạng thái đầu vào.</param>
    /// <returns>Trạng thái chuẩn hóa (AVAILABLE, OCCUPIED, RESERVED, OUT_OF_SERVICE...).</returns>
    public static string Normalize(string status) => status.Trim().ToUpperInvariant() switch {
        "EMPTY" => "AVAILABLE", "ACTIVE" => "OCCUPIED", "WAITING_HANDOVER" => "RESERVED",
        "LOCKED" => "OUT_OF_SERVICE", var value => value
    };

    /// <summary>
    /// Kiểm tra tính hợp lệ của việc chuyển đổi trạng thái ô kho bằng tay.
    /// </summary>
    /// <param name="current">Trạng thái hiện tại của ô kho.</param>
    /// <param name="next">Trạng thái đích muốn chuyển tới.</param>
    /// <param name="reason">Lý do thay đổi trạng thái (bắt buộc từ 1 đến 255 ký tự).</param>
    /// <exception cref="ArgumentException">Ném ra khi lý do trống hoặc dài quá 255 ký tự.</exception>
    /// <exception cref="InvalidOperationException">Ném ra khi bước chuyển không được phép đổi thủ công.</exception>
    public static void Validate(string current, string next, string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 255)
            throw new ArgumentException("Nhập lý do từ 1 đến 255 ký tự.");
        if (current == next) return;
        var allowed = current switch {
            "AVAILABLE" => next is "MAINTENANCE" or "OUT_OF_SERVICE",
            "MAINTENANCE" => next is "AVAILABLE" or "OUT_OF_SERVICE",
            "OUT_OF_SERVICE" => next is "AVAILABLE" or "MAINTENANCE",
            "INSPECTION" => next is "AVAILABLE" or "MAINTENANCE",
            "UNDER_INSPECTION" => next is "AVAILABLE" or "MAINTENANCE",
            _ => false
        };
        if (!allowed) throw new InvalidOperationException("Không được đổi trạng thái này bằng tay. Hãy dùng luồng phân bổ, bàn giao hoặc trả kho.");
    }
}
