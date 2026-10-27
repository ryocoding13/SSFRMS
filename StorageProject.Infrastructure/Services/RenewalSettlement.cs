using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public static class RenewalSettlement
{
    public static async Task<bool> RecordAsync(
        AppDbContext db,
        long contractId,
        long renewalId,
        string paymentMethod,
        string transactionRef,
        long? staffUserId,
        CancellationToken ct)
    {
        var renewal = await db.ContractRenewals
            .Include(r => r.Contract)
            .Include(r => r.Payments)
            .SingleOrDefaultAsync(r => r.RenewalId == renewalId && r.ContractId == contractId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy yêu cầu gia hạn hợp đồng.");

        var contract = renewal.Contract;
        var now = DateTime.UtcNow;

        // 1. Idempotency check
        if (renewal.Status == "PAID" && renewal.AppliedAt != null)
        {
            var existingPaid = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL" && p.Status == "PAID");
            if (existingPaid != null && existingPaid.TransactionReference == transactionRef)
            {
                // Re-delivery of the exact same payment: idempotent success
                return true;
            }

            // A second distinct payment on an already-paid renewal requires manual review
            var detail = JsonSerializer.Serialize(new
            {
                contractId,
                renewalId,
                paymentMethod,
                transactionRef,
                reason = "Giao dịch thanh toán lặp hoặc khác tham chiếu trên gia hạn đã được áp dụng; cần đối soát thủ công."
            });

            if (!await db.ActivityLogs.AnyAsync(l => l.EntityType == "RENEWAL" && l.EntityId == renewalId &&
                l.Action == "PAYMENT_REVIEW_REQUIRED" && l.NewValue == detail, ct))
            {
                db.ActivityLogs.Add(new ActivityLog
                {
                    UserId = staffUserId,
                    EntityType = "RENEWAL",
                    EntityId = renewalId,
                    Action = "PAYMENT_REVIEW_REQUIRED",
                    NewValue = detail,
                    LoggedAt = now
                });
            }

            return false;
        }

        // 2. State & Deadline checks
        if (renewal.Status != "APPROVED")
        {
            throw new InvalidOperationException($"Yêu cầu gia hạn không ở trạng thái 'APPROVED'. Trạng thái hiện tại: {renewal.Status}");
        }

        if (contract.Status is "RETURN_PENDING" or "COMPLETED" or "TERMINATED" or "CANCELLED")
        {
            throw new InvalidOperationException($"Hợp đồng ở trạng thái '{contract.Status}', không thể gia hạn.");
        }

        if (renewal.PaymentDeadlineAt.HasValue && now >= renewal.PaymentDeadlineAt.Value)
        {
            // Payment deadline exceeded: mark renewal EXPIRED, payment FAILED
            renewal.Status = "EXPIRED";
            renewal.ExpiredAt = now;

            var pendingPay = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL" && p.Status == "PENDING");
            if (pendingPay != null)
            {
                pendingPay.Status = "FAILED";
                pendingPay.UpdatedAt = now;
            }

            var reviewDetail = JsonSerializer.Serialize(new
            {
                contractId,
                renewalId,
                paymentMethod,
                transactionRef,
                now,
                deadline = renewal.PaymentDeadlineAt.Value,
                reason = "Tiền về sau khi yêu cầu gia hạn đã hết hạn thanh toán (24 giờ / hết hạn hợp đồng); cần đối soát hoàn tiền thủ công."
            });

            db.ActivityLogs.Add(new ActivityLog
            {
                UserId = staffUserId,
                EntityType = "RENEWAL",
                EntityId = renewalId,
                Action = "PAYMENT_REVIEW_REQUIRED",
                NewValue = reviewDetail,
                LoggedAt = now
            });

            return false;
        }

        // 3. Find or ensure RENEWAL payment
        var payment = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL" && p.Status == "PENDING")
            ?? renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL")
            ?? throw new InvalidOperationException("Không tìm thấy khoản thanh toán gia hạn hợp lệ.");

        // 4. Atomic settlement update
        payment.Status = "PAID";
        payment.PaymentMethod = paymentMethod;
        payment.TransactionReference = transactionRef;
        payment.PaidAt = now;
        payment.UpdatedAt = now;

        renewal.Status = "PAID";
        renewal.AppliedAt = now;

        // Apply new end date exactly once
        contract.EndDate = renewal.NewEndDate;
        if (contract.Status is "EXPIRING" or "OVERDUE")
        {
            contract.Status = "ACTIVE";
        }

        // Mark any pending checkouts as PAID
        var checkouts = await db.PaymentCheckouts
            .Where(c => c.PaymentId == payment.PaymentId && c.Status == "PENDING")
            .ToListAsync(ct);

        foreach (var c in checkouts)
        {
            c.Status = "PAID";
            c.UpdatedAt = now;
        }

        // Audit log
        var logDetail = JsonSerializer.Serialize(new
        {
            contractId,
            renewalId,
            paymentId = payment.PaymentId,
            oldEndDate = renewal.OldEndDate.ToString("yyyy-MM-dd"),
            newEndDate = renewal.NewEndDate.ToString("yyyy-MM-dd"),
            amount = renewal.RenewalAmount,
            paymentMethod,
            transactionRef,
            settledBy = staffUserId
        });

        db.ActivityLogs.Add(new ActivityLog
        {
            UserId = staffUserId,
            EntityType = "RENEWAL",
            EntityId = renewalId,
            Action = "RENEWAL_PAID",
            NewValue = logDetail,
            LoggedAt = now
        });

        return true;
    }
}
