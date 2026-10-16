namespace StorageProject.Core.Exceptions;

/// <summary>Đơn đặt chỗ đã quá thời gian giữ chỗ. Endpoint trả 400 kèm <c>code = "EXPIRED"</c> (BE-CONTRACT C04).</summary>
public class ReservationExpiredException(string message) : InvalidOperationException(message);
