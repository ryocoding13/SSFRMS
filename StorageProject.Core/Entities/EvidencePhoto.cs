namespace StorageProject.Core.Entities;

/// <summary>
/// Ảnh bằng chứng lưu riêng tư trong database (không để trong thư mục web công khai).
/// Chỉ đọc qua URL có chữ ký HMAC do server cấp (EvidencePhotos.Url).
/// </summary>
public class EvidencePhoto
{
    /// <summary>Mã định danh ảnh bằng chứng.</summary>
    public long PhotoId { get; set; }

    /// <summary>
    /// Loại đối tượng sở hữu ảnh:
    /// MOVE_OUT (khách gửi trả kho, ownerId = InspectionId),
    /// RETURN_INSPECTION (nhân viên kiểm kê, ownerId = InspectionId),
    /// INCIDENT (quản lý ghi nhận sự cố cơ sở, ownerId = IncidentId),
    /// OVERDUE_BEFORE / OVERDUE_AFTER (biên bản xử lý đồ quá hạn, ownerId = OverdueCaseId),
    /// SUPPORT_TICKET (ownerId = TicketId).
    /// </summary>
    public string OwnerType { get; set; } = null!;

    /// <summary>Mã ID của đối tượng sở hữu ảnh tương ứng.</summary>
    public long OwnerId { get; set; }

    /// <summary>Tên file ảnh gốc được tải lên.</summary>
    public string FileName { get; set; } = null!;

    /// <summary>Định dạng MIME type của ảnh (image/jpeg, image/png).</summary>
    public string ContentType { get; set; } = null!; // image/jpeg, image/png

    /// <summary>Kích thước dung lượng ảnh tính bằng byte.</summary>
    public int SizeBytes { get; set; }

    /// <summary>Mảng byte nhị phân chứa nội dung file ảnh.</summary>
    public byte[] Data { get; set; } = [];

    /// <summary>Mã tài khoản người dùng thực hiện tải ảnh lên.</summary>
    public long UploadedBy { get; set; }

    /// <summary>Thời điểm tải ảnh lên hệ thống.</summary>
    public DateTime CreatedAt { get; set; }

    public User UploadedByUser { get; set; } = null!;
}
