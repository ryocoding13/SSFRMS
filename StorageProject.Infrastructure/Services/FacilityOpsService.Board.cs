using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>GET /api/ops/board — toàn bộ dữ liệu màn S01–S09 (và M01–M08 nếu là quản lý) của cơ sở được phân công.</summary>
public partial class FacilityOpsService
{
    public async Task<OpsBoardDto> GetBoardAsync(OpsActor actor, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var fid = facility.FacilityId;
        var now = NowUtc;
        var today = VnToday;
        var recent = now.AddDays(-RecentDays);

        var staffUsers = await FacilityStaffAsync(fid, ct);
        var staffIds = staffUsers.Select(u => u.UserId).ToHashSet();
        string? StaffOf(long? userId) => userId.HasValue && staffIds.Contains(userId.Value) ? StaffCode(userId.Value) : null;
        var shift = Shift(facility);

        var meUser = await dbContext.Users.AsNoTracking().FirstAsync(u => u.UserId == actor.UserId, ct);
        var me = new OpsStaffDto(StaffCode(meUser.UserId), meUser.FullName, shift);
        var staff = staffUsers.Select(u => new OpsStaffDto(StaffCode(u.UserId), u.FullName, shift)).ToList();

        // ---- Dữ liệu gốc của cơ sở
        var units = await dbContext.StorageUnits
            .AsNoTracking()
            .Include(u => u.UnitType)
            .Where(u => u.FacilityId == fid)
            .OrderBy(u => u.UnitNumber)
            .ToListAsync(ct);

        var contracts = await dbContext.RentalContracts
            .AsNoTracking()
            .AsSplitQuery()
            .Include(c => c.Customer)
            .Include(c => c.Reservation)
            .Include(c => c.Unit).ThenInclude(u => u.UnitType)
            .Include(c => c.HandoverRecord)
            .Include(c => c.ReturnInspections)
            .Include(c => c.ContractRenewals)
            .Include(c => c.Payments)
            .Include(c => c.AccessCredentials)
            .Where(c => c.Unit.FacilityId == fid
                        && (HeldContractStatuses.Contains(c.Status)
                            || (c.Status == "COMPLETED" && c.CompletedAt >= recent)))
            .ToListAsync(ct);

        var reservations = await dbContext.Reservations
            .AsNoTracking()
            .Include(r => r.Customer)
            .Include(r => r.UnitType)
            .Include(r => r.UnitAssignments).ThenInclude(a => a.Unit)
            .Where(r => r.FacilityId == fid
                        && (r.Status == "PENDING_VERIFICATION" || r.Status == "CONFIRMED"
                            || ((r.Status == "UNIT_ASSIGNED" || r.Status == "CHECKED_IN") && r.CreatedAt >= now.AddDays(-60))))
            .ToListAsync(ct);

        var tickets = await dbContext.SupportTickets
            .AsNoTracking()
            .Include(t => t.Customer)
            .Include(t => t.Unit)
            .Include(t => t.Contract).ThenInclude(c => c!.Unit)
            // Code cũ được giữ để đối chiếu.
            // .Where(t => ((t.Unit != null && t.Unit.FacilityId == fid) || (t.Contract != null && t.Contract.Unit.FacilityId == fid))
            // API tương thích cũng xác định cơ sở theo hợp đồng trước khi dùng liên kết ô.
            .Where(t => (t.Contract != null ? t.Contract.Unit.FacilityId == fid : t.Unit != null && t.Unit.FacilityId == fid)
                        && t.Status != "CANCELLED"
                        && ((t.Status != "RESOLVED" && t.Status != "CLOSED")
                            || (t.ClosedAt ?? t.ResolvedAt ?? t.CreatedAt) >= recent))
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var reservationLogs = await LogsAsync(LogEntity.Reservation, reservations.Select(r => r.ReservationId).ToList(), ct);
        var handoverLogs = await LogsAsync(LogEntity.Handover, contracts.Where(c => c.HandoverRecord != null).Select(c => c.HandoverRecord!.HandoverId).ToList(), ct);
        var returnLogs = await LogsAsync(LogEntity.Return, contracts.SelectMany(c => c.ReturnInspections).Select(i => i.InspectionId).ToList(), ct);
        var ticketLogs = await LogsAsync(LogEntity.Ticket, tickets.Select(t => t.TicketId).ToList(), ct);
        var renewalLogs = await LogsAsync(LogEntity.Renewal, contracts.SelectMany(c => c.ContractRenewals).Select(r => r.RenewalId).ToList(), ct);
        var contractLogs = await LogsAsync(LogEntity.Contract, contracts.Select(c => c.ContractId).ToList(), ct);

        ActivityLog? Last(List<ActivityLog> logs, long id, params string[] actions) =>
            logs.LastOrDefault(l => l.EntityId == id && actions.Contains(l.Action));

        // ---- M01/M02 · Ô kho
        var heldByUnit = contracts
            .Where(c => HeldContractStatuses.Contains(c.Status))
            .GroupBy(c => c.UnitId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.CreatedAt).First());

