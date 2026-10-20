using System.Text.Json;
using Microsoft.Extensions.Configuration;
using PayOS;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

namespace StorageProject.Infrastructure.Services;

public record VerifiedReservationPayment(long OrderCode, decimal Amount);
public record CheckoutLink(string Url, string Qr);
public interface IPayOSGateway
{
    void EnsureConfigured();
    Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl);
    Task CancelAsync(long orderCode);
    Task<VerifiedReservationPayment?> VerifyAsync(string body);
}

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

    public void EnsureConfigured() => _ = Client();

    public async Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl)
    {
        var result = await Client().PaymentRequests.CreateAsync(new CreatePaymentLinkRequest {
            OrderCode = orderCode, Amount = amount, Description = $"Dat kho #{reservationId}",
            ReturnUrl = returnUrl, CancelUrl = cancelUrl, ExpiredAt = (int)expiresAt
        });
        return new CheckoutLink(result.CheckoutUrl, result.QrCode);
    }

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

    public async Task<VerifiedReservationPayment?> VerifyAsync(string body)
    {
        var webhook = JsonSerializer.Deserialize<Webhook>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Thông báo PayOS không hợp lệ.");
        var data = await Client().Webhooks.VerifyAsync(webhook);
        return webhook.Code == "00" && data.Code == "00" ? new VerifiedReservationPayment(data.OrderCode, data.Amount) : null;
    }
}
