using StorageProject.Infrastructure.Services;

namespace StorageProject.IntegrationTests.Infrastructure;

public sealed class FakePayOSGateway : IPayOSGateway
{
    public VerifiedReservationPayment? NextVerifiedPayment { get; set; }
    public bool ShouldFailVerification { get; set; }

    public void EnsureConfigured()
    {
    }

    public Task<CheckoutLink> CreateAsync(long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl)
    {
        return Task.FromResult(new CheckoutLink(
            $"https://pay.payos.vn/fake-checkout/{orderCode}",
            $"https://qr.payos.vn/fake-qr/{orderCode}"));
    }

    public Task CancelAsync(long orderCode)
    {
        return Task.CompletedTask;
    }

    public Task<VerifiedReservationPayment?> VerifyAsync(string body)
    {
        if (ShouldFailVerification)
        {
            throw new InvalidOperationException("Fake verification failed signature check.");
        }

        return Task.FromResult(NextVerifiedPayment);
    }
}
