namespace StorageProject.Core.DTOs.Evidence;

// Ảnh bằng chứng (trả kho, kiểm kê) và tài khoản nhận hoàn chính chủ (D32).
// Ảnh gửi dạng JSON base64 theo hợp đồng FE (BACKEND-TODO "Figma–FE đợt03", Batch08):
// tối đa 5 ảnh JPG/PNG, mỗi ảnh ≤ 5 MiB sau giải mã; server tự kiểm chữ ký tệp, không tin MIME/đuôi tệp.

/// <summary>Một ảnh khách / nhân viên tải lên.</summary>
public record EvidencePhotoUpload(string? FileName, string? ContentType, string? DataBase64);

/// <summary>Ảnh đã lưu: URL có chữ ký, hết hạn sau một thời gian (không công khai vĩnh viễn).</summary>
public record EvidencePhotoDto(string Url, string? Caption);

/// <summary>Tài khoản ngân hàng nhận hoàn tiền; tên chủ tài khoản phải trùng tên trên hợp đồng.</summary>
public record RefundBankInput(string? BankName, string? AccountNumber, string? AccountHolder);
