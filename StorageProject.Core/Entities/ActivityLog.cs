namespace StorageProject.Core.Entities;

/// <summary>
/// Nhật ký kiểm toán thao tác hệ thống (Audit Trail).
/// Ghi lại mọi hành động quan trọng của người dùng hoặc hệ thống (duyệt gia hạn, hoàn tiền, đổi trạng thái kho...).
/// </summary>
public class ActivityLog
{
    /// <summary>Mã định danh bản ghi nhật ký.</summary>
    public long LogId { get; set; }

    /// <summary>Mã người dùng thực hiện thao tác (null nếu là hành động tự động của Hệ thống theo D44).</summary>
    public long? UserId { get; set; }

    /// <summary>Tên hành động (ví dụ: APPROVE_RENEWAL, SETTLE_RETURN, DEPOSIT_REFUNDED...).</summary>
    public string Action { get; set; } = null!;

    /// <summary>Tên bảng / đối tượng chịu tác động (ví dụ: Contract, Reservation, Unit...).</summary>
    public string EntityType { get; set; } = null!;

    /// <summary>Mã ID của đối tượng chịu tác động.</summary>
    public long? EntityId { get; set; }

    /// <summary>Giá trị trước khi thay đổi (JSON hoặc chuỗi trạng thái cũ).</summary>
    public string? OldValue { get; set; }

    /// <summary>Giá trị mới sau khi thay đổi (JSON hoặc chuỗi trạng thái mới).</summary>
    public string? NewValue { get; set; }

    /// <summary>Địa chỉ IP của client gọi thao tác.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Thời điểm ghi nhận thao tác.</summary>
    public DateTime LoggedAt { get; set; }

    public User? User { get; set; }
}
