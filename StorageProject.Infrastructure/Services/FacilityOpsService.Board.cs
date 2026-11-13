using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Cung cấp dữ liệu bảng điều khiển tổng hợp cho nhân viên (S01–S09) và quản lý cơ sở (M01–M08) — GET /api/ops/board.
/// Tập hợp danh sách công việc theo thời gian thực: ô kho, thanh toán chờ đối soát, xác minh nhận kho, kiểm tra trả kho,
/// hỗ trợ khách hàng, phân bổ ô, duyệt gia hạn, xử lý nợ/quá hạn, phân công nhân viên và thống kê doanh thu.
/// </summary>
public partial class FacilityOpsService
{
    /// <summary>
    /// Lấy toàn bộ dữ liệu bảng điều khiển vận hành cơ sở (Board) theo quyền của tài khoản hiện tại.
    /// Nhân viên thấy các mục phục vụ tác nghiệp (S01-S09). Quản lý thấy thêm các mục quản trị và phê duyệt (M01-M08).
    /// </summary>
    /// <param name="actor">Thông tin người dùng vận hành.</param>
    /// <param name="ct">Token hủy không đồng bộ.</param>
    /// <returns>OpsBoardDto chứa đầy đủ các phân hệ nghiệp vụ.</returns>
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
                        && (r.Status == "PENDING_AT_FACILITY" || r.Status == "PENDING_VERIFICATION" || r.Status == "CONFIRMED"
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
            .OrderBy(t => t.CreatedAt) // D40/D42: việc của nhân viên xếp theo thời gian tạo, cũ trước (FIFO)
            .ToListAsync(ct);

        var reservationLogs = await LogsAsync(LogEntity.Reservation, reservations.Select(r => r.ReservationId).ToList(), ct);
        var handoverLogs = await LogsAsync(LogEntity.Handover, contracts.Where(c => c.HandoverRecord != null).Select(c => c.HandoverRecord!.HandoverId).ToList(), ct);
        var returnLogs = await LogsAsync(LogEntity.Return, contracts.SelectMany(c => c.ReturnInspections).Select(i => i.InspectionId).ToList(), ct);
        var ticketLogs = await LogsAsync(LogEntity.Ticket, tickets.Select(t => t.TicketId).ToList(), ct);
        var renewalLogs = await LogsAsync(LogEntity.Renewal, contracts.SelectMany(c => c.ContractRenewals).Select(r => r.RenewalId).ToList(), ct);
        // D46: kế hoạch chuyển ô ghi bằng EntityType "RENEWAL" (RenewalUnitMove), khác LogEntity.Renewal
        var unitMoveLogs = (await LogsAsync("RENEWAL", contracts.SelectMany(c => c.ContractRenewals).Select(r => r.RenewalId).ToList(), ct))
            .Where(l => l.Action == RenewalUnitMove.Requested || l.Action == RenewalUnitMove.Held).ToList();
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

        // #47: Sử dụng theo hợp đồng đang hiệu lực hôm nay; Vận hành theo trạng thái kỹ thuật + sự cố/bảo trì đang mở;
        // Cửa theo nhật ký mô phỏng (ACCESS_SCANNED OPEN / DOOR_CLOSED), không gọi là thiết bị thật.
        var unitIdsOnBoard = units.Select(u => u.UnitId).ToList();
        var openIncidents = await dbContext.FacilityIncidents.AsNoTracking()
            .Where(i => i.FacilityId == fid && OpenIncidentStatuses.Contains(i.Status))
            .Select(i => new { i.OldUnitId, i.CaseCode, i.UpdatedAt }).ToListAsync(ct);
        var maintenanceUnits = (await dbContext.MaintenanceRequests.AsNoTracking()
            .Where(m => unitIdsOnBoard.Contains(m.UnitId) && m.Status != "COMPLETED" && m.Status != "CANCELLED")
            .Select(m => m.UnitId).Distinct().ToListAsync(ct)).ToHashSet();
        var doorByUnit = await DoorStatesAsync(fid, ct);
        var rentedNow = new[] { "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING" };
        var unitDtos = units.Select(u =>
        {
            heldByUnit.TryGetValue(u.UnitId, out var c);
            var holding = contracts.Where(x => x.UnitId == u.UnitId && HeldContractStatuses.Contains(x.Status)).ToList();
            var current = holding.Where(x => rentedNow.Contains(x.Status) && x.StartDate <= today).OrderByDescending(x => x.StartDate).FirstOrDefault();
            var next = holding.Where(x => x.StartDate > today).OrderBy(x => x.StartDate).FirstOrDefault();
            var incident = openIncidents.Where(i => i.OldUnitId == u.UnitId).OrderByDescending(i => i.UpdatedAt).FirstOrDefault();
            var operation = u.Status switch
            {
                "MAINTENANCE" or "OUT_OF_SERVICE" => "MAINTENANCE",
                "INSPECTION" or "UNDER_INSPECTION" => "INSPECTION",
                _ => incident != null || maintenanceUnits.Contains(u.UnitId) ? "MAINTENANCE" : "ACTIVE"
            };
            doorByUnit.TryGetValue(u.UnitNumber, out var door);
            var floor = (u.Floor ?? string.Empty).Replace("Tầng", string.Empty).Trim();
            var shown = current ?? c;
            return new OpsUnitDto(u.UnitNumber, shown?.Customer.FullName, u.UnitType.Area, floor.Length > 0 ? floor : "trệt",
                TypeKey(u.UnitType), UnitState(u), shown?.EndDate,
                Usage: current != null ? "RENTED" : "FREE", Operation: operation,
                Door: door.Open ? "OPEN" : "LOCKED", DoorAt: Local(door.At),
                Contract: shown != null ? ContractCode(shown) : null,
                BookedFrom: current == null ? next?.StartDate : null,
                Incident: incident?.CaseCode,
                Zone: u.Zone, LocationDescription: u.LocationDescription, UnitTypeId: u.UnitTypeId);
        }).ToList();

        // ---- S09 · Đối soát chuyển khoản
        var payments = new List<OpsPaymentDto>();
        foreach (var r in reservations)
        {
            var reported = Last(reservationLogs, r.ReservationId, LogAction.TransferReported);
            var decision = Last(reservationLogs, r.ReservationId, LogAction.PaymentConfirmed, LogAction.PaymentMismatch);
            string status;
            if (r.Status is "PENDING_AT_FACILITY" or "PENDING_VERIFICATION")
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
        payments = payments.OrderBy(p => p.Status == "PENDING" ? 0 : 1).ThenBy(p => p.ReportedAt).ToList(); // FIFO

        // ---- S02 / S03 · Xác minh khách + bàn giao
        var handoverContracts = contracts
            .Where(c => c.HandoverRecord != null
                        && c.HandoverRecord.Status != "CANCELLED"
                        && (c.HandoverRecord.Status != "HANDED_OVER" || c.HandoverRecord.HandoverAt >= now.AddDays(-3)))
            .OrderBy(c => c.HandoverRecord!.CreatedAt) // FIFO theo lúc tạo việc, không theo giờ hẹn
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
            var done = Last(handoverLogs, h.HandoverId, LogAction.HandoverCompleted, "PHYSICAL_KEY_RECEIVED");
            var method = done != null ? Read(done, "method") : h.Status == "HANDED_OVER" ? MethodOf(c.AccessCredentials) : null;
            return new OpsHandoverDto(HandoverCode(h.HandoverId), VerificationCode(h.HandoverId), c.Unit.UnitNumber, c.Customer.FullName,
                h.Status == "HANDED_OVER" ? "DONE" : "WAITING", method, Local(h.HandoverAt));
        }).ToList();

