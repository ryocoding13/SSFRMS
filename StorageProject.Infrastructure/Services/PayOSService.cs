using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PayOS;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class PayOSService : IPayOSService
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PayOSService> _logger;
    private readonly PayOSClient? _payOSClient;
    private readonly string _clientId;
    private readonly string _apiKey;
    private readonly string _checksumKey;

    public PayOSService(AppDbContext dbContext, IConfiguration configuration, ILogger<PayOSService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;

        _clientId = _configuration["PayOS:ClientId"] ?? "";
        _apiKey = _configuration["PayOS:ApiKey"] ?? "";
        _checksumKey = _configuration["PayOS:ChecksumKey"] ?? "";

        if (!string.IsNullOrWhiteSpace(_clientId) && 
            !string.IsNullOrWhiteSpace(_apiKey) && 
            !string.IsNullOrWhiteSpace(_checksumKey) &&
            !_clientId.StartsWith("YOUR_") &&
            !_apiKey.StartsWith("YOUR_"))
        {
            try
            {
                var options = new PayOSOptions
                {
                    ClientId = _clientId,
                    ApiKey = _apiKey,
                    ChecksumKey = _checksumKey
                };
                _payOSClient = new PayOSClient(options);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not initialize PayOSClient with configured credentials.");
            }
        }
    }

    public async Task<CreatePayOSQrResponse> CreatePaymentQrAsync(long customerId, CreatePayOSQrRequest request, CancellationToken ct = default)
    {
        Reservation? reservation = null;

        if (request.ReservationId.HasValue && request.ReservationId.Value > 0)
        {
            reservation = await _dbContext.Reservations
                .FirstOrDefaultAsync(r => r.ReservationId == request.ReservationId.Value && r.CustomerId == customerId, ct);

            if (reservation == null)
            {
                throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ tương ứng với tài khoản.");
            }
        }
        else if (request.FacilityId.HasValue && request.UnitTypeId.HasValue)
        {
            var facility = await _dbContext.Facilities.FindAsync([request.FacilityId.Value], ct)
                ?? throw new InvalidOperationException("Không tìm thấy cơ sở kho.");

            var unitType = await _dbContext.UnitTypes.FindAsync([request.UnitTypeId.Value], ct)
                ?? throw new InvalidOperationException("Không tìm thấy loại phòng kho.");

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var rentalPeriod = request.RentalPeriodMonths.GetValueOrDefault(1);
            if (rentalPeriod <= 0) rentalPeriod = 1;

            var activeRate = await _dbContext.RentalRates
                .Where(r => r.FacilityId == request.FacilityId.Value
                         && r.UnitTypeId == request.UnitTypeId.Value
                         && r.EffectiveFrom <= today
                         && (r.EffectiveTo == null || r.EffectiveTo >= today))
                .OrderByDescending(r => r.EffectiveFrom)
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException("Chưa có bảng giá áp dụng cho loại kho này.");

            var expectedEndDate = (request.StartDate ?? today).AddMonths(rentalPeriod);
            var monthlyRate = activeRate.MonthlyRate;
            var estimatedAmount = monthlyRate * rentalPeriod;
            var requiredDeposit = monthlyRate;

            reservation = new Reservation
            {
                CustomerId = customerId,
                FacilityId = request.FacilityId.Value,
                UnitTypeId = request.UnitTypeId.Value,
                StartDate = request.StartDate ?? today,
                ExpectedEndDate = expectedEndDate,
                RentalPeriodMonths = rentalPeriod,
                QuotedMonthlyRate = monthlyRate,
                EstimatedAmount = estimatedAmount,
                RequiredDeposit = requiredDeposit,
                Status = "PENDING_PAYMENT",
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Reservations.Add(reservation);
            await _dbContext.SaveChangesAsync(ct);
        }
        else
        {
            throw new ArgumentException("Yêu cầu cần có ReservationId hoặc thông tin FacilityId + UnitTypeId.");
        }

        if (reservation.Status != "PENDING_PAYMENT" && reservation.Status != "CONFIRMED")
        {
            throw new InvalidOperationException($"Không thể tạo mã thanh toán cho đơn đặt chỗ có trạng thái '{reservation.Status}'.");
        }

        long orderCode = reservation.OrderCode ?? long.Parse(DateTime.UtcNow.ToString("yyMMddHHmmss") + Random.Shared.Next(10, 99));
        int amount = (int)(reservation.EstimatedAmount + (reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : 0));
        if (request.Amount.HasValue && request.Amount.Value > 0)
        {
            amount = (int)request.Amount.Value;
        }

        string checkoutUrl = reservation.CheckoutUrl ?? "";
        string qrCode = reservation.PaymentQrUrl ?? "";
        bool hasValidPayOS = !string.IsNullOrEmpty(checkoutUrl) && checkoutUrl.StartsWith("https://pay.payos.vn", StringComparison.OrdinalIgnoreCase);

        // Reuse existing valid PayOS link immediately without regenerating
        if (hasValidPayOS && !string.IsNullOrEmpty(qrCode))
        {
            return new CreatePayOSQrResponse(
                reservation.ReservationId,
                orderCode,
                checkoutUrl,
                qrCode,
                amount
            );
        }

        if (!hasValidPayOS || string.IsNullOrEmpty(qrCode))
        {
            if (_payOSClient != null)
            {
                try
                {
                    // Reuse existing orderCode if already assigned to reservation to prevent link desync
                    if (!reservation.OrderCode.HasValue || reservation.OrderCode.Value <= 0)
                    {
                        orderCode = long.Parse(DateTime.UtcNow.ToString("yyMMddHHmmss") + Random.Shared.Next(10, 99));
                    }
                    else
                    {
                        orderCode = reservation.OrderCode.Value;
                    }

                    var items = new List<PaymentLinkItem>
                    {
                        new PaymentLinkItem
                        {
                            Name = $"Dat kho #{reservation.ReservationId}",
                            Quantity = 1,
                            Price = amount
                        }
                    };

                    var paymentLinkRequest = new CreatePaymentLinkRequest
                    {
                        OrderCode = orderCode,
                        Amount = amount,
                        Description = $"Dat kho #{reservation.ReservationId}",
                        Items = items,
                        CancelUrl = request.CancelUrl ?? "http://localhost:5173/checkout/cancel",
                        ReturnUrl = request.ReturnUrl ?? $"http://localhost:5173/confirmation/{reservation.ReservationId}"
                    };

                    var createResult = await _payOSClient.PaymentRequests.CreateAsync(paymentLinkRequest);
                    checkoutUrl = createResult.CheckoutUrl ?? "";
                    qrCode = createResult.QrCode ?? "";
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to call PayOS SDK createPaymentLink for OrderCode {OrderCode}. Falling back to default QR format.", orderCode);
                }
            }

            if (string.IsNullOrEmpty(qrCode))
            {
                qrCode = $"https://img.vietqr.io/image/MB-0335012345-compact2.png?amount={amount}&addInfo=SSFRMS%20{orderCode}&accountName=SAFE%20SPACE";
            }
            if (string.IsNullOrEmpty(checkoutUrl))
            {
                checkoutUrl = request.ReturnUrl ?? $"http://localhost:5173/confirmation/{reservation.ReservationId}";
            }

            reservation.OrderCode = orderCode;
            reservation.CheckoutUrl = checkoutUrl;
            reservation.PaymentQrUrl = qrCode;
            await _dbContext.SaveChangesAsync(ct);
        }

        return new CreatePayOSQrResponse(
            reservation.ReservationId,
            orderCode,
            checkoutUrl,
            qrCode,
            amount
        );
    }

    public async Task<bool> ProcessWebhookAsync(string webhookBodyJson, string? signatureHeader, CancellationToken ct = default)
    {
        if (_payOSClient == null)
        {
            _logger.LogError("PayOSClient is not initialized. Cannot securely verify webhook signature.");
            return false;
        }

        Webhook? webhookModel;
        try
        {
            webhookModel = JsonSerializer.Deserialize<Webhook>(webhookBodyJson);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse PayOS webhook payload as JSON.");
            return false;
        }

        if (webhookModel == null)
        {
            _logger.LogWarning("PayOS webhook payload deserialized to null.");
            return false;
        }

        WebhookData verifiedData;
        try
        {
            verifiedData = await _payOSClient.Webhooks.VerifyAsync(webhookModel);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PayOS webhook signature verification failed.");
            return false;
        }

        if (verifiedData == null)
        {
            _logger.LogWarning("PayOS webhook verification returned null data.");
            return false;
        }

        // Webhook signature verified. Check transaction code.
        if (webhookModel.Code != "00")
        {
            _logger.LogInformation("PayOS webhook verified, but payment code is '{Code}' (Description: {Description}). Skipping database updates.",
                webhookModel.Code, webhookModel.Description);
            return true;
        }

        long orderCode = verifiedData.OrderCode;
        if (orderCode <= 0)
        {
            _logger.LogWarning("Verified PayOS webhook contains invalid OrderCode: {OrderCode}.", orderCode);
            return false;
        }

        var reservation = await _dbContext.Reservations
            .Include(r => r.UnitAssignments)
            .FirstOrDefaultAsync(r => r.OrderCode == orderCode, ct);

        // Fallback: If not found by OrderCode, attempt to extract reservationId from description
        // (e.g. PayOS description: "Dat kho #25" or "Dat kho 25")
        if (reservation == null)
        {
            long extractedId = 0;
            var desc = verifiedData.Description ?? "";
            var match = System.Text.RegularExpressions.Regex.Match(desc, @"(?:Dat kho #?|kho\s*#?|#)(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success && long.TryParse(match.Groups[1].Value, out var parsedId))
            {
                extractedId = parsedId;
            }

            if (extractedId > 0)
            {
                reservation = await _dbContext.Reservations
                    .Include(r => r.UnitAssignments)
                    .FirstOrDefaultAsync(r => r.ReservationId == extractedId, ct);

                if (reservation != null)
                {
                    _logger.LogInformation("Matched Reservation {ReservationId} via description '{Description}' for OrderCode {OrderCode}.",
                        reservation.ReservationId, desc, orderCode);
                    // Sync OrderCode to the one actually paid on PayOS
                    reservation.OrderCode = orderCode;
                }
            }
        }

        if (reservation == null)
        {
            _logger.LogWarning("Verified PayOS webhook received for OrderCode {OrderCode} (Desc: '{Desc}'), but no matching reservation found. Acknowledging webhook.",
                orderCode, verifiedData.Description);
            return true;
        }

        // Idempotency: skip if already confirmed or in subsequent status
        if (reservation.Status != "PENDING_PAYMENT")
        {
            _logger.LogInformation("Reservation {ReservationId} (OrderCode {OrderCode}) is already in status '{Status}'. Skipping duplicate webhook processing.",
                reservation.ReservationId, orderCode, reservation.Status);
            return true;
        }

        reservation.Status = "CONFIRMED";
        reservation.PaidAt = DateTime.UtcNow;

        // Idempotent assignment: Only assign if no ACTIVE assignment exists
        bool hasActiveAssignment = reservation.UnitAssignments.Any(ua => ua.Status == "ACTIVE");
        if (!hasActiveAssignment)
        {
            var assignedUnit = await _dbContext.StorageUnits
                .FirstOrDefaultAsync(u => u.FacilityId == reservation.FacilityId &&
                                          u.UnitTypeId == reservation.UnitTypeId &&
                                          u.Status == "AVAILABLE", ct);

            if (assignedUnit != null)
            {
                assignedUnit.Status = "RESERVED";
                assignedUnit.UpdatedAt = DateTime.UtcNow;

                _dbContext.UnitAssignments.Add(new UnitAssignment
                {
                    ReservationId = reservation.ReservationId,
                    UnitId = assignedUnit.UnitId,
                    AssignedBy = null, // System automated assignment
                    Status = "ACTIVE",
                    AssignedAt = DateTime.UtcNow,
                    Reason = "Tự động gán kho sau khi thanh toán VietQR thành công"
                });
            }
            else
            {
                _logger.LogWarning("No AVAILABLE storage unit found for FacilityId {FacilityId}, UnitTypeId {UnitTypeId} for Reservation {ReservationId}.",
                    reservation.FacilityId, reservation.UnitTypeId, reservation.ReservationId);
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        _logger.LogInformation("Successfully confirmed reservation {ReservationId} (OrderCode {OrderCode}) via verified PayOS Webhook.",
            reservation.ReservationId, orderCode);

        return true;
    }

    public async Task<ReservationPaymentStatusDto?> GetReservationPaymentStatusAsync(long reservationId, CancellationToken ct = default)
    {
        var reservation = await _dbContext.Reservations
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.ReservationId == reservationId, ct);

        if (reservation == null) return null;

        bool isPaid = reservation.Status is "CONFIRMED" or "UNIT_ASSIGNED" or "CHECKED_IN";
        return new ReservationPaymentStatusDto(
            reservation.ReservationId,
            reservation.Status,
            isPaid,
            reservation.PaidAt
        );
    }
}
