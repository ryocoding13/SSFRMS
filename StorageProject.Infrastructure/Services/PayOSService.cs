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

public class PayOSService(
    AppDbContext dbContext,
    IPayOSGateway gateway,
    ILogger<PayOSService> logger,
    IConfiguration? configuration = null) : IPayOSService
{
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
            var defaultReturnUrl = $"{frontendBaseUrl}/#/reservations/{r.ReservationId}";
            var returnUrl = !string.IsNullOrWhiteSpace(request.ReturnUrl) ? request.ReturnUrl : defaultReturnUrl;
            var cancelUrl = !string.IsNullOrWhiteSpace(request.CancelUrl) ? request.CancelUrl : defaultReturnUrl;

            link = await gateway.CreateAsync(r.OrderCode.Value, (int)amount, r.ReservationId,
                new DateTimeOffset(DateTime.SpecifyKind(expiry, DateTimeKind.Utc)).ToUnixTimeSeconds(),
                returnUrl,
                cancelUrl);
        } catch (Exception ex) {
            throw new InvalidOperationException("Không tạo được link PayOS. Kiểm tra cấu hình hoặc chọn thanh toán tại cửa hàng.", ex);
        }
        r.CheckoutUrl = link.Url;
        r.PaymentQrUrl = link.Qr;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new CreatePayOSQrResponse(r.ReservationId, r.OrderCode.Value, link.Url, link.Qr, amount, expiry);
    }

    public async Task PayAtFacilityAsync(long customerId, long reservationId, CancellationToken ct = default)
    {
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{reservationId}", ct);
        var r = await dbContext.Reservations.SingleOrDefaultAsync(r => r.ReservationId == reservationId && r.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ của bạn.");
        if (r.Status == "PENDING_AT_FACILITY" && r.PaymentMethod == "AT_FACILITY") return;
        if (r.PaidAt != null || r.Status != "PENDING_PAYMENT")
            throw new InvalidOperationException("Đơn đã được xử lý, không thể đổi sang thanh toán tại kho.");
        if (r.ExpiresAt <= DateTime.UtcNow) throw new InvalidOperationException("Đơn đã hết thời gian giữ chỗ.");
        // Do not announce a switch until PayOS confirms cancellation. Keep OrderCode for delayed webhooks.
        if (r.OrderCode.HasValue)
        {
            try { await gateway.CancelAsync(r.OrderCode.Value); }
            catch (Exception ex) { throw new InvalidOperationException("Chưa xác nhận huỷ link PayOS. Đơn vẫn chờ PayOS; vui lòng thử lại.", ex); }
        }
        r.PaymentMethod = "AT_FACILITY";
        r.Status = "PENDING_AT_FACILITY";
        // Hold until the end of the scheduled check-in day (Vietnam time), never indefinitely.
        var checkInDay = r.CheckInAppointmentAt.HasValue
            ? DateOnly.FromDateTime(r.CheckInAppointmentAt.Value.AddHours(7)) : r.StartDate;
        r.ExpiresAt = checkInDay.AddDays(1).ToDateTime(TimeOnly.MinValue).AddHours(-7);
        ReservationSettlement.Audit(dbContext, customerId, "PAY_AT_FACILITY_SELECTED", r.ReservationId, new { r.OrderCode, r.ExpiresAt });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<bool> ProcessWebhookAsync(string webhookBodyJson, string? signatureHeader, CancellationToken ct = default)
    {
        VerifiedReservationPayment? verified;
        try { verified = await gateway.VerifyAsync(webhookBodyJson); }
        catch (Exception ex) { logger.LogWarning(ex, "PayOS signature verification failed"); return false; }
        if (verified == null) return true;
        var id = await dbContext.Reservations.AsNoTracking().Where(r => r.OrderCode == verified.OrderCode)
            .Select(r => (long?)r.ReservationId).SingleOrDefaultAsync(ct);
        // Never recover an order by parsing unstructured description text.
        if (id == null) { logger.LogWarning("Unknown PayOS order {OrderCode}", verified.OrderCode); return false; }
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{id}", ct);
        var r = await dbContext.Reservations.Include(r => r.UnitAssignments).SingleAsync(r => r.ReservationId == id, ct);
        if (verified.Amount != ReservationSettlement.Amount(r)) return false;
        if (r.PaymentMethod == "PAYOS" && r.PaidAt != null)
        {
            await ContractProvisioning.EnsureAsync(dbContext, r, null, ct);
            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct); // Re-delivery of the same verified order: no additional money or allocation.
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
        else await ReservationSettlement.RecordAsync(dbContext, r, "PAYMENT_GATEWAY", $"PAYOS:{verified.OrderCode}", null, ct);
        await dbContext.SaveChangesAsync(ct);
        if (r.PaymentMethod == "PAYOS" && r.PaidAt != null)
            await ContractProvisioning.EnsureAsync(dbContext, r, null, ct);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return true;
    }

    public async Task<ReservationPaymentStatusDto?> GetReservationPaymentStatusAsync(long reservationId, CancellationToken ct = default)
    {
        var r = await dbContext.Reservations.AsNoTracking().SingleOrDefaultAsync(r => r.ReservationId == reservationId, ct);
        return r == null ? null : new ReservationPaymentStatusDto(r.ReservationId, r.Status, r.PaidAt != null, r.PaidAt);
    }
}
