namespace StorageProject.Core.Entities;

/// <summary>
/// Phiên thanh toán trực tuyến qua cổng thanh toán PayOS / VietQR (F02 / F07).
/// </summary>
public class PaymentCheckout
{
    /// <summary>Mã định danh phiên thanh toán.</summary>
    public long CheckoutId { get; set; }

    /// <summary>Mã khoản thanh toán liên kết trong bảng Payment.</summary>
    public long PaymentId { get; set; }

    /// <summary>Mã số đơn hàng duy nhất gửi sang cổng PayOS (OrderCode).</summary>
    public long OrderCode { get; set; }

    /// <summary>Tên nhà cung cấp cổng thanh toán (mặc định PAYOS).</summary>
    public string Provider { get; set; } = "PAYOS"; // PAYOS

    /// <summary>Số tiền cần thanh toán trong phiên này (VND).</summary>
    public decimal Amount { get; set; }

    /// <summary>Trạng thái phiên thanh toán: PENDING, PAID, CANCELLED, EXPIRED.</summary>
    public string Status { get; set; } = "PENDING"; // PENDING, PAID, CANCELLED, EXPIRED

    /// <summary>Đường link chuyển hướng sang trang thanh toán PayOS.</summary>
    public string? CheckoutUrl { get; set; }

    /// <summary>Chuỗi mã QR VietQR PayOS.</summary>
    public string? QrCode { get; set; }

    /// <summary>Thời điểm hết hạn của phiên thanh toán.</summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>Thời điểm tạo phiên thanh toán.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Thời điểm cập nhật phiên thanh toán lần gần nhất.</summary>
    public DateTime UpdatedAt { get; set; }

    public Payment Payment { get; set; } = null!;
}
