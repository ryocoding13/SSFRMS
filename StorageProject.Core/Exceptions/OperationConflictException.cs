namespace StorageProject.Core.Exceptions;

/// <summary>
/// Thao tác hợp lệ về dữ liệu nhưng xung đột với trạng thái hiện tại của hệ thống
/// (ví dụ: chính sách trùng mức ưu tiên, ngừng cơ sở còn hợp đồng). Endpoint trả 409.
/// </summary>
public class OperationConflictException(string message, object? details = null) : Exception(message)
{
    public object? Details { get; } = details;
}