        // ---- S04 · Kiểm tra trả kho
        var inspections = contracts
            .SelectMany(c => c.ReturnInspections.Select(i => (Contract: c, Inspection: i)))
            .Where(x => x.Inspection.Status != "CANCELLED"
                        && (x.Inspection.Status != "COMPLETED" || x.Inspection.InspectedAt >= recent))
            .OrderBy(x => x.Inspection.CreatedAt) // FIFO: khách gửi trả kho trước thì xử lý trước
            .ToList();

        var inspectionIds = inspections.Select(x => x.Inspection.InspectionId).ToList();
        var inspectionPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, inspectionIds, ct);
        var moveOutPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.MoveOut, inspectionIds, ct);
        var deductionPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnDeduction, inspectionIds, ct);
        var overdueAtRequest = new Dictionary<long, decimal>();
        foreach (var (c, i) in inspections)
        {
            overdueAtRequest[i.InspectionId] = await OverdueFeeAtAsync(c, fid, i.CreatedAt, ct);
        }

        var returns = inspections.Select(x =>
        {
            var (c, i) = x;
            var submitted = Last(returnLogs, i.InspectionId, LogAction.ReturnInspected);
            var overdueFee = overdueAtRequest[i.InspectionId];
            var deduction = DeductionStateOf(i, returnLogs.Where(l => l.EntityId == i.InspectionId), now);
            OpsReturnReportDto? report = submitted == null ? null : new OpsReturnReportDto(
                Read(submitted, "items") ?? "", Read(submitted, "walls") ?? "", Read(submitted, "keys") ?? "", Read(submitted, "proposal") ?? "",
                i.DamageFee, i.CleaningFee, i.CleaningRequired, i.DamageItem ?? "", i.FeeReason ?? "", overdueFee,
                PhotosOf(inspectionPhotos, i.InspectionId));
            var damageWorkflowResolved = i.Status == "COMPLETED" && IsDeductionResolved(deduction.Status);
            // #16/#19: có biên bản thì có bảng đối soát; hợp đồng đã chốt (không còn RETURN_PENDING) → số chính thức
            OpsSettlementDto? settlement = null;
            if (i.Status == "COMPLETED")
            {
                var (scenario, input, _) = SettlementInputOf(c, i, overdueFee, overdueFee > 0 ? 1 : 0, now);
                settlement = SettlementDtoOf(c, scenario, input, official: c.Status != "RETURN_PENDING");
            }
            return new OpsReturnDto(ReturnCode(i.InspectionId), ContractCode(c), c.Unit.UnitNumber, c.Customer.FullName,
                LocalOrDate(i.ScheduledAt, c.EndDate), c.DepositAmount, Unpaid(c), i.Status == "COMPLETED" ? "SUBMITTED" : "SCHEDULED",
                report, Local(i.InspectedAt), Utc(i.CreatedAt), overdueFee, DamageWorkflowResolved: damageWorkflowResolved,
                MoveOutPhotos: PhotosOf(moveOutPhotos, i.InspectionId),
                LateInspection: i.Status != "COMPLETED" && now - i.CreatedAt > InspectionSla,
                DeductionStatus: deduction.Status, DeductionDeadlineAt: Local(deduction.DeadlineUtc),
                DeductionPhotos: PhotosOf(deductionPhotos, i.InspectionId),
                Settlement: settlement);
        }).ToList();

        // ---- S05 · Yêu cầu hỗ trợ
        var ticketPhotos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.SupportTicket, tickets.Select(t => t.TicketId).ToList(), ct);
        var ticketDtos = tickets.Select(t =>
        {
            var notes = ticketLogs
                .Where(l => l.EntityId == t.TicketId && l.Action == LogAction.TicketResponse)
                .Select(l => new OpsNoteDto(Read(l, "note") ?? "", Local(l.LoggedAt)!, Read(l, "staff")))
                .ToList();
            var unitCode = t.Unit?.UnitNumber ?? t.Contract?.Unit.UnitNumber ?? "—";
            return new OpsTicketDto(TicketCode(t.TicketId), unitCode, t.Customer.FullName, t.Title, Local(t.CreatedAt)!,
                Local(t.AssignedAt ?? t.CreatedAt)!, TicketState(t), t.AssignedStaffId.HasValue ? StaffCode(t.AssignedStaffId.Value) : null, notes,
                t.Description,
                t.Title == SupportTicketService.KeyPickupTitle ? SupportTicketService.KeyPickupTopic : t.IssueType,
                ticketPhotos.TryGetValue(t.TicketId, out var tp) ? tp : []);
        }).ToList();

        // ---- S09g · Thu tiền gia hạn tại quầy (T04 / D32)
        var counterRenewalsQuery = await dbContext.ContractRenewals
            .AsNoTracking()
            .Include(r => r.Contract).ThenInclude(c => c.Customer)
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .Include(r => r.Payments)
            .Where(r => r.Contract.Unit.FacilityId == fid
                     && (r.Status == "APPROVED" || (r.Status == "PAID" && r.AppliedAt >= recent))
                     && r.Payments.Any(p => p.PaymentType == "RENEWAL" && p.PaymentMethod == "CASH"))
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);

        var counterRenewalDtos = new List<StorageProject.Core.DTOs.Renewal.CounterRenewalDto>();
        foreach (var r in counterRenewalsQuery)
        {
            var p = r.Payments.FirstOrDefault(x => x.PaymentType == "RENEWAL" && x.PaymentMethod == "CASH")
                ?? r.Payments.FirstOrDefault(x => x.PaymentType == "RENEWAL");
            if (p == null) continue;
            if (r.Status == "APPROVED" && r.PaymentDeadlineAt.HasValue && r.PaymentDeadlineAt.Value <= now)
                continue;

            var code = ContractCode(r.Contract);
            counterRenewalDtos.Add(new StorageProject.Core.DTOs.Renewal.CounterRenewalDto(
                Id: $"GHQ-{r.RenewalId:D4}",
                RenewalId: r.RenewalId,
                PaymentId: p.PaymentId,
                ContractId: code,
                ContractCode: code,
                FacilityId: fid,
                Unit: r.Contract.Unit?.UnitNumber ?? "—",
                Customer: r.Contract.Customer?.FullName ?? "—",
                Amount: r.RenewalAmount,
                Months: r.RenewalPeriodMonths,
                PaymentDeadlineAt: r.PaymentDeadlineAt,
                Status: r.Status == "PAID" ? "PAID" : "PENDING"
            ));
        }

        var cashRefundDtos = await GetCashRefundsAsync(actor, ct);
        var depositRefundDtos = await GetDepositRefundsAsync(actor, ct);
        var overdueCaseDtos = await GetOverdueCasesAsync(actor, ct);
        var inquiryDtos = await dbContext.SupportInquiries
            .AsNoTracking()
            .Where(x => x.FacilityId == fid && x.Status != "CLOSED")
            .Select(x => new OpsInquiryDto(x.InquiryId, x.Title, x.Status))
            .ToListAsync(ct);

        if (!actor.IsManager)
        {
            return new OpsBoardDto(new OpsFacilityInfoDto(fid, facility.Name, facility.Address), me, staff, unitDtos,
                payments, verifications, handovers, returns, ticketDtos, null, null, null, null, null, null, counterRenewalDtos,
                cashRefundDtos, depositRefundDtos, null, overdueCaseDtos, inquiryDtos);
        }

        // ---- M05 · Đơn chờ phân bổ ô
        var allocations = new List<OpsAllocationDto>();
        foreach (var r in reservations)
        {
            var allocated = Last(reservationLogs, r.ReservationId, LogAction.UnitAllocated, "CONTRACT_AUTO_ISSUED");
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
                var moveReq = Last(unitMoveLogs, r.RenewalId, RenewalUnitMove.Requested);
                var moveTopUp = Last(unitMoveLogs, r.RenewalId, RenewalUnitMove.Held, RenewalUnitMove.Requested) is { } ml
                                && decimal.TryParse(Read(ml, "topUp"), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var t) ? t : 0m;
                return new OpsRenewalDto(RenewalCode(r.RenewalId), ContractCode(c), c.Customer.FullName, c.Unit.UnitNumber,
                    r.OldEndDate, r.NewEndDate, r.RenewalPeriodMonths, Local(r.RequestedAt)!, status,
                    status == "REJECTED" && rejected != null ? Read(rejected, "reason") : null, Local(r.ApprovedAt),
                    r.NewMonthlyRate, r.RenewalAmount, Local(r.PaymentDeadlineAt),
                    moveReq != null ? Read(moveReq, "targetUnit") : null, moveTopUp);
            })
            .ToList();

        // ---- M07 · Hợp đồng cần xử lý
        var contractDtos = new List<OpsContractDto>();
        foreach (var c in contracts.OrderBy(c => c.EndDate))
        {
            var unpaid = Unpaid(c);
            var latestCompleted = c.ReturnInspections
                .Where(i => i.Status == "COMPLETED")
                .OrderByDescending(i => i.InspectedAt ?? i.CreatedAt)
                .FirstOrDefault();
            var inspectionResolved = latestCompleted != null && IsDeductionResolved(
                DeductionStateOf(latestCompleted, returnLogs.Where(l => l.EntityId == latestCompleted.InspectionId), now).Status);
            var lastRenewal = c.ContractRenewals.OrderByDescending(r => r.RequestedAt).FirstOrDefault();
            string state, due;
            decimal amount = 0;

            if (c.Status == "COMPLETED")
            {
                var refunded = Last(contractLogs, c.ContractId, LogAction.DepositRefunded);
                if (refunded == null) continue;
                state = "CLOSED";
                // D32: không còn công nợ ngoài cọc; hiển thị đúng trạng thái hoàn hai bước.
                var refundPayment = c.Payments.Where(p => p.PaymentType == "REFUND" && p.ReservationId == null)
                    .OrderByDescending(p => p.PaymentId).FirstOrDefault();
                due = refundPayment == null
                    ? "Không có khoản hoàn cọc"
                    : refundPayment.Status == "PAID"
                        ? $"Đã hoàn {Money(refundPayment.Amount)}"
                        : $"Chờ hoàn {Money(refundPayment.Amount)}";
            }
            else if (c.Status == "RETURN_PENDING" && inspectionResolved)
            {
                state = "RETURNED";
                due = $"{Money(unpaid)} · Chờ quản lý xác nhận hoàn cọc";
                amount = unpaid;
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
            assignments.Add(new OpsAssignmentDto($"PC-{HandoverCode(h.HandoverId)}", $"Nhận chìa khóa {c.Unit.UnitNumber} · {c.Customer.FullName}",
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
        var refunds = await ReservationRefundsAsync(fid, recent, ct);
        var unitConflictDtos = await GetUnitConflictsAsync(actor, ct);

        return new OpsBoardDto(new OpsFacilityInfoDto(fid, facility.Name, facility.Address), me, staff, unitDtos,
            payments, verifications, handovers, returns, ticketDtos, allocations, renewals, contractDtos, assignments, revenue, refunds, counterRenewalDtos,
            cashRefundDtos, depositRefundDtos, unitConflictDtos, overdueCaseDtos, inquiryDtos);
    }

    /// <summary>
    /// M08 · Đơn huỷ có khoản hoàn: chờ hoàn, hoặc đã hoàn trong thời gian gần (để đọc lại kết quả sau khi xác nhận).
    /// Phí huỷ = đã thanh toán − số hoàn (D40: 5% cọc). Tài khoản là tài khoản chính chủ khách khai khi huỷ (T08).
    /// </summary>
    private async Task<List<OpsRefundDto>> ReservationRefundsAsync(long facilityId, DateTime recent, CancellationToken ct)
    {
        var rows = await dbContext.Payments
            .AsNoTracking()
            .Include(p => p.Reservation).ThenInclude(r => r.Customer)
            .Where(p => p.PaymentType == "REFUND" && p.ReservationId != null
                        && p.Reservation.FacilityId == facilityId && p.Reservation.Status == "CANCELLED"
                        && (p.Status == "PENDING" || (p.PaidAt != null && p.PaidAt >= recent)))
            .ToListAsync(ct);
        if (rows.Count == 0) return [];

        var reservationIds = rows.Select(p => p.ReservationId!.Value).Distinct().ToList();
        var paid = await dbContext.Payments
            .AsNoTracking()
            .Where(p => p.ReservationId != null && reservationIds.Contains(p.ReservationId.Value) && p.Status == "PAID"
                        && (p.PaymentType == "RENT" || p.PaymentType == "DEPOSIT"))
            .Select(p => new { ReservationId = p.ReservationId!.Value, p.PaymentType, p.Amount })
            .ToListAsync(ct);

        return rows
            .OrderBy(p => p.Status == "PENDING" ? 0 : 1).ThenByDescending(p => p.Reservation.CancelledAt ?? p.CreatedAt)
            .Select(p =>
            {
                var r = p.Reservation;
                var rent = paid.Where(x => x.ReservationId == r.ReservationId && x.PaymentType == "RENT").Sum(x => x.Amount);
                var deposit = paid.Where(x => x.ReservationId == r.ReservationId && x.PaymentType == "DEPOSIT").Sum(x => x.Amount);
                var isPaid = p.Status == "PAID";
                return new OpsRefundDto(ReservationCode(r), r.Customer.FullName, Local(r.CancelledAt ?? p.CreatedAt)!,
                    rent, deposit, rent + deposit, Math.Max(0, rent + deposit - p.Amount), p.Amount,
                    isPaid ? "PAID" : p.Status, isPaid ? Local(p.PaidAt) : null, isPaid ? p.TransactionReference : null,
                    r.RefundBankName, r.RefundAccountNumber, r.RefundAccountHolder,
                    p.PaymentMethod == CashMethod ? CashMethod : "BANK_TRANSFER",
                    p.PaymentMethod == CashMethod ? CashRefundCode(p.PaymentId) : null);
            })
            .ToList();
    }

    /// <summary>
    /// P1 / D32: Phí quá hạn tại thời điểm khách gửi trả kho (dừng tính khi gửi thành công), tối đa bằng cọc.
    /// Dùng chung bộ chọn policy OVERDUE của OpsRules.
    /// </summary>
    private async Task<decimal> OverdueFeeAtAsync(RentalContract c, long facilityId, DateTime requestedUtc, CancellationToken ct)
    {
        var requestedDate = DateOnly.FromDateTime(requestedUtc + VnOffset);
        var calc = await OpsRules.CalculateContractOverdueAsync(dbContext, c, requestedDate, isSettled: false, ct);
        return calc.OverdueFee;
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

    /// <summary>Xác định phương thức truy cập vật lý (thẻ từ CARD, vân tay FINGER, mã PIN).</summary>
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
    private Task<OpsRevenueDto> RevenueAsync(long facilityId, CancellationToken ct)
    {
        var today = VnToday;
        var thisMonth = new DateOnly(today.Year, today.Month, 1);
        return RevenueAsync(facilityId, thisMonth.AddMonths(-5), thisMonth, ct);
    }

    /// <summary>
    /// #58 · Doanh thu của cơ sở trong khoảng tháng đã chọn (GET /api/ops/revenue?from=&amp;to=).
    /// #34: số tiền đầy đủ theo đồng (trước đây làm tròn triệu). Cơ cấu theo loại kho và tiền mặt khách không nhận
    /// tính trên cùng khoảng tháng.
    /// </summary>
    public async Task<OpsRevenueDto> GetRevenueAsync(OpsActor actor, DateOnly fromMonth, DateOnly toMonth, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var first = new DateOnly(fromMonth.Year, fromMonth.Month, 1);
        var last = new DateOnly(toMonth.Year, toMonth.Month, 1);
        var count = OperationsReportService.MonthCount(first, last);
        if (count < 1) throw new ArgumentException("Tháng bắt đầu phải trước hoặc bằng tháng kết thúc.");
        if (count > 24) throw new ArgumentException("Khoảng xem tối đa 24 tháng.");
        return await RevenueAsync(facility.FacilityId, first, last, ct);
    }

    private async Task<OpsRevenueDto> RevenueAsync(long facilityId, DateOnly firstMonth, DateOnly lastMonth, CancellationToken ct)
    {
        var today = VnToday;
        var fromUtc = UtcFromLocal(firstMonth, 0);
        var toUtc = UtcFromLocal(lastMonth.AddMonths(1), 0);
        var monthCount = OperationsReportService.MonthCount(firstMonth, lastMonth);

        var rows = await dbContext.Payments
            .AsNoTracking()
            .Where(p => (p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId) == facilityId
                        && p.PaidAt != null && p.PaidAt >= fromUtc && p.PaidAt < toUtc
                        && (p.Status == "PAID" || p.Status == "REFUNDED" || p.Status == "PARTIALLY_REFUNDED")
                        && p.PaymentType != "DEPOSIT" && p.PaymentType != "REFUND")
            .Select(p => new { p.Amount, p.PaidAt, Cold = p.ContractId != null ? p.Contract.Unit.UnitType.ClimateControlled : p.Reservation.UnitType.ClimateControlled })
            .ToListAsync(ct);

        // #34: tiền đầy đủ theo đồng (không rút gọn triệu), khớp báo cáo Vận hành KD
        static decimal Full(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);

        var months = Enumerable.Range(0, monthCount).Select(i =>
        {
            var m = firstMonth.AddMonths(i);
            var sum = rows.Where(r => { var d = r.PaidAt!.Value + VnOffset; return d.Year == m.Year && d.Month == m.Month; }).Sum(r => r.Amount);
            return new OpsRevenueMonthDto($"Tháng {m.Month}", m.Month, m.Year, Full(sum));
        }).ToList();

        // Cơ cấu theo loại kho trên toàn khoảng đang xem (cùng phạm vi với biểu đồ)
        var byType = new List<OpsRevenueTypeDto>
        {
            new("Kho thường", Full(rows.Where(r => !r.Cold).Sum(r => r.Amount))),
            new("Kho lạnh", Full(rows.Where(r => r.Cold).Sum(r => r.Amount))),
        };

        var forfeited = (await dbContext.Payments.AsNoTracking()
            .Where(p => (p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId) == facilityId
                        && p.PaymentType == "REFUND" && p.Status == "CANCELLED" && p.UpdatedAt >= fromUtc && p.UpdatedAt < toUtc
                        && p.TransactionReference != null && p.TransactionReference.StartsWith("FORFEITED:"))
            .Select(p => p.Amount).ToListAsync(ct)).Sum(); // cộng trong bộ nhớ: SQLite không SUM được decimal

        return new OpsRevenueDto(months, byType, today, Full(forfeited));
    }

    private static bool IsDeductionResolved(string status)
        => status is "NONE" or "AGREED" or "AUTO_AGREED" or "RECHECKED";
}
