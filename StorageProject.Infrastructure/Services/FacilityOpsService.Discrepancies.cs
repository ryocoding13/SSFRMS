using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// M05 · Quản lý đối soát sai lệch (Backlog đối soát).
/// Hỗ trợ:
/// 1. GET /api/ops/discrepancies: Danh sách báo cáo sai lệch đối soát của cơ sở.
/// 2. POST /api/ops/discrepancies/actions (REPORT_DISCREPANCY / RESOLVE_DISCREPANCY).
/// </summary>
public partial class FacilityOpsService
{
    private const string DiscrepancyPrefix = "SL-";

    public async Task<IReadOnlyList<DiscrepancyDto>> GetDiscrepanciesAsync(OpsActor actor, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);

        // Lấy tất cả log sai lệch đối soát (LogAction.PaymentMismatch và REPORT_DISCREPANCY)
        var logs = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.Action == LogAction.PaymentMismatch || l.Action == "REPORT_DISCREPANCY")
            .OrderByDescending(l => l.LoggedAt)
            .ToListAsync(ct);

        var reservationIds = logs
            .Where(l => l.EntityType == LogEntity.Reservation && l.EntityId.HasValue)
            .Select(l => l.EntityId!.Value)
            .Distinct()
            .ToList();

        var reservations = await dbContext.Reservations
            .AsNoTracking()
            .Include(r => r.Customer)
            .Where(r => r.FacilityId == facility.FacilityId && reservationIds.Contains(r.ReservationId))
            .ToDictionaryAsync(r => r.ReservationId, ct);

        // Lấy các log giải quyết sai lệch tương ứng
        var resolveLogs = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(l => l.Action == LogAction.PaymentMismatchResolved || l.Action == "RESOLVE_DISCREPANCY")
            .OrderBy(l => l.LoggedAt)
            .ToListAsync(ct);

        var list = new List<DiscrepancyDto>();
        foreach (var l in logs)
        {
            long facilityId = facility.FacilityId;
            string customer = "Khách hàng";
            string reference = $"SL-{l.LogId:0000}";
            decimal expected = 0;
            decimal actual = 0;

            if (l.EntityType == LogEntity.Reservation && l.EntityId.HasValue && reservations.TryGetValue(l.EntityId.Value, out var res))
            {
                customer = res.Customer.FullName;
                reference = ReservationCode(res);
                expected = res.EstimatedAmount + res.RequiredDeposit;
                facilityId = res.FacilityId;
            }
            else
            {
                // Thử đọc từ payload NewValue
                var parsedRef = Read(l, "reference");
                if (!string.IsNullOrEmpty(parsedRef)) reference = parsedRef;
                var parsedCust = Read(l, "customer");
                if (!string.IsNullOrEmpty(parsedCust)) customer = parsedCust;
                var parsedExp = Read(l, "expected");
                if (!string.IsNullOrEmpty(parsedExp) && decimal.TryParse(parsedExp, NumberStyles.Number, Invariant, out var expVal)) expected = expVal;
                var parsedAct = Read(l, "actual");
                if (!string.IsNullOrEmpty(parsedAct) && decimal.TryParse(parsedAct, NumberStyles.Number, Invariant, out var actVal)) actual = actVal;

                // Nếu không thuộc cơ sở này thì bỏ qua
                var parsedFacId = Read(l, "facilityId");
                if (!string.IsNullOrEmpty(parsedFacId) && long.TryParse(parsedFacId, out var fId) && fId != facility.FacilityId)
                {
                    continue;
                }
            }

            var note = Read(l, "note") ?? "Sai lệch thông tin chuyển khoản";
            var parsedActual = Read(l, "actual");
            if (actual == 0 && !string.IsNullOrEmpty(parsedActual) && decimal.TryParse(parsedActual, NumberStyles.Number, Invariant, out var actParsed))
            {
                actual = actParsed;
            }

            // Kiểm tra đã giải quyết chưa
            var resolved = resolveLogs.LastOrDefault(r =>
                (r.EntityId == l.EntityId && r.EntityType == l.EntityType && r.LoggedAt >= l.LoggedAt) ||
                Read(r, "mismatchLogId") == l.LogId.ToString());

            var isResolved = resolved != null;
            var resolution = resolved != null ? (Read(resolved, "resolution") ?? Read(resolved, "note")) : null;
            var resolvedAt = resolved != null ? resolved.LoggedAt.ToString("O") : null;

            list.Add(new DiscrepancyDto(
                Id: $"SL-{l.LogId:0000}",
                FacilityId: facilityId,
                Customer: customer,
                Reference: reference,
                Expected: expected,
                Actual: actual,
                Note: note,
                Status: isResolved ? "RESOLVED" : "PENDING",
                CreatedAt: l.LoggedAt.ToString("O"),
                Resolution: resolution,
                ResolvedAt: resolvedAt
            ));
        }

        return list.OrderBy(d => d.Status == "PENDING" ? 0 : 1).ThenByDescending(d => d.CreatedAt).ToList();
    }

    public async Task<DiscrepancyDto> HandleDiscrepancyActionAsync(OpsActor actor, DiscrepancyActionRequest request, CancellationToken ct = default)
    {
        var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();
        if (action == "REPORT_DISCREPANCY")
        {
            var facility = await FacilityOfAsync(actor, ct);
            var reference = (request.Reference ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(reference))
            {
                throw new ArgumentException("Vui lòng nhập mã khoản thu.");
            }
            var note = (request.Note ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(note))
            {
                throw new ArgumentException("Vui lòng nhập lý do sai lệch.");
            }

            // Tìm đơn đặt chỗ nếu mã khớp
            Reservation? reservation = null;
            if (reference.StartsWith("SS-", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var reservationId = ParseCode(reference, "SS-", "đơn đặt chỗ");
                    reservation = await dbContext.Reservations
                        .Include(r => r.Customer)
                        .FirstOrDefaultAsync(r => r.ReservationId == reservationId && r.FacilityId == facility.FacilityId, ct);
                }
                catch { }
            }

            var customerName = (request.Customer ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(customerName) && reservation != null)
            {
                customerName = reservation.Customer.FullName;
            }
            if (string.IsNullOrEmpty(customerName)) customerName = "Khách hàng";

            var expected = request.Expected ?? (reservation != null ? reservation.EstimatedAmount + reservation.RequiredDeposit : 0m);
            var actual = request.Actual ?? 0m;
            var now = DateTime.UtcNow;

            var log = new ActivityLog
            {
                UserId = actor.UserId,
                Action = LogAction.PaymentMismatch,
                EntityType = reservation != null ? LogEntity.Reservation : LogEntity.Discrepancy,
                EntityId = reservation?.ReservationId ?? 0,
                NewValue = JsonSerializer.Serialize(new
                {
                    reference,
                    customer = customerName,
                    expected,
                    actual,
                    note,
                    facilityId = facility.FacilityId
                }),
                LoggedAt = now
            };

            dbContext.ActivityLogs.Add(log);
            await dbContext.SaveChangesAsync(ct);

            return new DiscrepancyDto(
                Id: $"SL-{log.LogId:0000}",
                FacilityId: facility.FacilityId,
                Customer: customerName,
                Reference: reference,
                Expected: expected,
                Actual: actual,
                Note: note,
                Status: "PENDING",
                CreatedAt: now.ToString("O")
            );
        }
        else if (action == "RESOLVE_DISCREPANCY")
        {
            RequireManager(actor);
            var facility = await FacilityOfAsync(actor, ct);
            var note = (request.Note ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(note))
            {
                throw new ArgumentException("Nhập kết luận đối soát.");
            }

            var logId = ParseCode(request.Id, DiscrepancyPrefix, "báo cáo sai lệch");
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"discrepancy:{logId}", ct);

            var mismatchLog = await dbContext.ActivityLogs
                .FirstOrDefaultAsync(l => l.LogId == logId, ct)
                ?? throw new KeyNotFoundException($"Không tìm thấy báo cáo sai lệch #{request.Id}.");

            // Kiểm tra đã giải quyết chưa
            var existingResolve = await dbContext.ActivityLogs
                .AnyAsync(l => (l.Action == LogAction.PaymentMismatchResolved || l.Action == "RESOLVE_DISCREPANCY")
                            && ((l.EntityId == mismatchLog.EntityId && l.EntityType == mismatchLog.EntityType && l.LoggedAt >= mismatchLog.LoggedAt)
                                || (l.NewValue != null && l.NewValue.Contains($"\"mismatchLogId\":{logId}"))), ct);

            if (existingResolve)
            {
                throw new InvalidOperationException("Báo cáo đã được xử lý. Hãy tải lại danh sách.");
            }

            var now = DateTime.UtcNow;
            dbContext.ActivityLogs.Add(new ActivityLog
            {
                UserId = actor.UserId,
                Action = LogAction.PaymentMismatchResolved,
                EntityType = mismatchLog.EntityType,
                EntityId = mismatchLog.EntityId,
                NewValue = JsonSerializer.Serialize(new
                {
                    mismatchLogId = logId,
                    resolution = note,
                    note
                }),
                LoggedAt = now
            });

            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            // Tái dựng DTO kết quả
            var reference = Read(mismatchLog, "reference") ?? $"SL-{logId:0000}";
            var customer = Read(mismatchLog, "customer") ?? "Khách hàng";
            decimal expected = 0;
            decimal actual = 0;
            if (mismatchLog.EntityType == LogEntity.Reservation && mismatchLog.EntityId.HasValue)
            {
                var res = await dbContext.Reservations.Include(r => r.Customer).FirstOrDefaultAsync(r => r.ReservationId == mismatchLog.EntityId.Value, ct);
                if (res != null)
                {
                    customer = res.Customer.FullName;
                    reference = ReservationCode(res);
                    expected = res.EstimatedAmount + res.RequiredDeposit;
                }
            }
            if (expected == 0 && decimal.TryParse(Read(mismatchLog, "expected"), NumberStyles.Number, Invariant, out var expVal)) expected = expVal;
            if (decimal.TryParse(Read(mismatchLog, "actual"), NumberStyles.Number, Invariant, out var actVal)) actual = actVal;

            return new DiscrepancyDto(
                Id: $"SL-{logId:0000}",
                FacilityId: facility.FacilityId,
                Customer: customer,
                Reference: reference,
                Expected: expected,
                Actual: actual,
                Note: Read(mismatchLog, "note") ?? "",
                Status: "RESOLVED",
                CreatedAt: mismatchLog.LoggedAt.ToString("O"),
                Resolution: note,
                ResolvedAt: now.ToString("O")
            );
        }
        else
        {
            throw new ArgumentException("Thao tác đối soát sai lệch không hợp lệ.");
        }
    }
}
