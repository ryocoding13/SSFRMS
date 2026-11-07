using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// M01 / C09 · Một đường duyệt gia hạn duy nhất cho /api/ops, /api/manager và RenewalService.
/// Khoá hợp đồng trước, rồi mới đọc lại và kiểm: trạng thái, kỳ thuê chưa đổi, hạn duyệt, ô đã có khách đặt (D41),
/// giá ACTIVE tại ngày duyệt. Duyệt không đổi EndDate; khách trả đủ mới kéo dài (RenewalSettlement).
/// </summary>
public static class RenewalApproval
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    public static async Task<(ContractRenewal Renewal, Payment Payment)> ApproveAsync(
        AppDbContext db, long userId, long renewalId, long facilityId, CancellationToken ct)
    {
        var contractId = await db.ContractRenewals.AsNoTracking()
            .Where(r => r.RenewalId == renewalId && r.Contract.Unit.FacilityId == facilityId)
            .Select(r => (long?)r.ContractId)
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn tại cơ sở của bạn.");

        await using var tx = await CheckoutTransaction.BeginAsync(db, $"contract:{contractId}", ct);

        var renewal = await db.ContractRenewals
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .Include(r => r.Payments)
            .FirstAsync(r => r.RenewalId == renewalId, ct);
        // Đọc lại sau khi khoá: bản đã theo dõi trước đó trong cùng request có thể cũ.
        await db.Entry(renewal).ReloadAsync(ct);
        await db.Entry(renewal.Contract).ReloadAsync(ct);
        var contract = renewal.Contract;

        if (renewal.Status != "PENDING") throw new InvalidOperationException("Yêu cầu này đã được xử lý.");
        if (contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE"))
            throw new InvalidOperationException("Hợp đồng không còn hiệu lực để gia hạn.");
        if (renewal.OldEndDate != contract.EndDate)
            throw new InvalidOperationException("Kỳ thuê của hợp đồng đã thay đổi sau khi khách gửi yêu cầu. Từ chối để khách gửi lại.");
        if (await db.ContractRenewals.AnyAsync(r => r.ContractId == contract.ContractId && r.RenewalId != renewal.RenewalId
                && r.Status == "APPROVED", ct))
            throw new InvalidOperationException("Hợp đồng đang có một yêu cầu gia hạn khác chờ thanh toán.");
        // D46: gia hạn sang ô khác không bị khoá D41 ở ô cũ; kiểm lại ô mới còn trống rồi giữ ô khi duyệt.
        var unitPlan = await RenewalUnitMove.PlanAsync(db, renewal.RenewalId, ct);
        if (unitPlan == null && await UnitAvailability.NextBookingAsync(db, contract, ct) is DateOnly bookedFrom)
            throw new InvalidOperationException($"Ô đã có khách đặt từ {bookedFrom:dd/MM/yyyy} (D41). Từ chối gia hạn hoặc chuyển khách sang ô khác.");

        var now = DateTime.UtcNow;
        // Hạn thanh toán: min(now + 24h, 00:00 ngày hết hạn theo giờ Việt Nam).
        var expiryUtc = renewal.OldEndDate.ToDateTime(TimeOnly.MinValue) - VnOffset;
        var deadline = now.AddHours(24) < expiryUtc ? now.AddHours(24) : expiryUtc;
        if (deadline <= now)
            throw new InvalidOperationException("Đã quá hạn duyệt: hợp đồng hết hạn trước khi khách kịp thanh toán gia hạn.");

        var vnToday = DateOnly.FromDateTime(now + VnOffset);
        var activeRate = await db.RentalRates
            .Where(r => r.FacilityId == contract.Unit.FacilityId && r.UnitTypeId == contract.Unit.UnitTypeId
                     && r.Status == "ACTIVE" && r.EffectiveFrom <= vnToday
                     && (r.EffectiveTo == null || r.EffectiveTo >= vnToday))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
        var newRate = activeRate?.MonthlyRate ?? contract.AgreedMonthlyRate;
        var depositTopUp = 0m;
        if (unitPlan != null)
            (newRate, depositTopUp) = await RenewalUnitMove.HoldAsync(db, userId, renewal, unitPlan, ct);
        renewal.NewMonthlyRate = newRate;
        renewal.RenewalAmount = newRate * renewal.RenewalPeriodMonths;
        renewal.PaymentDeadlineAt = deadline;
        renewal.Status = "APPROVED";
        renewal.ApprovedBy = userId;
        renewal.ApprovedAt = now;
        // EndDate giữ nguyên OldEndDate cho tới khi thanh toán đủ.

        var payment = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL");
        if (payment == null)
        {
            payment = new Payment
            {
                ContractId = contract.ContractId, RenewalId = renewal.RenewalId, PaymentType = "RENEWAL",
                Amount = renewal.RenewalAmount + depositTopUp, Currency = "VND", PaymentMethod = "BANK_TRANSFER",
                DueDate = renewal.OldEndDate, Status = "PENDING", CreatedAt = now, UpdatedAt = now
            };
            db.Payments.Add(payment);
        }
        else
        {
            payment.Amount = renewal.RenewalAmount + depositTopUp; // D46: cọc chênh gộp cùng khoản gia hạn, tách khi thu đủ
            payment.Status = "PENDING";
            payment.UpdatedAt = now;
        }

        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId, EntityType = "RENEWAL", EntityId = renewal.RenewalId, Action = "RENEWAL_APPROVED",
            NewValue = JsonSerializer.Serialize(new
            {
                renewal.RenewalId, contractId = contract.ContractId, amount = renewal.RenewalAmount, depositTopUp,
                paymentDeadlineAt = deadline, newEndDate = renewal.NewEndDate.ToString("yyyy-MM-dd")
            }),
            LoggedAt = now
        });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (renewal, payment);
    }
}
