namespace StorageProject.Core.Entities;

/// <summary>
/// Ảnh bằng chứng lưu riêng tư trong database (không để trong thư mục web công khai).
/// Chỉ đọc qua URL có chữ ký do server cấp (EvidencePhotos.Url).
/// </summary>
public class EvidencePhoto
{
    public long PhotoId { get; set; }
    // MOVE_OUT (khách gửi trả kho, ownerId = InspectionId), RETURN_INSPECTION (nhân viên kiểm kê, ownerId = InspectionId),
    // INCIDENT (quản lý ghi nhận sự cố cơ sở, ownerId = IncidentId)
    public string OwnerType { get; set; } = null!;
    public long OwnerId { get; set; }
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!; // image/jpeg, image/png
    public int SizeBytes { get; set; }
    public byte[] Data { get; set; } = [];
    public long UploadedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    public User UploadedByUser { get; set; } = null!;
}
