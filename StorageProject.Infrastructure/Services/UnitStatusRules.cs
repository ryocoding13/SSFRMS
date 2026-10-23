namespace StorageProject.Infrastructure.Services;

public static class UnitStatusRules
{
    // Lifecycle transitions RESERVED/OCCUPIED/INSPECTION are owned by allocation, UnitStartActivation (RESERVED → OCCUPIED
    // khi đến StartDate) and return services.
    public static string Normalize(string status) => status.Trim().ToUpperInvariant() switch {
        "EMPTY" => "AVAILABLE", "ACTIVE" => "OCCUPIED", "WAITING_HANDOVER" => "RESERVED",
        "LOCKED" => "OUT_OF_SERVICE", var value => value
    };

    public static void Validate(string current, string next, string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 255)
            throw new ArgumentException("Nhập lý do từ 1 đến 255 ký tự.");
        if (current == next) return;
        var allowed = current switch {
            "AVAILABLE" => next is "MAINTENANCE" or "OUT_OF_SERVICE",
            "MAINTENANCE" => next is "AVAILABLE" or "OUT_OF_SERVICE",
            "OUT_OF_SERVICE" => next is "AVAILABLE" or "MAINTENANCE",
            _ => false
        };
        if (!allowed) throw new InvalidOperationException("Không được đổi trạng thái này bằng tay. Hãy dùng luồng phân bổ, bàn giao hoặc trả kho.");
    }
}