        string UnitState(StorageUnit u)
        {
            heldByUnit.TryGetValue(u.UnitId, out var c);
            switch (u.Status)
            {
                case "AVAILABLE": return "EMPTY";
                case "RESERVED":
                case "ASSIGNED": return "WAITING_HANDOVER";
                case "INSPECTION": return "INSPECTION";
                case "MAINTENANCE":
                case "OUT_OF_SERVICE": return "MAINTENANCE";
            }
            if (c == null) return "ACTIVE";
            if (c.Status == "OVERDUE" || c.EndDate < today) return "OVERDUE";
            if (c.Status == "EXPIRING" || c.EndDate <= today.AddDays(14)) return "EXPIRING";
            return "ACTIVE";
        }

        var unitDtos = units.Select(u =>
        {
            heldByUnit.TryGetValue(u.UnitId, out var c);
            var floor = (u.Floor ?? string.Empty).Replace("Tầng", string.Empty).Trim();
            return new OpsUnitDto(u.UnitNumber, c?.Customer.FullName, u.UnitType.Area, floor.Length > 0 ? floor : "trệt",
                TypeKey(u.UnitType), UnitState(u), c?.EndDate);
        }).ToList();

        // ---- S09 · Đối soát chuyển khoản
        var payments = new List<OpsPaymentDto>();
        foreach (var r in reservations)
        {
            var reported = Last(reservationLogs, r.ReservationId, LogAction.TransferReported);
            var decision = Last(reservationLogs, r.ReservationId, LogAction.PaymentConfirmed, LogAction.PaymentMismatch);
            string status;
            if (r.Status == "PENDING_VERIFICATION")
            {
                status = decision?.Action == LogAction.PaymentMismatch && (reported == null || decision.LoggedAt >= reported.LoggedAt) ? "MISMATCH" : "PENDING";
            }
            else if (decision?.Action == LogAction.PaymentConfirmed && decision.LoggedAt >= now.AddDays(-3))
            {
                status = "CONFIRMED";
            }
            else continue;

            var code = ReservationCode(r);
            payments.Add(new OpsPaymentDto(
                code, r.Customer.FullName, r.EstimatedAmount + r.RequiredDeposit, "Chuyển khoản ngân hàng",
                Local(reported?.LoggedAt ?? r.CreatedAt)!, code, OfferLabel(r.UnitType), r.StartDate, r.ExpectedEndDate,
                LocalOrDate(r.CheckInAppointmentAt, r.StartDate), status,
                status == "MISMATCH" ? Read(decision!, "note") : null,
                status == "PENDING" ? null : Local(decision?.LoggedAt)));
        }
        payments = payments.OrderBy(p => p.Status == "PENDING" ? 0 : 1).ThenByDescending(p => p.ReportedAt).ToList();

        // ---- S02 / S03 · Xác minh khách + bàn giao
        var handoverContracts = contracts
            .Where(c => c.HandoverRecord != null
                        && c.HandoverRecord.Status != "CANCELLED"
                        && (c.HandoverRecord.Status != "HANDED_OVER" || c.HandoverRecord.HandoverAt >= now.AddDays(-3)))
            .OrderBy(c => c.HandoverRecord!.ScheduledAt)
            .ToList();

        var verifications = handoverContracts.Select(c =>
        {
            var h = c.HandoverRecord!;
            var verified = Last(handoverLogs, h.HandoverId, LogAction.CustomerVerified);
            return new OpsVerificationDto(
                VerificationCode(h.HandoverId), ReservationCode(c.Reservation), c.Customer.FullName, c.Unit.UnitNumber,
                LocalOrDate(h.ScheduledAt, c.StartDate), h.Status == "SCHEDULED" ? "TODO" : "DONE",
                verified != null ? Read(verified, "docType") : null,
                verified != null ? Read(verified, "docLast4") : null,
                Local(h.VerifiedAt));
        }).ToList();

