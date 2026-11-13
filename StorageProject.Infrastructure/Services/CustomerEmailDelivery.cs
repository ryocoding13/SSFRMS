using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using MimeKit;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public sealed record OverdueEmailDetails(DateOnly EndDate, int Days, decimal Deduction);

public sealed class CustomerEmailDelivery(AppDbContext db, ISmtpMailTransport mail,
    ILogger<CustomerEmailDelivery> logger, IConfiguration? configuration = null)
{
    public const string ContractQueued = "CONTRACT_EMAIL_QUEUED";
    public const string PaymentQueued = "RESERVATION_PAYMENT_EMAIL_QUEUED";
    public const string RenewalReminderQueued = "RENEWAL_REMINDER_EMAIL_QUEUED";
    public const string OverdueQueued = "OVERDUE_EMAIL_QUEUED";
    public const string Attempted = "CUSTOMER_EMAIL_ATTEMPTED";
    public const string Sent = "CUSTOMER_EMAIL_SENT";
    public const string Failed = "CUSTOMER_EMAIL_FAILED";
    public const string Skipped = "CUSTOMER_EMAIL_SKIPPED";
    /// <summary>SMTP chắc chắn chưa nhận thư; worker thử lại sau <see cref="RetryDelay"/>, tối đa <see cref="MaxAttempts"/> lần.</summary>
    public const string Deferred = "CUSTOMER_EMAIL_DEFERRED";
    public const int MaxAttempts = 5;
    public static readonly TimeSpan RetryDelay = TimeSpan.FromMinutes(5);
    private const string ContractEntity = "RENTAL_CONTRACT";
    private const string ReservationEntity = "RESERVATION";
    private const int RenewalReminderDays = 3;
    private const string EmailEntity = "CUSTOMER_EMAIL";

    public static void QueueContract(AppDbContext db, long contractId, DateTime issuedAt) =>
        db.ActivityLogs.Add(new ActivityLog
        {
            Action = ContractQueued, EntityType = ContractEntity, EntityId = contractId, LoggedAt = issuedAt
        });

    public static void QueuePaymentReceipt(AppDbContext db, Reservation reservation) =>
        db.ActivityLogs.Add(new ActivityLog
        {
            Action = PaymentQueued, EntityType = ReservationEntity,
            EntityId = reservation.ReservationId, LoggedAt = DateTime.UtcNow
        });

    private static IQueryable<RentalContract> EligibleForReminder(AppDbContext db, DateOnly today) =>
        db.RentalContracts.Where(c => (c.Status == "ACTIVE" || c.Status == "EXPIRING")
            && c.EndDate > today && c.EndDate <= today.AddDays(RenewalReminderDays)
            && c.Customer.Status == "ACTIVE"
            && !c.ReturnInspections.Any(i => i.Status != "CANCELLED")
            && !c.ContractRenewals.Any(r => r.Status == "PENDING" || r.Status == "APPROVED"));

    public static async Task QueueRenewalRemindersAsync(AppDbContext db, DateOnly today, DateTime now, CancellationToken ct)
    {
        var candidates = await EligibleForReminder(db, today).AsNoTracking()
            .Select(c => new { c.ContractId, c.EndDate }).ToListAsync(ct);
        var periods = candidates.Select(c => Period(c.EndDate)).Distinct().ToArray();
        if (periods.Length == 0) return;

        var queued = await db.ActivityLogs.AsNoTracking()
            .Where(log => log.EntityType == ContractEntity && log.Action == RenewalReminderQueued
                && log.EntityId.HasValue && log.OldValue != null && periods.Contains(log.OldValue))
            .Select(log => new { log.EntityId, log.OldValue }).ToListAsync(ct);
        var keys = queued.Select(log => (log.EntityId!.Value, log.OldValue!)).ToHashSet();

        foreach (var candidate in candidates)
        {
            var period = Period(candidate.EndDate);
            if (keys.Contains((candidate.ContractId, period))) continue;

            await using var tx = await CheckoutTransaction.BeginAsync(db, $"renewal-reminder:{candidate.ContractId}", ct);
            if (await EligibleForReminder(db, today).AnyAsync(c => c.ContractId == candidate.ContractId
                && c.EndDate == candidate.EndDate, ct)
                && !await db.ActivityLogs.AnyAsync(log => log.EntityType == ContractEntity
                    && log.Action == RenewalReminderQueued && log.EntityId == candidate.ContractId && log.OldValue == period, ct))
            {
                db.ActivityLogs.Add(new ActivityLog
                {
                    Action = RenewalReminderQueued, EntityType = ContractEntity, EntityId = candidate.ContractId,
                    OldValue = period, LoggedAt = now
                });
                await db.SaveChangesAsync(ct);
            }
            await tx.CommitAsync(ct);
        }
    }

    private static string Period(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    // Gọi trong giao dịch khóa move-out của OverdueProcessor. Mỗi kỳ chỉ có một sự kiện.
    public static async Task QueueOverdueAsync(AppDbContext db, long contractId, OverdueEmailDetails overdue,
        DateTime now, CancellationToken ct)
    {
        var period = Period(overdue.EndDate);
        if (await db.ActivityLogs.AnyAsync(log => log.EntityType == ContractEntity && log.EntityId == contractId
            && log.Action == OverdueQueued && log.OldValue == period, ct)) return;

        db.ActivityLogs.Add(new ActivityLog
        {
            Action = OverdueQueued, EntityType = ContractEntity, EntityId = contractId, OldValue = period,
            NewValue = JsonSerializer.Serialize(overdue), LoggedAt = now
        });
    }

    public async Task DeliverPendingAsync(CancellationToken ct)
    {
        var retryBefore = DateTime.UtcNow - RetryDelay;
        var pending = await Due(db.ActivityLogs.AsNoTracking()
                .Where(log => log.EntityId != null
                    && ((log.EntityType == ContractEntity && (log.Action == ContractQueued
                        || log.Action == OverdueQueued || log.Action == RenewalReminderQueued))
                        || (log.EntityType == ReservationEntity && log.Action == PaymentQueued))), retryBefore)
            .OrderBy(log => log.Action == ContractQueued || log.Action == PaymentQueued ? 0 : 1)
            .ThenBy(log => log.LogId).Take(20).ToListAsync(ct);

        foreach (var notice in pending)
        {
            if (!await ClaimAsync(notice, ct)) continue;
            await SendAsync(notice, ct);
        }
    }

    /// <summary>
    /// Sự kiện cần gửi: chưa thử lần nào, hoặc mọi lần thử trước đều bị SMTP từ chối chắc chắn (Deferred),
    /// còn lượt và đã qua thời gian chờ. Lần thử có kết quả chưa rõ thì không bao giờ tự gửi lại.
    /// </summary>
    private IQueryable<ActivityLog> Due(IQueryable<ActivityLog> notices, DateTime retryBefore) =>
        notices.Where(log =>
            db.ActivityLogs.Count(r => r.EntityType == EmailEntity && r.EntityId == log.LogId && r.Action == Attempted) < MaxAttempts
            && db.ActivityLogs.Count(r => r.EntityType == EmailEntity && r.EntityId == log.LogId && r.Action == Attempted)
                == db.ActivityLogs.Count(r => r.EntityType == EmailEntity && r.EntityId == log.LogId && r.Action == Deferred)
            && !db.ActivityLogs.Any(r => r.EntityType == EmailEntity && r.EntityId == log.LogId && r.Action == Deferred
                && r.LoggedAt > retryBefore));

    private async Task<bool> ClaimAsync(ActivityLog notice, CancellationToken ct)
    {
        await using var transaction = await CheckoutTransaction.BeginAsync(db, $"customer-email:{notice.LogId}", ct);
        var retryBefore = DateTime.UtcNow - RetryDelay;
        if (!await Due(db.ActivityLogs.Where(log => log.LogId == notice.LogId), retryBefore).AnyAsync(ct)) return false;

        // Ghi nhận trước khi gọi SMTP. Nếu tiến trình dừng khi kết quả chưa rõ thì không tự gửi lần hai.
        db.ActivityLogs.Add(Result(notice, Attempted));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return true;
    }

    private async Task SendAsync(ActivityLog notice, CancellationToken ct)
    {
        if (notice.Action == PaymentQueued)
        {
            await SendPaymentReceiptAsync(notice, ct);
            return;
        }

        var contract = await db.RentalContracts.AsNoTracking()
            .Where(c => c.ContractId == notice.EntityId && c.Customer.Status == "ACTIVE")
            .Select(c => new { c.ContractId, c.ReservationId, c.CustomerId, c.Customer.Email, c.Customer.FullName,
                c.EndDate, c.StartDate, c.Status, c.Unit.UnitNumber, Facility = c.Unit.Facility.Name })
            .SingleOrDefaultAsync(ct);

        if (contract is null || !MailboxAddress.TryParse(contract.Email, out _))
        {
            await SaveResultAsync(notice, Skipped, "NO_ACTIVE_RECIPIENT", ct);
            return;
        }

        var code = ContractCode(contract.StartDate, contract.ContractId);
        string subject;
        MimeEntity body;
        if (notice.Action == ContractQueued)
        {
            var document = await ContractDocuments.LoadAsync(db, contract.CustomerId, contract.ContractId, ct);
            if (document is null)
            {
                await SaveResultAsync(notice, Skipped, "CONTRACT_UNAVAILABLE", ct);
                return;
            }
            var payment = await db.Reservations.AsNoTracking().Where(r => r.ReservationId == contract.ReservationId)
                .Select(r => new { r.ReservationId, r.CreatedAt, r.PaidAt, r.PaymentMethod, Amount = r.EstimatedAmount + r.RequiredDeposit })
                .SingleOrDefaultAsync(ct);
            subject = $"SafeSpace — Xác nhận thanh toán và hợp đồng {document.Code}";
            var rows = new List<(string, string)>();
            if (payment?.PaidAt is DateTime paidAt)
                rows.AddRange(PaymentRows(payment.ReservationId, payment.CreatedAt, paidAt, payment.PaymentMethod, payment.Amount));
            rows.AddRange(
            [
                ("Hợp đồng", document.Code), ("Cơ sở", document.Facility), ("Ô kho", $"{document.Unit} · {document.UnitType}"),
                ("Kỳ thuê", $"{ContractDocument.Date(document.StartDate)} – {ContractDocument.Date(document.EndDate)}"),
                ("Tiền thuê", $"{ContractDocument.Money(document.Rent)} / tháng"), ("Tiền cọc", ContractDocument.Money(document.Deposit))
            ]);
            var builder = Compose(contract.FullName,
                payment?.PaidAt is null
                    ? $"Hợp đồng thuê kho {document.Code} của bạn đã được phát hành."
                    : $"SafeSpace đã nhận đủ thanh toán và phát hành hợp đồng thuê kho {document.Code} cho bạn.",
                rows,
                "Bạn xem và tải hợp đồng giấy (PDF) bất cứ lúc nào trong ứng dụng SafeSpace: Kho của tôi → Xem hợp đồng → Xem hợp đồng giấy. Mã QR/PIN mở cửa có trong ứng dụng từ ngày bắt đầu thuê; chìa khoá vật lý nhận tại quầy sau khi xác minh.",
                LinkTo("Xem hợp đồng giấy", FrontendLink($"units/{code}/contract")));
            body = builder.ToMessageBody();
        }
        else if (notice.Action == RenewalReminderQueued)
        {
            var today = OpsRules.TodayLocal;
            if (Period(contract.EndDate) != notice.OldValue || !await EligibleForReminder(db, today)
                .AnyAsync(c => c.ContractId == contract.ContractId && c.EndDate == contract.EndDate, ct))
            {
                await SaveResultAsync(notice, Skipped, "RENEWAL_REMINDER_OUTDATED", ct);
                return;
            }
            subject = $"SafeSpace — Hợp đồng {code} sắp hết hạn";
            body = Compose(contract.FullName,
                $"Hợp đồng {code} sẽ hết hạn vào ngày {ContractDocument.Date(contract.EndDate)} (còn {contract.EndDate.DayNumber - today.DayNumber} ngày).",
                [("Hợp đồng", code), ("Cơ sở", contract.Facility), ("Ô kho", contract.UnitNumber),
                 ("Hạn thuê", ContractDocument.Date(contract.EndDate))],
                "Nếu muốn tiếp tục thuê, hãy mở Kho của tôi và chọn Gia hạn trước ngày hết hạn. Nếu không thuê tiếp, bạn có thể gửi yêu cầu trả kho trong cùng màn hình.",
                LinkTo("Gia hạn hoặc trả kho", FrontendLink($"units/{code}"))).ToMessageBody();
        }
        else
        {
            var overdue = JsonSerializer.Deserialize<OverdueEmailDetails>(notice.NewValue ?? "null");
            if (overdue is null || contract.Status != "OVERDUE" || contract.EndDate != overdue.EndDate)
            {
                await SaveResultAsync(notice, Skipped, "OVERDUE_PERIOD_CHANGED", ct);
                return;
            }
            subject = $"SafeSpace — Hợp đồng {code} đã quá hạn";
            body = Compose(contract.FullName,
                $"Hợp đồng {code} đã quá hạn từ ngày {ContractDocument.Date(overdue.EndDate)}.",
                [("Hợp đồng", code), ("Cơ sở", contract.Facility), ("Ô kho", contract.UnitNumber),
                 ("Hạn thuê", ContractDocument.Date(overdue.EndDate)), ("Số ngày quá hạn", overdue.Days.ToString(CultureInfo.InvariantCulture)),
                 ("Khấu trừ quá hạn tạm tính", ContractDocument.Money(overdue.Deduction))],
                "Vào Kho của tôi để xem số liệu mới nhất. Hãy gia hạn nếu hợp đồng còn đủ điều kiện, gửi yêu cầu trả kho hoặc liên hệ cơ sở để được hướng dẫn.",
                LinkTo("Xem hợp đồng", FrontendLink($"units/{code}"))).ToMessageBody();
        }

        await DeliverAsync(notice, contract.Email, subject, body, ct);
    }

    private async Task SendPaymentReceiptAsync(ActivityLog notice, CancellationToken ct)
    {
        var payment = await db.Reservations.AsNoTracking()
            .Where(r => r.ReservationId == notice.EntityId && r.PaidAt != null && r.Customer.Status == "ACTIVE"
                && r.Status != "CANCELLED" && r.Status != "EXPIRED"
                && (r.RentalContract == null || r.RentalContract.Status == "DRAFT"))
            .Select(r => new { r.ReservationId, r.CreatedAt, r.PaidAt, r.PaymentMethod,
                r.Customer.Email, r.Customer.FullName, Facility = r.Facility.Name, Amount = r.EstimatedAmount + r.RequiredDeposit })
            .SingleOrDefaultAsync(ct);
        if (payment?.PaidAt is not DateTime paidAt || !MailboxAddress.TryParse(payment.Email, out _))
        {
            await SaveResultAsync(notice, Skipped, "NO_ACTIVE_PAID_RESERVATION", ct);
            return;
        }
        var code = ReservationCode(payment.ReservationId, payment.CreatedAt);
        var rows = PaymentRows(payment.ReservationId, payment.CreatedAt, paidAt, payment.PaymentMethod, payment.Amount).ToList();
        rows.Insert(1, ("Cơ sở", payment.Facility));
        var body = Compose(payment.FullName, $"SafeSpace đã nhận thanh toán cho đơn {code}.", rows,
            "Cơ sở đang bố trí ô kho cho bạn. SafeSpace sẽ gửi hợp đồng ngay khi ô kho được phân bổ, bạn không cần thanh toán lại.",
            LinkTo("Xem đơn đặt chỗ", FrontendLink("reservations"))).ToMessageBody();
        await DeliverAsync(notice, payment.Email, $"SafeSpace — Xác nhận đã nhận tiền {code}", body, ct);
    }

    private static string ContractCode(DateOnly start, long id) => $"HĐ-{start.Year:D4}-{id:D4}";

    private static string ReservationCode(long id, DateTime createdAt) =>
        $"SS-{createdAt.AddHours(7).ToString("yyyyMMdd", CultureInfo.InvariantCulture)}-{id:D4}";

    private static IEnumerable<(string Label, string Value)> PaymentRows(long id, DateTime createdAt, DateTime paidAt,
        string method, decimal amount)
    {
        yield return ("Đơn đặt chỗ", ReservationCode(id, createdAt));
        yield return ("Số tiền", ContractDocument.Money(amount));
        yield return ("Hình thức", method == "AT_FACILITY" ? "Tại quầy" : "Trực tuyến qua PayOS");
        yield return ("Thời điểm", $"{paidAt.AddHours(7).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)} (giờ Việt Nam)");
    }

    /// <summary>
    /// Link mở đúng màn trong ứng dụng. Trả null khi web chạy ở localhost: khách mở thư trên máy khác
    /// (điện thoại) không vào được, nên thư không hiện nút mà hướng dẫn mở tệp đính kèm.
    /// </summary>
    private string? FrontendLink(string route)
    {
        var frontend = configuration?["AppSettings:FrontendUrl"] ?? configuration?["Frontend:BaseUrl"] ?? "http://localhost:5173";
        if (!Uri.TryCreate(frontend, UriKind.Absolute, out var site) || site.IsLoopback) return null;
        var path = string.Join('/', route.Split('/').Select(part => Uri.EscapeDataString(part)));
        return $"{frontend.TrimEnd('/')}/#/{path}";
    }

    private static (string Text, string Url)? LinkTo(string text, string? url) => url is null ? null : (text, url);

    /// <summary>Thư theo bố cục SafeSpace: bản HTML cho hộp thư hiện đại và bản chữ thường cho mọi hộp thư.</summary>
    internal static BodyBuilder Compose(string? name, string lead, IReadOnlyCollection<(string Label, string Value)> rows,
        string note, (string Text, string Url)? action)
    {
        static string E(string? value) => ContractDocument.Html(value);
        var greeting = string.IsNullOrWhiteSpace(name) ? "Xin chào," : $"Xin chào {name},";

        var text = new StringBuilder().Append(greeting).Append("\n\n").Append(lead).Append("\n\n");
        foreach (var (label, value) in rows) text.Append(label).Append(": ").Append(value).Append('\n');
        text.Append('\n').Append(note).Append("\n\n");
        if (action is { } link) text.Append(link.Text).Append(": ").Append(link.Url).Append("\n\n");
        text.Append("SafeSpace · Hotline ").Append(ContractDocument.Hotline).Append(" (06:00–22:00)");

        var table = string.Concat(rows.Select(row =>
            $"<tr><td style=\"padding:8px 0;color:#5b6b82;width:42%;vertical-align:top\">{E(row.Label)}</td>" +
            $"<td style=\"padding:8px 0;font-weight:600;color:#162843\">{E(row.Value)}</td></tr>"));
        var button = action is { } act
            ? $"<p style=\"margin:20px 0 8px\"><a href=\"{E(act.Url)}\" style=\"display:inline-block;background:#1c64d9;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px\">{E(act.Text)}</a></p>"
            : "";
        var html = $$"""
            <!doctype html><html lang="vi"><body style="margin:0;background:#f3f6fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#162843">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 12px"><tr><td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8f0;border-radius:12px">
            <tr><td style="padding:20px 28px;border-bottom:1px solid #e3e8f0;font-size:20px;font-weight:700;color:#1c64d9">SafeSpace</td></tr>
            <tr><td style="padding:24px 28px 8px;font-size:15px;line-height:1.6">
            <p style="margin:0 0 12px">{{E(greeting)}}</p>
            <p style="margin:0 0 16px">{{E(lead)}}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;border-top:1px solid #e3e8f0;border-bottom:1px solid #e3e8f0">{{table}}</table>
            <p style="margin:16px 0">{{E(note)}}</p>
            {{button}}
            </td></tr>
            <tr><td style="padding:16px 28px 22px;font-size:12px;color:#5b6b82;line-height:1.6">Thư gửi tự động từ SafeSpace, vui lòng không trả lời thư này.<br>Hotline {{ContractDocument.Hotline}} · 06:00–22:00</td></tr>
            </table></td></tr></table></body></html>
            """;
        return new BodyBuilder { TextBody = text.ToString(), HtmlBody = html };
    }

    private async Task DeliverAsync(ActivityLog notice, string email, string subject, MimeEntity body, CancellationToken ct)
    {
        try
        {
            await mail.SendAsync(email, subject, body, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (SmtpNotSentException ex)
        {
            // SMTP chắc chắn chưa nhận thư: hẹn gửi lại, hết lượt thì ghi thất bại.
            var attempts = await db.ActivityLogs.CountAsync(log => log.EntityType == EmailEntity
                && log.EntityId == notice.LogId && log.Action == Attempted, ct);
            logger.LogWarning("SMTP chưa nhận thư SafeSpace {NoticeId} (lần {Attempt}/{Max}). Lý do: {Reason}.",
                notice.LogId, attempts, MaxAttempts, ex.Reason);
            db.ActivityLogs.Add(Result(notice, Deferred, ex.Reason));
            if (attempts >= MaxAttempts) db.ActivityLogs.Add(Result(notice, Failed, ex.Reason));
            await db.SaveChangesAsync(ct);
            return;
        }
        catch (Exception ex)
        {
            logger.LogWarning("SMTP chưa xác nhận thư SafeSpace {NoticeId}. Loại lỗi: {ErrorType}.",
                notice.LogId, ex.GetType().Name);
            await SaveResultAsync(notice, Failed, "SMTP_NOT_CONFIRMED", ct);
            return;
        }

        await SaveResultAsync(notice, Sent, null, ct);
    }

    private static ActivityLog Result(ActivityLog notice, string action, string? reason = null) => new()
    {
        Action = action, EntityType = EmailEntity, EntityId = notice.LogId, LoggedAt = DateTime.UtcNow,
        NewValue = JsonSerializer.Serialize(new { contractId = notice.EntityType == ContractEntity ? notice.EntityId : null,
            reservationId = notice.EntityType == ReservationEntity ? notice.EntityId : null, type = notice.Action, reason })
    };

    private async Task SaveResultAsync(ActivityLog notice, string action, string? reason, CancellationToken ct)
    {
        db.ActivityLogs.Add(Result(notice, action, reason));
        await db.SaveChangesAsync(ct);
    }
}
