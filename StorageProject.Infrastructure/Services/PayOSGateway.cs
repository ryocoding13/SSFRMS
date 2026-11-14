using System.Text.Json;
using Microsoft.Extensions.Configuration;
using PayOS;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Bản ghi thanh toán đơn đặt chỗ hoặc gia hạn đã được PayOS xác thực qua Webhook.
/// </summary>
/// <param name="OrderCode">Mã đơn hàng PayOS.</param>
/// <param name="Amount">Số tiền thanh toán.</param>
/// <param name="TransactionReference">Mã tham chiếu giao dịch ngân hàng.</param>
public record VerifiedReservationPayment(long OrderCode, decimal Amount, string? TransactionReference = null);

/// <summary>
/// Đường dẫn thanh toán và mã QR được tạo từ cổng PayOS.
/// </summary>
/// <param name="Url">URL trang thanh toán trực tuyến.</param>
/// <param name="Qr">Chuỗi dữ liệu mã VietQR thanh toán.</param>
public record CheckoutLink(string Url, string Qr);

/// <summary>
/// Giao diện cổng thanh toán PayOS Gateway (tạo link thanh toán, huỷ link và xác thực Webhook).
/// </summary>
public interface IPayOSGateway
{
    /// <summary>
    /// Kiểm tra cấu hình PayOS (ClientId, ApiKey, ChecksumKey) đã hợp lệ hay chưa.
    /// </summary>
    void EnsureConfigured();

    /// <summary>
    /// Tạo liên kết thanh toán PayOS cho đơn đặt chỗ mới.
    /// </summary>
    Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl);

    /// <summary>
    /// Tạo liên kết thanh toán PayOS cho yêu cầu gia hạn hợp đồng.
    /// </summary>
    Task<CheckoutLink> CreateRenewalAsync(long orderCode, int amount, long renewalId, long expiresAt, string returnUrl, string cancelUrl)
        => CreateAsync(orderCode, amount, renewalId, expiresAt, returnUrl, cancelUrl);

    /// <summary>
    /// Huỷ liên kết thanh toán PayOS theo mã đơn hàng.
    /// </summary>
    Task CancelAsync(long orderCode);

    /// <summary>
    /// Xác thực dữ liệu Webhook gửi từ PayOS bằng ChecksumKey.
    /// </summary>
    Task<VerifiedReservationPayment?> VerifyAsync(string body);

    /// <summary>
    /// Hỏi thẳng PayOS trạng thái link theo mã đơn (đối soát khi webhook không về, ví dụ chạy backend trên máy cá nhân).
    /// Trả về khoản đã thanh toán đủ, hoặc null nếu link chưa trả / không tồn tại.
    /// </summary>
    Task<VerifiedReservationPayment?> GetPaidAsync(long orderCode) => Task.FromResult<VerifiedReservationPayment?>(null);
}

/// <summary>
/// Triển khai cổng thanh toán PayOS sử dụng thư viện chính thức PayOS SDK.
/// </summary>
public sealed class SdkPayOSGateway(IConfiguration config) : IPayOSGateway
{
    private PayOSClient Client()
    {
        var clientId = config["PayOS:ClientId"];
        var apiKey = config["PayOS:ApiKey"];
        var checksum = config["PayOS:ChecksumKey"];
        if (new[] { clientId, apiKey, checksum }.Any(x => string.IsNullOrWhiteSpace(x) || x.StartsWith("YOUR_")))
            throw new InvalidOperationException("PayOS chưa được cấu hình. Vui lòng chọn thanh toán tại cửa hàng.");
        return new PayOSClient(new PayOSOptions { ClientId = clientId!, ApiKey = apiKey!, ChecksumKey = checksum! });
    }

    /// <summary>
    /// Đảm bảo thông tin kết nối PayOS đã được cấu hình đầy đủ.
    /// </summary>
    public void EnsureConfigured() => _ = Client();

    /// <summary>
    /// Tạo liên kết thanh toán PayOS cho đơn đặt chỗ.
    /// </summary>
    public async Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl)
    {
        var result = await Client().PaymentRequests.CreateAsync(new CreatePaymentLinkRequest {
            OrderCode = orderCode, Amount = amount, Description = $"Dat kho #{reservationId}",
            ReturnUrl = returnUrl, CancelUrl = cancelUrl, ExpiredAt = (int)expiresAt
        });
        return new CheckoutLink(result.CheckoutUrl, result.QrCode);
    }

    /// <summary>
    /// Tạo liên kết thanh toán PayOS cho khoản gia hạn hợp đồng.
    /// </summary>
    public async Task<CheckoutLink> CreateRenewalAsync(long orderCode, int amount, long renewalId, long expiresAt, string returnUrl, string cancelUrl)
    {
        var result = await Client().PaymentRequests.CreateAsync(new CreatePaymentLinkRequest {
            OrderCode = orderCode, Amount = amount, Description = $"Gia han #{renewalId}",
            ReturnUrl = returnUrl, CancelUrl = cancelUrl, ExpiredAt = (int)expiresAt
        });
        return new CheckoutLink(result.CheckoutUrl, result.QrCode);
    }

    /// <summary>
    /// Hủy liên kết thanh toán trên PayOS nếu khách hàng đổi phương thức hoặc huỷ đơn.
    /// </summary>
    public async Task CancelAsync(long orderCode)
    {
        var client = Client();
        PayOS.Models.V2.PaymentRequests.PaymentLink existing;
        try { existing = await client.PaymentRequests.GetAsync(orderCode); }
        catch (PayOS.Exceptions.NotFoundException) { return; } // PayOS confirms that no payable link exists.
        if (existing.AmountPaid > 0 || existing.Status.ToString().ToUpperInvariant() == "PAID")
            throw new InvalidOperationException("PayOS đã nhận tiền. Hãy chờ cập nhật thanh toán, không chuyển sang trả tại kho.");
        if (existing.Status.ToString().ToUpperInvariant() == "CANCELLED") return;
        var cancelled = await client.PaymentRequests.CancelAsync(orderCode, "Khach chon thanh toan tai cua hang");
        if (cancelled.Status.ToString().ToUpperInvariant() != "CANCELLED")
            throw new InvalidOperationException("Chưa huỷ được link PayOS. Vui lòng thử lại trước khi đổi phương thức.");
    }

    /// <summary>
    /// Đối soát: đọc link thanh toán trên PayOS bằng API có xác thực (ClientId/ApiKey), chỉ nhận link đã PAID và trả đủ tiền.
    /// </summary>
    public async Task<VerifiedReservationPayment?> GetPaidAsync(long orderCode)
    {
        PayOS.Models.V2.PaymentRequests.PaymentLink link;
        try { link = await Client().PaymentRequests.GetAsync(orderCode); }
        catch (PayOS.Exceptions.NotFoundException) { return null; }
        if (link.Status != PaymentLinkStatus.Paid || link.AmountPaid <= 0 || link.AmountPaid < link.Amount) return null;
        return new VerifiedReservationPayment(link.OrderCode, link.AmountPaid, link.Transactions?.LastOrDefault()?.Reference);
    }

    /// <summary>
    /// Xác thực tính toàn vẹn của webhook payload từ PayOS bằng chữ ký checksum.
    /// </summary>
    public async Task<VerifiedReservationPayment?> VerifyAsync(string body)
    {
        var webhook = JsonSerializer.Deserialize<Webhook>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Thông báo PayOS không hợp lệ.");
        var data = await Client().Webhooks.VerifyAsync(webhook);
        return webhook.Code == "00" && data.Code == "00" ? new VerifiedReservationPayment(data.OrderCode, data.Amount) : null;
    }
}