        var handovers = handoverContracts.Select(c =>
        {
            var h = c.HandoverRecord!;
            var done = Last(handoverLogs, h.HandoverId, LogAction.HandoverCompleted);
            var method = done != null ? Read(done, "method") : h.Status == "HANDED_OVER" ? MethodOf(c.AccessCredentials) : null;
            return new OpsHandoverDto(HandoverCode(h.HandoverId), VerificationCode(h.HandoverId), c.Unit.UnitNumber, c.Customer.FullName,
                h.Status == "HANDED_OVER" ? "DONE" : "WAITING", method, Local(h.HandoverAt));
        }).ToList();

        // ---- S04 · Kiểm tra trả kho
        var inspections = contracts
            .SelectMany(c => c.ReturnInspections.Select(i => (Contract: c, Inspection: i)))
            .Where(x => x.Inspection.Status != "CANCELLED"
                        && (x.Inspection.Status != "COMPLETED" || x.Inspection.InspectedAt >= recent))
            .OrderBy(x => x.Inspection.ScheduledAt)
            .ToList();

        var returns = inspections.Select(x =>
        {
            var (c, i) = x;
            var submitted = Last(returnLogs, i.InspectionId, LogAction.ReturnInspected);
            OpsReturnReportDto? report = submitted == null ? null : new OpsReturnReportDto(
                Read(submitted, "items") ?? "", Read(submitted, "walls") ?? "", Read(submitted, "keys") ?? "", Read(submitted, "proposal") ?? "");
            return new OpsReturnDto(ReturnCode(i.InspectionId), ContractCode(c), c.Unit.UnitNumber, c.Customer.FullName,
                LocalOrDate(i.ScheduledAt, c.EndDate), c.DepositAmount, Unpaid(c), i.Status == "COMPLETED" ? "SUBMITTED" : "SCHEDULED",
                report, Local(i.InspectedAt));
        }).ToList();

        // ---- S05 · Yêu cầu hỗ trợ
        var ticketDtos = tickets.Select(t =>
        {
            var notes = ticketLogs
                .Where(l => l.EntityId == t.TicketId && l.Action == LogAction.TicketResponse)
                .Select(l => new OpsNoteDto(Read(l, "note") ?? "", Local(l.LoggedAt)!, Read(l, "staff")))
                .ToList();
            var unitCode = t.Unit?.UnitNumber ?? t.Contract?.Unit.UnitNumber ?? "—";
            return new OpsTicketDto(TicketCode(t.TicketId), unitCode, t.Customer.FullName, t.Title, Local(t.CreatedAt)!,
                Local(t.AssignedAt ?? t.CreatedAt)!, TicketState(t), t.AssignedStaffId.HasValue ? StaffCode(t.AssignedStaffId.Value) : null, notes);
        }).ToList();

        if (!actor.IsManager)
        {
            return new OpsBoardDto(new OpsFacilityInfoDto(fid, facility.Name, facility.Address), me, staff, unitDtos,
                payments, verifications, handovers, returns, ticketDtos, null, null, null, null, null);
        }

        // ---- M05 · Đơn chờ phân bổ ô
        var allocations = new List<OpsAllocationDto>();
        foreach (var r in reservations)
        {
            var allocated = Last(reservationLogs, r.ReservationId, LogAction.UnitAllocated);
            string status;
            string? unit = null;
            if (r.Status == "CONFIRMED" && !r.UnitAssignments.Any(a => a.Status == "ACTIVE")) status = "PENDING";
            else if (r.Status == "UNIT_ASSIGNED" && allocated != null && allocated.LoggedAt >= now.AddDays(-3))
            {
                status = "DONE";
                unit = r.UnitAssignments.Where(a => a.Status == "ACTIVE").OrderByDescending(a => a.AssignedAt).FirstOrDefault()?.Unit.UnitNumber;
            }
            else continue;
            allocations.Add(new OpsAllocationDto(ReservationCode(r), r.Customer.FullName, TypeKey(r.UnitType), OfferLabel(r.UnitType),
                r.UnitType.Area, r.UnitType.Area, r.StartDate, r.ExpectedEndDate, LocalOrDate(r.CheckInAppointmentAt, r.StartDate), status, unit));
        }
        allocations = allocations.OrderBy(a => a.Status == "PENDING" ? 0 : 1).ThenBy(a => a.Start).ToList();

