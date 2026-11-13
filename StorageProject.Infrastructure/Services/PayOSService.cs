using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ tích hợp cổng thanh toán trực tuyến PayOS (PayOSService) thực thi IPayOSService.
/// Xử lý tạo link/mã QR thanh toán đơn đặt chỗ mới, chuyển hình thức thanh toán tại quầy,
/// tạo QR thanh toán gia hạn và xử lý Webhook thanh toán an toàn, chống lặp đơn (Idempotency).
/// </summary>
public class PayOSService(
    AppDbContext dbContext,
    IPayOSGateway gateway,
    ILogger<PayOSService> logger,
    IConfiguration? configuration = null,
    CustomerEmailWakeup? customerEmails = null) : IPayOSService
{
    /// <summary>
    /// Tạo mã VietQR và link thanh toán trực tuyến PayOS cho đơn đặt chỗ mới.
    /// Yêu cầu đã chấp thuận chính sách cho thuê trước khi tạo mã (BO07).
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="request">Yêu cầu tạo mã QR kèm ID đơn hoặc thông tin kho.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Dữ liệu link thanh toán và mã QR PayOS.</returns>
    public async Task<CreatePayOSQrResponse> CreatePaymentQrAsync(long customerId, CreatePayOSQrRequest request, CancellationToken ct = default)
    {
        var id = request.ReservationId;
        if (!id.HasValue && request.FacilityId.HasValue && request.UnitTypeId.HasValue)
        {
            var created = await new ReservationService(dbContext).CreateReservationAsync(customerId,
                new CreateReservationRequest(request.FacilityId.Value, request.UnitTypeId.Value,
                    request.StartDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)), request.RentalPeriodMonths ?? 1), ct);
            id = created.ReservationId;
        }
        if (id is null or <= 0) throw new ArgumentException("Cần mã đơn đặt chỗ hợp lệ.");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{id}", ct);
        var r = await dbContext.Reservations.SingleOrDefaultAsync(r => r.ReservationId == id && r.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ của bạn.");
        if (r.Status != "PENDING_PAYMENT" || r.PaymentMethod != "PAYOS" || r.PaidAt != null)
            throw new InvalidOperationException("Đơn không còn ở trạng thái chờ PayOS.");
        if (r.ExpiresAt <= DateTime.UtcNow) throw new InvalidOperationException("Đơn đã hết thời gian giữ chỗ.");

        // BO07: Kiểm tra bằng chứng đồng ý chính sách trước khi tạo link/mã thanh toán PayOS
        var hasConsent = await dbContext.PolicyConsents
            .AnyAsync(c => c.ReservationId == r.ReservationId && c.CustomerId == customerId, ct);
        if (!hasConsent)
        {
            throw new InvalidOperationException("Bạn cần hoàn tất chấp thuận chính sách cho thuê trước khi tạo mã thanh toán.");
        }

        var amount = ReservationSettlement.Amount(r);
        if (amount <= 0 || amount != decimal.Truncate(amount) || amount > int.MaxValue)
            throw new InvalidOperationException("Số tiền thanh toán VND không hợp lệ.");
        if (request.Amount.HasValue && request.Amount != amount)
            throw new ArgumentException("Số tiền phải khớp tiền thuê và tiền cọc do máy chủ tính.");
        var expiry = r.ExpiresAt ?? DateTime.UtcNow.AddMinutes(15);
        if (r.OrderCode != null && !string.IsNullOrEmpty(r.CheckoutUrl) && !string.IsNullOrEmpty(r.PaymentQrUrl))
            return new CreatePayOSQrResponse(r.ReservationId, r.OrderCode.Value, r.CheckoutUrl, r.PaymentQrUrl, amount, expiry);

        gateway.EnsureConfigured();
        // Commit the identifier before calling the external system. A timeout must not create another order code.
        if (r.OrderCode == null) {
            r.OrderCode = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 100 + Random.Shared.Next(100);
            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await tx.DisposeAsync();
            return await CreatePaymentQrAsync(customerId, request with { ReservationId = id }, ct);
        }
        CheckoutLink link;
        try {
            var frontendBaseUrl = configuration?["AppSettings:FrontendUrl"]?.TrimEnd('/')
                ?? configuration?["Frontend:BaseUrl"]?.TrimEnd('/')
                ?? "http://localhost:5173";
            var defaultReturnUrl = $"{frontendBaseUrl}/#/confirmation/{r.ReservationId}";
            var defaultCancelUrl = $"{frontendBaseUrl}/#/reservations/{r.ReservationId}";
            var returnUrl = !string.IsNullOrWhiteSpace(request.ReturnUrl) ? request.ReturnUrl : defaultReturnUrl;
            var cancelUrl = !string.IsNullOrWhiteSpace(request.CancelUrl) ? request.CancelUrl : defaultCancelUrl;

            link = await CreateLinkWithRetryAsync(gateway, r.OrderCode.Value, (int)amount, r.ReservationId,
                new DateTimeOffset(DateTime.SpecifyKind(expiry, DateTimeKind.Utc)).ToUnixTimeSeconds(),
                returnUrl,
                cancelUrl,
                ct);
        } catch (Exception ex) {
            throw new InvalidOperationException("Không tạo được link PayOS. Kiểm tra cấu hình hoặc chọn thanh toán tại cửa hàng.", ex);
        }
        r.CheckoutUrl = link.Url;
        r.PaymentQrUrl = link.Qr;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new CreatePayOSQrResponse(r.ReservationId, r.OrderCode.Value, link.Url, link.Qr, amount, expiry);
    }

    /// <summary>
    /// Chuyển phương thức thanh toán của đơn sang trả tiền mặt tại cơ sở kho (AT_FACILITY).
    /// Huỷ link thanh toán PayOS tương ứng nếu đã tạo trước đó.
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="reservationId">ID đơn đặt chỗ.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task PayAtFacilityAsync(long customerId, long reservationId, CancellationToken ct = default)
    {
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{reservationId}", ct);
        var r = await dbContext.Reservations.SingleOrDefaultAsync(r => r.ReservationId == reservationId && r.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ của bạn.");
        if (r.Status == "PENDING_AT_FACILITY" && r.PaymentMethod == "AT_FACILITY") return;
        if (r.PaidAt != null || r.Status != "PENDING_PAYMENT")
            throw new InvalidOperationException("Đơn đã được xử lý, không thể đổi sang thanh toán tại kho.");
        if (r.ExpiresAt <= DateTime.UtcNow) throw new InvalidOperationException("Đơn đã hết thời gian giữ chỗ.");

        // BO07: Kiểm tra bằng chứng đồng ý chính sách trước khi chọn thanh toán tại cơ sở
        var hasFacilityConsent = await dbContext.PolicyConsents
            .AnyAsync(c => c.ReservationId == r.ReservationId && c.CustomerId == customerId, ct);
        if (!hasFacilityConsent)
        {
            throw new InvalidOperationException("Bạn cần hoàn tất chấp thuận chính sách cho thuê trước khi chọn thanh toán tại cơ sở.");
        }

        // Do not announce a switch until PayOS confirms cancellation. Keep OrderCode for delayed webhooks.
        if (r.OrderCode.HasValue)
        {
            try { await gateway.CancelAsync(r.OrderCode.Value); }
            catch (Exception ex) { throw new InvalidOperationException("Chưa xác nhận huỷ link PayOS. Đơn vẫn chờ PayOS; vui lòng thử lại.", ex); }
        }
        r.PaymentMethod = "AT_FACILITY";
        r.Status = "PENDING_AT_FACILITY";
        // Hold until the end of the scheduled check-in day (Vietnam time), never indefinitely (P2).
        var checkInDay = r.CheckInAppointmentAt.HasValue
            ? DateOnly.FromDateTime(r.CheckInAppointmentAt.Value.AddHours(7)) : r.StartDate;
        r.ExpiresAt = OpsRules.CalculateCounterHoldDeadlineUtc(checkInDay);
        ReservationSettlement.Audit(dbContext, customerId, "PAY_AT_FACILITY_SELECTED", r.ReservationId, new { r.OrderCode, r.ExpiresAt });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Tạo mã QR thanh toán PayOS cho khoản phí gia hạn hợp đồng đã được quản lý phê duyệt (T03).
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="paymentId">ID khoản thanh toán gia hạn.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Dữ liệu PayosCheckoutDto chứa link và mã QR.</returns>
    public async Task<PayosCheckoutDto> CreateRenewalPaymentQrAsync(long customerId, long paymentId, CancellationToken ct = default)
    {
        var payment = await dbContext.Payments
            .Include(p => p.Contract)
            .Include(p => p.Renewal)
            .FirstOrDefaultAsync(p => p.PaymentId == paymentId && p.Contract.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy thông tin khoản thanh toán của bạn.");

        if (payment.PaymentType != "RENEWAL" || payment.Status != "PENDING")
        {
            throw new InvalidOperationException("Khoản thanh toán không ở trạng thái chờ thanh toán gia hạn.");
        }

        var renewal = payment.Renewal
            ?? throw new InvalidOperationException("Khoản thanh toán không gắn với yêu cầu gia hạn.");

        if (renewal.Status != "APPROVED")
        {
            throw new InvalidOperationException("Yêu cầu gia hạn chưa được quản lý phê duyệt.");
        }

        var now = DateTime.UtcNow;
        if (renewal.PaymentDeadlineAt.HasValue && now >= renewal.PaymentDeadlineAt.Value)
        {
            throw new InvalidOperationException("Yêu cầu gia hạn đã hết hạn thanh toán.");
        }

        // BO07: Kiểm tra bằng chứng đồng ý chính sách trước khi tạo mã thanh toán gia hạn
        var hasRenewalConsent = await dbContext.PolicyConsents
            .AnyAsync(c => c.RenewalId == renewal.RenewalId && c.CustomerId == customerId, ct);
        if (!hasRenewalConsent || !renewal.PolicyVersion.HasValue)
        {
            throw new InvalidOperationException("Bạn cần hoàn tất chấp thuận chính sách cho thuê trước khi tạo mã thanh toán.");
        }

        // Return existing active checkout if available
        var existing = await dbContext.PaymentCheckouts
            .FirstOrDefaultAsync(c => c.PaymentId == paymentId && c.Status == "PENDING" && c.ExpiresAt > now, ct);

        if (existing != null && !string.IsNullOrEmpty(existing.CheckoutUrl) && !string.IsNullOrEmpty(existing.QrCode))
        {
            return new PayosCheckoutDto(
                OrderCode: existing.OrderCode,
                Amount: existing.Amount,
                Description: $"Gia han #{renewal.RenewalId}",
                Status: existing.Status,
                QrCode: existing.QrCode,
                CheckoutUrl: existing.CheckoutUrl,
                ExpiredAt: existing.ExpiresAt,
                PaymentId: payment.PaymentId,
                RenewalId: renewal.RenewalId
            );
        }

        gateway.EnsureConfigured();

        var maxExpiry = renewal.PaymentDeadlineAt ?? now.AddHours(24);
        var expiry = now.AddMinutes(15);
        if (maxExpiry < expiry)
        {
            expiry = maxExpiry;
        }

        var orderCode = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 100 + Random.Shared.Next(100);

        var checkout = new PaymentCheckout
        {
            PaymentId = payment.PaymentId,
            OrderCode = orderCode,
            Provider = "PAYOS",
            Amount = payment.Amount,
            Status = "PENDING",
            ExpiresAt = expiry,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.PaymentCheckouts.Add(checkout);
        await dbContext.SaveChangesAsync(ct);

        CheckoutLink link;
        try
        {
            var frontendBaseUrl = configuration?["AppSettings:FrontendUrl"]?.TrimEnd('/')
                ?? configuration?["Frontend:BaseUrl"]?.TrimEnd('/')
                ?? "http://localhost:5173";
            var defaultReturnUrl = $"{frontendBaseUrl}/#/payments";

            link = await CreateRenewalLinkWithRetryAsync(
                gateway,
                orderCode,
                (int)payment.Amount,
                renewal.RenewalId,
                new DateTimeOffset(DateTime.SpecifyKind(expiry, DateTimeKind.Utc)).ToUnixTimeSeconds(),
                defaultReturnUrl,
                defaultReturnUrl,
                ct
            );
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Không tạo được link PayOS cho khoản gia hạn. Kiểm tra cấu hình hoặc chọn thanh toán tại quầy.", ex);
        }

        checkout.CheckoutUrl = link.Url;
        checkout.QrCode = link.Qr;
        await dbContext.SaveChangesAsync(ct);

        return new PayosCheckoutDto(
            OrderCode: orderCode,
            Amount: payment.Amount,
            Description: $"Gia han #{renewal.RenewalId}",
            Status: "PENDING",
            QrCode: link.Qr,
            CheckoutUrl: link.Url,
            ExpiredAt: expiry,
            PaymentId: payment.PaymentId,
            RenewalId: renewal.RenewalId
        );
    }

    /// <summary>
    /// Xử lý Webhook gửi từ PayOS sau khi giao dịch thành công.
    /// Tự động cập nhật thanh toán đơn đặt chỗ (kèm cấp hợp đồng/mã PIN) hoặc quyết toán gia hạn hợp đồng (T03).
    /// </summary>
    /// <param name="webhookBodyJson">Nội dung JSON của webhook.</param>
    /// <param name="signatureHeader">Chữ ký từ header (nếu có).</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>True nếu xử lý thành công, False nếu chữ ký sai hoặc lỗi.</returns>
    public async Task<bool> ProcessWebhookAsync(string webhookBodyJson, string? signatureHeader, CancellationToken ct = default)
    {
        VerifiedReservationPayment? verified;
        try { verified = await gateway.VerifyAsync(webhookBodyJson); }
        catch (Exception ex) { logger.LogWarning(ex, "PayOS signature verification failed"); return false; }
        if (verified == null) return true;

        var resId = await dbContext.Reservations.AsNoTracking().Where(r => r.OrderCode == verified.OrderCode)
            .Select(r => (long?)r.ReservationId).SingleOrDefaultAsync(ct);

        var checkout = await dbContext.PaymentCheckouts
            .Include(c => c.Payment).ThenInclude(p => p.Renewal)
            .FirstOrDefaultAsync(c => c.OrderCode == verified.OrderCode, ct);

        // Collision check
        if (resId != null && checkout != null)
        {
            logger.LogError("Critical collision: OrderCode {OrderCode} matches both a reservation and a payment checkout!", verified.OrderCode);
            return false;
        }

        if (resId == null && checkout == null)
        {
            logger.LogWarning("Unknown PayOS order {OrderCode}", verified.OrderCode);
            return false;
        }

        // Branch 1: Reservation settlement (untouched D23/D26 flow)
        if (resId != null)
        {
            var id = resId.Value;
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{id}", ct);
            var r = await dbContext.Reservations.Include(r => r.UnitAssignments).SingleAsync(r => r.ReservationId == id, ct);
            if (verified.Amount != ReservationSettlement.Amount(r)) return false;
            if (r.PaymentMethod == "PAYOS" && r.PaidAt != null)
            {
                var issued = await ContractProvisioning.EnsureAsync(dbContext, r, null, ct);
                await dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct); // Re-delivery of the same verified order: no additional money or allocation.
                if (issued) customerEmails?.Notify();
                return true;
            }
            if (r.PaymentMethod == "AT_FACILITY" || r.Status != "PENDING_PAYMENT" || r.ExpiresAt <= DateTime.UtcNow)
            {
                var detail = JsonSerializer.Serialize(new { verified.OrderCode, verified.Amount, reason = "Tiền về sau đổi phương thức/đóng đơn; cần kiểm tra hoàn thủ công" });
                if (!await dbContext.ActivityLogs.AnyAsync(l => l.EntityType == "RESERVATION" && l.EntityId == id &&
                    l.Action == "PAYMENT_REVIEW_REQUIRED" && l.NewValue == detail, ct))
                    dbContext.ActivityLogs.Add(new ActivityLog { EntityType = "RESERVATION", EntityId = id,
                        Action = "PAYMENT_REVIEW_REQUIRED", NewValue = detail, LoggedAt = DateTime.UtcNow });
            }
            else
            {
                await ReservationSettlement.RecordAsync(dbContext, r, "PAYMENT_GATEWAY", $"PAYOS:{verified.OrderCode}", null, ct);
                await dbContext.SaveChangesAsync(ct);
                if (!await ContractProvisioning.EnsureAsync(dbContext, r, null, ct))
                    CustomerEmailDelivery.QueuePaymentReceipt(dbContext, r);
                await dbContext.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                customerEmails?.Notify();
                return true;
            }
            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return true;
        }

        // Branch 2: Renewal checkout settlement
        if (checkout != null)
        {
            var payment = checkout.Payment;
            var renewal = payment?.Renewal;
            if (payment == null || renewal == null)
            {
                logger.LogWarning("Payment checkout {OrderCode} missing payment or renewal", verified.OrderCode);
                return false;
            }

            var contractId = payment.ContractId
                ?? throw new InvalidOperationException("Khoản thanh toán gia hạn không gắn với hợp đồng.");

            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{contractId}", ct);

            if (verified.Amount != checkout.Amount)
            {
                logger.LogWarning("Amount mismatch for PayOS renewal order {OrderCode}: expected {Expected}, got {Actual}",
                    verified.OrderCode, checkout.Amount, verified.Amount);
                return false;
            }

            var settled = await RenewalSettlement.RecordAsync(
                dbContext,
                contractId,
                renewal.RenewalId,
                "PAYMENT_GATEWAY",
                $"PAYOS:{verified.OrderCode}",
                null,
                ct
            );

            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return settled;
        }

        return false;
    }

    /// <summary>
    /// Tra cứu trạng thái thanh toán của một đơn đặt chỗ.
    /// </summary>
    /// <param name="reservationId">ID đơn đặt chỗ.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Trạng thái thanh toán của đơn.</returns>
    public async Task<ReservationPaymentStatusDto?> GetReservationPaymentStatusAsync(long reservationId, CancellationToken ct = default)
    {
        var r = await dbContext.Reservations.AsNoTracking().SingleOrDefaultAsync(r => r.ReservationId == reservationId, ct);
        return r == null ? null : new ReservationPaymentStatusDto(r.ReservationId, r.Status, r.PaidAt != null, r.PaidAt);
    }

    private static async Task<CheckoutLink> CreateLinkWithRetryAsync(IPayOSGateway gateway, long orderCode, int amount, long reservationId, long expiresAt, string returnUrl, string cancelUrl, CancellationToken ct)
    {
        try
        {
            return await gateway.CreateAsync(orderCode, amount, reservationId, expiresAt, returnUrl, cancelUrl);
        }
        catch
        {
            await Task.Delay(500, ct);
            return await gateway.CreateAsync(orderCode, amount, reservationId, expiresAt, returnUrl, cancelUrl);
        }
    }

    private static async Task<CheckoutLink> CreateRenewalLinkWithRetryAsync(IPayOSGateway gateway, long orderCode, int amount, long renewalId, long expiresAt, string returnUrl, string cancelUrl, CancellationToken ct)
    {
        try
        {
            return await gateway.CreateRenewalAsync(orderCode, amount, renewalId, expiresAt, returnUrl, cancelUrl);
        }
        catch
        {
            await Task.Delay(500, ct);
            return await gateway.CreateRenewalAsync(orderCode, amount, renewalId, expiresAt, returnUrl, cancelUrl);
        }
    }
}