        // ---- M03 · Gia hạn
        var renewals = contracts
            .SelectMany(c => c.ContractRenewals.Select(r => (Contract: c, Renewal: r)))
            .Where(x => x.Renewal.Status == "PENDING" || (x.Renewal.ApprovedAt.HasValue && x.Renewal.ApprovedAt >= recent))
            .OrderBy(x => x.Renewal.Status == "PENDING" ? 0 : 1).ThenBy(x => x.Renewal.RequestedAt)
            .Select(x =>
            {
                var (c, r) = x;
                var rejected = Last(renewalLogs, r.RenewalId, LogAction.RenewalRejected);
                var status = r.Status switch { "PAID" => "APPROVED", "CANCELLED" => "REJECTED", _ => r.Status };
                return new OpsRenewalDto(RenewalCode(r.RenewalId), ContractCode(c), c.Customer.FullName, c.Unit.UnitNumber,
                    r.OldEndDate, r.NewEndDate, r.RenewalPeriodMonths, Local(r.RequestedAt)!, status,
                    status == "REJECTED" && rejected != null ? Read(rejected, "reason") : null, Local(r.ApprovedAt));
            })
            .ToList();

        // ---- M07 · Hợp đồng cần xử lý
        var contractDtos = new List<OpsContractDto>();
        foreach (var c in contracts.OrderBy(c => c.EndDate))
        {
            var unpaid = Unpaid(c);
            var inspected = c.ReturnInspections.Any(i => i.Status == "COMPLETED");
            var lastRenewal = c.ContractRenewals.OrderByDescending(r => r.RequestedAt).FirstOrDefault();
            string state, due;
            decimal amount = 0;

            if (c.Status == "COMPLETED")
            {
                var refunded = Last(contractLogs, c.ContractId, LogAction.DepositRefunded);
                if (refunded == null) continue;
                state = "CLOSED";
                due = $"Hoàn cọc {Money(decimal.TryParse(Read(refunded, "refund"), System.Globalization.NumberStyles.Number, Invariant, out var rf) ? rf : 0)} sau khi trừ khoản còn nợ";
            }
            else if (c.Status == "RETURN_PENDING" && inspected)
            {
                state = "RETURNED";
                due = $"{Money(unpaid)} · Chờ quản lý xác nhận hoàn cọc";
                amount = unpaid;
            }
            else if (lastRenewal?.Status == "PENDING")
            {
                state = "RENEWAL";
                due = "Yêu cầu gia hạn";
            }
            else if (c.Status == "OVERDUE" || (c.Status is "ACTIVE" or "EXPIRING" && c.EndDate < today))
            {
                state = "OVERDUE";
                due = unpaid > 0 ? "Tiền thuê kỳ mới · Chưa thanh toán" : "Đã hết hạn · Chưa gia hạn hoặc trả kho";
                amount = unpaid;
            }
            else if (lastRenewal is { ApprovedAt: not null } && lastRenewal.ApprovedAt >= recent)
            {
                state = "RESOLVED";
                var reason = Read(Last(renewalLogs, lastRenewal.RenewalId, LogAction.RenewalRejected) ?? new ActivityLog(), "reason");
                due = lastRenewal.Status == "REJECTED"
                    ? $"Từ chối gia hạn · {reason}"
                    : $"Đã duyệt gia hạn đến {lastRenewal.NewEndDate:dd/MM/yyyy}";
            }
            else continue;

            var reminders = contractLogs
                .Where(l => l.EntityId == c.ContractId && l.Action == LogAction.OverdueReminder)
                .Select(l => new OpsReminderDto(Read(l, "note") ?? "", Local(l.LoggedAt)!))
                .ToList();
            contractDtos.Add(new OpsContractDto(ContractCode(c), c.Customer.FullName, c.Unit.UnitNumber, c.EndDate, due, amount, state, reminders));
        }

        // ---- M06 · Phân công công việc
        var assignments = new List<OpsAssignmentDto>();
        foreach (var c in handoverContracts)
        {
            var h = c.HandoverRecord!;
            var done = h.Status == "HANDED_OVER";
            var who = StaffOf(h.StaffId);
            assignments.Add(new OpsAssignmentDto($"PC-{HandoverCode(h.HandoverId)}", $"Bàn giao {c.Unit.UnitNumber} · {c.Customer.FullName}",
                LocalOrDate(h.ScheduledAt, c.StartDate), who, done ? "DONE" : who == null ? "OPEN" : h.Status == "VERIFIED" ? "ACCEPTED" : "WAITING",
                HandoverCode(h.HandoverId)));
        }
        foreach (var (c, i) in inspections)
        {
            var who = StaffOf(i.StaffId);
            assignments.Add(new OpsAssignmentDto($"PC-{ReturnCode(i.InspectionId)}", $"Kiểm tra trả kho {c.Unit.UnitNumber} · {c.Customer.FullName}",
                LocalOrDate(i.ScheduledAt, c.EndDate), who, i.Status == "COMPLETED" ? "DONE" : who == null ? "OPEN" : i.Status == "IN_PROGRESS" ? "ACCEPTED" : "WAITING",
                ReturnCode(i.InspectionId)));
        }
        foreach (var t in tickets)
        {
            var who = StaffOf(t.AssignedStaffId);
            var state = TicketState(t);
            assignments.Add(new OpsAssignmentDto($"PC-{TicketCode(t.TicketId)}", $"{TicketCode(t.TicketId)} · {t.Title}",
                Local(t.AssignedAt ?? t.CreatedAt), who,
                state == "DONE" || state == "WAITING_CUSTOMER" ? "DONE" : who == null ? "OPEN" : state == "IN_PROGRESS" && t.Status == "IN_PROGRESS" ? "ACCEPTED" : "WAITING",
                TicketCode(t.TicketId)));
        }
        assignments = assignments.OrderBy(a => a.Status == "DONE" ? 1 : 0).ThenBy(a => a.When).ToList();

        var revenue = await RevenueAsync(fid, ct);

        return new OpsBoardDto(new OpsFacilityInfoDto(fid, facility.Name, facility.Address), me, staff, unitDtos,
            payments, verifications, handovers, returns, ticketDtos, allocations, renewals, contractDtos, assignments, revenue);
    }

    /// <summary>
    /// Trạng thái hỗ trợ theo giao diện: OPEN (chưa phân công) · IN_PROGRESS · WAITING_CUSTOMER (đã xử lý, chờ khách xác nhận) · DONE.
    /// </summary>
    private static string TicketState(SupportTicket t) => t.Status switch
    {
        "OPEN" => t.AssignedStaffId.HasValue ? "IN_PROGRESS" : "OPEN",
        "ASSIGNED" or "IN_PROGRESS" => "IN_PROGRESS",
        "RESOLVED" => "WAITING_CUSTOMER",
        _ => "DONE",
    };

    private static string? MethodOf(IEnumerable<AccessCredential> credentials)
    {
        var cred = credentials.OrderByDescending(a => a.IssuedAt).FirstOrDefault();
        if (cred == null) return null;
        if (cred.CredentialType == "ACCESS_CARD") return "CARD";
        return (cred.CredentialReference ?? string.Empty).StartsWith("FINGER", StringComparison.Ordinal) ? "FINGER" : "PIN";
    }

    /// <summary>
    /// M04 · Doanh thu thuê và phí 6 tháng gần nhất (triệu đồng, theo ngày thu giờ Việt Nam) — không gồm tiền cọc
    /// và hoàn tiền (cùng định nghĩa "rentalAndFeeRevenue" của báo cáo Vận hành KD, SRS 10.2).
    /// Cơ cấu theo loại kho là của tháng hiện tại.
    /// </summary>
    private async Task<OpsRevenueDto> RevenueAsync(long facilityId, CancellationToken ct)
    {
        var today = VnToday;
        var firstMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(-5);
        var fromUtc = UtcFromLocal(firstMonth, 0);

        var rows = await dbContext.Payments
            .AsNoTracking()
            .Where(p => (p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId) == facilityId
                        && p.PaidAt != null && p.PaidAt >= fromUtc
                        && (p.Status == "PAID" || p.Status == "REFUNDED" || p.Status == "PARTIALLY_REFUNDED")
                        && p.PaymentType != "DEPOSIT" && p.PaymentType != "REFUND")
            .Select(p => new { p.Amount, p.PaidAt, Cold = p.ContractId != null ? p.Contract.Unit.UnitType.ClimateControlled : p.Reservation.UnitType.ClimateControlled })
            .ToListAsync(ct);

        static decimal Million(decimal v) => Math.Round(v / 1_000_000m, 1, MidpointRounding.AwayFromZero);

        var months = Enumerable.Range(0, 6).Select(i =>
        {
            var m = firstMonth.AddMonths(i);
            var sum = rows.Where(r => { var d = r.PaidAt!.Value + VnOffset; return d.Year == m.Year && d.Month == m.Month; }).Sum(r => r.Amount);
            return new OpsRevenueMonthDto($"Tháng {m.Month}", m.Month, m.Year, Million(sum));
        }).ToList();

        var current = rows.Where(r => { var d = r.PaidAt!.Value + VnOffset; return d.Year == today.Year && d.Month == today.Month; }).ToList();
        var byType = new List<OpsRevenueTypeDto>
        {
            new("Kho thường", Million(current.Where(r => !r.Cold).Sum(r => r.Amount))),
            new("Kho lạnh", Million(current.Where(r => r.Cold).Sum(r => r.Amount))),
        };

        return new OpsRevenueDto(months, byType, today);
    }
}
