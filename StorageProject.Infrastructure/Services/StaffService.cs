using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class StaffService(AppDbContext dbContext) : IStaffService
{
    public async Task<OpsBoardDto> GetStaffBoardAsync(long userId, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var user = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId, ct);

        var meDto = user != null ? new OpsUserInfoDto
        {
            UserId = user.UserId,
            Username = user.Username,
            FullName = user.FullName,
            Role = "STAFF",
            StaffId = $"NV-{user.UserId:D2}"
        } : null;

        // 1. Staff assigned to this facility
        var staffList = await dbContext.UserFacilities
            .AsNoTracking()
            .Include(uf => uf.User)
            .Where(uf => uf.FacilityId == fac.FacilityId && uf.Status == "ACTIVE")
            .Select(uf => new OpsStaffDto
            {
                StaffId = $"NV-{uf.User.UserId:D2}",
                FullName = uf.User.FullName,
                Shift = "08:00–17:00"
            })
            .ToListAsync(ct);

        if (staffList.Count == 0 && user != null)
        {
            staffList.Add(new OpsStaffDto
            {
                StaffId = $"NV-{user.UserId:D2}",
                FullName = user.FullName,
                Shift = "08:00–17:00"
            });
        }

        // 2. Units of facility from SQL Server
        var storageUnits = await dbContext.StorageUnits
            .AsNoTracking()
            .Include(u => u.UnitType)
            .Where(u => u.FacilityId == fac.FacilityId)
            .OrderBy(u => u.UnitNumber)
            .ToListAsync(ct);

        var activeContracts = await dbContext.RentalContracts
            .AsNoTracking()
            .Include(c => c.Customer)
            .Where(c => c.Unit.FacilityId == fac.FacilityId && (c.Status == "ACTIVE" || c.Status == "RETURN_PENDING"))
            .ToListAsync(ct);
        var contractsByUnit = activeContracts.ToDictionary(c => c.UnitId);

        var activeAssignments = await dbContext.UnitAssignments
            .AsNoTracking()
            .Include(ua => ua.Reservation).ThenInclude(r => r.Customer)
            .Where(ua => ua.Unit.FacilityId == fac.FacilityId && ua.Status == "ACTIVE")
            .ToListAsync(ct);
        var assignmentsByUnit = activeAssignments.ToDictionary(ua => ua.UnitId);

        var unitDtos = storageUnits.Select(u =>
        {
            contractsByUnit.TryGetValue(u.UnitId, out var contract);
            assignmentsByUnit.TryGetValue(u.UnitId, out var assign);

            var tenant = contract?.Customer?.FullName ?? assign?.Reservation?.Customer?.FullName;
            var end = contract != null
                ? contract.EndDate.ToString("yyyy-MM-dd")
                : assign?.Reservation?.ExpectedEndDate.ToString("yyyy-MM-dd");

            var uiStatus = u.Status switch
            {
                "AVAILABLE" => "EMPTY",
                "OCCUPIED" => "ACTIVE",
                "RESERVED" => "WAITING_HANDOVER",
                "MAINTENANCE" => "MAINTENANCE",
                "LOCKED" => "LOCKED",
                _ => u.Status
            };

            int floor = 1;
            var floorStr = u.Floor?.Replace("Tầng", "", StringComparison.OrdinalIgnoreCase).Trim();
            if (int.TryParse(floorStr, out var fl)) floor = fl;

            return new OpsUnitDto
            {
                Code = u.UnitNumber,
                Tenant = tenant,
                Area = u.UnitType.Area,
                Floor = floor,
                Type = u.UnitType.ClimateControlled ? "climate" : "normal",
                Status = uiStatus,
                End = end
            };
        }).ToList();

        // 3. Payments (Đối soát thanh toán từ Reservations trong DB)
        var reservations = await dbContext.Reservations.AsNoTracking().Include(r => r.Customer).Include(r => r.UnitType)
            .Where(r => r.FacilityId == fac.FacilityId && r.PaymentMethod == "AT_FACILITY" &&
                r.Status == "PENDING_AT_FACILITY" && r.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var paymentDtos = reservations.Select(r =>
        {
            var totalAmount = (r.RequiredDeposit > 0 ? r.RequiredDeposit : 0) + r.EstimatedAmount;
            var uiStatus = r.Status switch
            {
                "CONFIRMED" => "CONFIRMED",
                "MISMATCH" => "MISMATCH",
                _ => "PENDING"
            };

            return new OpsPaymentDto
            {
                Id = $"SS-{r.CreatedAt:yyyyMMdd}-{r.ReservationId:D4}",
                Customer = r.Customer.FullName,
                Amount = totalAmount,
                Method = "Thanh toán tại kho",
                ReportedAt = r.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"),
                Memo = r.OrderCode.HasValue ? $"SSFRMS {r.OrderCode}" : $"SSFRMS {r.ReservationId}",
                Offer = $"Kho {r.UnitType.TypeName} · {(r.UnitType.ClimateControlled ? "Kiểm soát nhiệt độ" : "Thường")}",
                Start = r.StartDate.ToString("yyyy-MM-dd"),
                End = r.ExpectedEndDate.ToString("yyyy-MM-dd"),
                Pickup = $"{r.StartDate:yyyy-MM-dd}T09:00:00",
                Status = uiStatus
            };
        }).ToList();

        // 4. Verifications & Handovers từ Reservations & Assignments
        var assignedReservations = await dbContext.Reservations
            .AsNoTracking()
            .Include(r => r.Customer)
            .Include(r => r.UnitAssignments).ThenInclude(ua => ua.Unit)
            .Include(r => r.RentalContract).ThenInclude(c => c!.HandoverRecord)
            .Where(r => r.FacilityId == fac.FacilityId && r.UnitAssignments.Any(ua => ua.Status == "ACTIVE"))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var verificationDtos = assignedReservations.Select(r =>
        {
            var assign = r.UnitAssignments.First(ua => ua.Status == "ACTIVE");
            return new OpsVerificationDto
            {
                Id = $"XM-{r.ReservationId:D4}",
                ReservationId = $"SS-{r.CreatedAt:yyyyMMdd}-{r.ReservationId:D4}",
                Customer = r.Customer.FullName,
                Unit = assign.Unit.UnitNumber,
                Appointment = $"{r.StartDate:yyyy-MM-dd}T09:00:00",
                Status = r.RentalContract?.HandoverRecord?.Status is "VERIFIED" or "HANDED_OVER" ? "DONE" : "TODO",
                DocType = "Căn cước công dân",
                DocLast4 = null,
                VerifiedAt = r.Status == "CHECKED_IN" ? r.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss") : null
            };
        }).ToList();

        var handoverRecords = await dbContext.HandoverRecords
            .AsNoTracking()
            .Include(h => h.Contract).ThenInclude(c => c.Customer)
            .Include(h => h.Contract).ThenInclude(c => c.Unit)
            .Where(h => h.Contract.Unit.FacilityId == fac.FacilityId && h.Status != "CANCELLED")
            .OrderByDescending(h => h.ScheduledAt)
            .ToListAsync(ct);

        var handoverDtos = handoverRecords.Select(h => new OpsHandoverDto
        {
            Id = $"BG-{h.HandoverId:D4}",
            VerificationId = $"XM-{(h.Contract.ReservationId > 0 ? h.Contract.ReservationId : h.HandoverId):D4}",
            Unit = h.Contract.Unit.UnitNumber,
            Customer = h.Contract.Customer.FullName,
            Status = h.HandoverAt.HasValue ? "DONE" : "WAITING",
            Method = "PIN"
        }).ToList();

        foreach (var r in assignedReservations)
        {
            var unitNumber = r.UnitAssignments.First(ua => ua.Status == "ACTIVE").Unit.UnitNumber;
            if (!handoverDtos.Any(h => h.Unit == unitNumber))
            {
                handoverDtos.Add(new OpsHandoverDto
                {
                    Id = $"BG-{r.ReservationId:D4}",
                    VerificationId = $"XM-{r.ReservationId:D4}",
                    Unit = unitNumber,
                    Customer = r.Customer.FullName,
                    Status = r.Status == "CHECKED_IN" ? "COMPLETED" : "WAITING",
                    Method = null
                });
            }
        }

        // 5. Returns
        var returnInspections = await dbContext.ReturnInspections
            .AsNoTracking()
            .Include(ri => ri.Contract).ThenInclude(c => c.Customer)
            .Include(ri => ri.Contract).ThenInclude(c => c.Unit)
            .Where(ri => ri.Contract.Unit.FacilityId == fac.FacilityId)
            .OrderByDescending(ri => ri.CreatedAt)
            .ToListAsync(ct);

        var returnDtos = returnInspections.Select(ri => new OpsReturnDto
        {
            Id = $"TK-{ri.InspectionId:D4}",
            Contract = $"HĐ-{ri.Contract.StartDate:yyyy}-{ri.Contract.ContractId:D4}",
            Unit = ri.Contract.Unit.UnitNumber,
            Customer = ri.Contract.Customer.FullName,
            Appointment = (ri.ScheduledAt ?? ri.CreatedAt).ToString("yyyy-MM-ddTHH:mm:ss"),
            Deposit = ri.Contract.DepositAmount,
            Unpaid = ri.DamageFee + ri.CleaningFee,
            Status = ri.Status,
            Report = ri.InspectedAt.HasValue ? new OpsReturnReportDto
            {
                Items = ri.Notes ?? "Bình thường",
                Walls = ri.ConditionStatus ?? "Sạch sẽ",
                Keys = "Đã thu hồi",
                Proposal = "Hoàn cọc đầy đủ"
            } : null
        }).ToList();

        // Code cũ được giữ để đối chiếu.
        // // 6. Tickets
        // var tickets = await dbContext.SupportTickets
        //     .AsNoTracking()
        //     .Include(t => t.Customer)
        //     .Include(t => t.Unit)
        //     .Include(t => t.AssignedStaff)
        //     .Where(t => t.Unit != null && t.Unit.FacilityId == fac.FacilityId)
        //     .OrderByDescending(t => t.CreatedAt)
        //     .ToListAsync(ct);
        //
        // var ticketDtos = tickets.Select(t => new OpsTicketDto
        // {
        //     Id = $"HT-{t.TicketId:D4}",
        //     Unit = t.Unit?.UnitNumber ?? "KHO",
        //     Customer = t.Customer.FullName,
        //     Title = t.Title,
        //     CreatedAt = t.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"),
        //     Schedule = t.CreatedAt.AddHours(4).ToString("yyyy-MM-ddTHH:mm:ss"),
        //     Status = t.Status,
        //     Assignee = t.AssignedStaff != null ? $"NV-{t.AssignedStaff.UserId:D2}" : null,
        //     Notes = new List<OpsTicketNoteDto>
        //     {
        //         new()
        //         {
        //             Author = t.Customer.FullName,
        //             Content = t.Description,
        //             CreatedAt = t.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss")
        //         }
        //     }
        // }).ToList();
        // S05 đọc ticket theo hợp đồng, trả đúng trạng thái và lịch sử để nhân viên thấy yêu cầu và phản hồi đã ghi.
        // 6. Tickets: hợp đồng xác định cơ sở, kể cả dữ liệu cũ thiếu UnitId trên ticket.
        var tickets = await dbContext.SupportTickets.AsNoTracking()
            .Include(t => t.Customer).Include(t => t.Unit)
            .Include(t => t.Contract).ThenInclude(c => c!.Unit)
            .Where(t => t.Status != "CANCELLED" && (t.Contract != null
                ? t.Contract.Unit.FacilityId == fac.FacilityId
                : t.Unit != null && t.Unit.FacilityId == fac.FacilityId))
            .OrderByDescending(t => t.CreatedAt).ToListAsync(ct);
        var ticketIds = tickets.Select(t => t.TicketId).ToList();
        var ticketLogs = await dbContext.ActivityLogs.AsNoTracking().Include(l => l.User)
            .Where(l => l.EntityType == "SUPPORT_TICKET" && l.Action == "TICKET_RESPONSE"
                && l.EntityId != null && ticketIds.Contains(l.EntityId.Value))
            .OrderBy(l => l.LoggedAt).ThenBy(l => l.LogId).ToListAsync(ct);
        var ticketDtos = tickets.Select(t =>
        {
            var notes = new List<OpsTicketNoteDto>
            {
                new() { Author = t.Customer.FullName, Content = t.Description, CreatedAt = t.CreatedAt.ToString("O") }
            };
            foreach (var log in ticketLogs.Where(l => l.EntityId == t.TicketId))
            {
                if (string.IsNullOrWhiteSpace(log.NewValue)) continue;
                try
                {
                    using var json = System.Text.Json.JsonDocument.Parse(log.NewValue);
                    if (json.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object
                        && json.RootElement.TryGetProperty("note", out var value)
                        && value.ValueKind == System.Text.Json.JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()))
                        notes.Add(new() { Author = log.User?.FullName ?? "Nhân viên cơ sở", Content = value.GetString()!, CreatedAt = log.LoggedAt.ToString("O") });
                }
                catch (System.Text.Json.JsonException) { }
            }
            return new OpsTicketDto
            {
                Id = $"HT-{t.TicketId:D4}", Unit = t.Contract?.Unit.UnitNumber ?? t.Unit?.UnitNumber ?? "KHO",
                Customer = t.Customer.FullName, Title = t.Title, CreatedAt = t.CreatedAt.ToString("O"),
                Schedule = (t.AssignedAt ?? t.CreatedAt).ToString("O"),
                Status = t.Status switch
                {
                    "OPEN" => t.AssignedStaffId.HasValue ? "IN_PROGRESS" : "OPEN",
                    "ASSIGNED" or "IN_PROGRESS" => "IN_PROGRESS",
                    "RESOLVED" => "WAITING_CUSTOMER",
                    _ => "DONE"
                },
                Assignee = t.AssignedStaffId.HasValue ? $"NV-{t.AssignedStaffId.Value:D2}" : null,
                Notes = notes
            };
        }).ToList();

        return new OpsBoardDto
        {
            Facility = new OpsFacilityDto
            {
                FacilityId = fac.FacilityId,
                Name = fac.Name,
                Address = fac.Address
            },
            Me = meDto,
            Staff = staffList,
            Units = unitDtos,
            Payments = paymentDtos,
            Verifications = verificationDtos,
            Handovers = handoverDtos,
            Returns = returnDtos,
            Tickets = ticketDtos
        };
    }

    public async Task ConfirmPaymentAsync(long userId, string id, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var found = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn tại cơ sở.");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{found.ReservationId}", ct);
        await dbContext.Entry(found).ReloadAsync(ct);
        await dbContext.Entry(found).Collection(r => r.UnitAssignments).LoadAsync(ct);
        await dbContext.Entry(found).Reference(r => r.RentalContract).LoadAsync(ct);
        if (found.PaymentMethod != "AT_FACILITY") throw new InvalidOperationException("Đơn PayOS phải được xác nhận qua webhook.");
        if (found.PaidAt != null) { await tx.CommitAsync(ct); return; }
        if (found.Status != "PENDING_AT_FACILITY" || found.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("Đơn không còn chờ thu tại kho hoặc đã hết hạn.");
        await ReservationSettlement.RecordAsync(dbContext, found, "CASH", $"CASH:{found.ReservationId}", userId, ct);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task MismatchPaymentAsync(long userId, string id, MismatchPaymentRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Note))
        {
            throw new ArgumentException("Ghi chú sai lệch không được để trống.");
        }
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var r = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct);
        if (r == null)
        {
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ / thanh toán.");
        }

        r.Status = "MISMATCH";
        r.CancellationReason = request.Note;
        await dbContext.SaveChangesAsync(ct);
    }

    public async Task VerifyCustomerAsync(long userId, string id, VerifyCustomerRequest request, CancellationToken ct = default)
    {
        if (!request.PhotoMatched || !request.InfoMatched)
        {
            throw new ArgumentException("Thông tin đối chiếu không hợp lệ.");
        }
        var docNo = request.DocNumber?.Trim() ?? "";
        if (docNo.Length != 9 && docNo.Length != 12 && !docNo.StartsWith("C") && !docNo.StartsWith("B"))
        {
            throw new ArgumentException("Số giấy tờ không hợp lệ.");
        }
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var r = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct);
        if (r != null)
        {
            await ReservationSettlement.RequirePaidAsync(dbContext, r, ct);
            var record = await dbContext.HandoverRecords.SingleOrDefaultAsync(h => h.Contract.ReservationId == r.ReservationId, ct)
                ?? throw new InvalidOperationException("Đơn chưa được quản lý phân bổ và lập lịch bàn giao.");
            if (record.Status == "HANDED_OVER") return;
            record.Status = "VERIFIED";
            record.Notes = $"Đã xác minh giấy tờ kết thúc {docNo[^4..]}";
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task CompleteHandoverAsync(long userId, string id, CompleteHandoverRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var now = DateTime.UtcNow;

        // 1. Thử tìm theo HandoverId hoặc ContractId
        var handover = await dbContext.HandoverRecords
            .Include(h => h.Contract).ThenInclude(c => c.Unit)
            .Include(h => h.Contract).ThenInclude(c => c.AccessCredentials)
            .Include(h => h.Contract).ThenInclude(c => c.Reservation)
            .FirstOrDefaultAsync(h => h.HandoverId == num && h.Contract.Unit.FacilityId == fac.FacilityId, ct);

        if (handover != null)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{handover.Contract.ReservationId}", ct);
            await dbContext.Entry(handover.Contract.Reservation).ReloadAsync(ct);
            await ReservationSettlement.RequirePaidAsync(dbContext, handover.Contract.Reservation, ct);
            if (handover.Status == "HANDED_OVER") { await tx.CommitAsync(ct); return; }
            if (handover.Status != "VERIFIED") throw new InvalidOperationException("Cần xác minh khách hàng trước khi bàn giao.");
            handover.Status = "HANDED_OVER";
            handover.StaffConfirmed = true;
            handover.CustomerConfirmed = true;
            handover.StaffId = userId;
            handover.HandoverAt = now;
            handover.Notes = $"Phương thức mở khóa: {request.UnlockMethod}";

            var contract = handover.Contract;
            if (contract != null)
            {
                contract.Status = "ACTIVE";
                contract.ActivatedAt ??= now;
                if (contract.Unit != null)
                {
                    contract.Unit.Status = "OCCUPIED";
                    contract.Unit.UpdatedAt = now;
                }
                if (contract.Reservation != null)
                {
                    contract.Reservation.Status = "CHECKED_IN";
                }

                if (!contract.AccessCredentials.Any(a => a.Status == "ACTIVE"))
                {
                    var method = (request.UnlockMethod ?? "CARD").ToUpperInvariant();
                    dbContext.AccessCredentials.Add(new AccessCredential
                    {
                        ContractId = contract.ContractId,
                        UnitId = contract.UnitId,
                        IssuedBy = userId,
                        CredentialType = method == "CARD" ? "ACCESS_CARD" : "ACCESS_CODE",
                        CredentialReference = $"{method}-{contract.Unit?.UnitNumber ?? "K01"}-{now.AddHours(7):yyMMdd}",
                        IssuedAt = now,
                        Status = "ACTIVE"
                    });
                }
            }
            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return;
        }

        throw new InvalidOperationException("Không tìm thấy lịch bàn giao. Quản lý cần phân bổ kho trước.");
    }

    public async Task SubmitReturnInspectionAsync(long userId, string id, ReturnInspectionRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var inspection = await dbContext.ReturnInspections
            .Include(ri => ri.Contract).ThenInclude(c => c.Unit)
            .FirstOrDefaultAsync(ri => ri.InspectionId == num || ri.ContractId == num, ct);

        if (inspection != null)
        {
            inspection.Status = "COMPLETED";
            inspection.InspectedAt = DateTime.UtcNow;
            inspection.StaffId = userId;
            inspection.Notes = request.Items;
            inspection.ConditionStatus = request.Walls;
            if (inspection.Contract?.Unit != null)
            {
                inspection.Contract.Unit.Status = "MAINTENANCE";
            }
            await dbContext.SaveChangesAsync(ct);
        }
    }

    // Code cũ được giữ để đối chiếu.
    // public async Task AddTicketResponseAsync(long userId, string id, TicketResponseRequest request, CancellationToken ct = default)
    // {
    //     var num = FacilityOpsStateStore.ParseIdNumber(id);
    //     var ticket = await dbContext.SupportTickets.FindAsync([num], ct);
    //     if (ticket != null)
    //     {
    //         ticket.Status = request.NextStatus;
    //         ticket.AssignedStaffId = userId;
    //         if (request.NextStatus == "RESOLVED" || request.NextStatus == "DONE")
    //         {
    //             ticket.ResolvedAt = DateTime.UtcNow;
    //         }
    //         await dbContext.SaveChangesAsync(ct);
    //     }
    // }
    // S05 dùng chung xử lý có kiểm tra cơ sở, trạng thái và lưu nội dung phản hồi vào nhật ký.
    public Task AddTicketResponseAsync(long userId, string id, TicketResponseRequest request, CancellationToken ct = default)
    {
        return new FacilityOpsService(dbContext).RespondTicketAsync(
            new(userId, false), id, new(request.Note, request.NextStatus), ct);
    }

    public async Task UpdateUnitStatusAsync(long userId, string id, UpdateUnitStatusRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"inventory:{fac.FacilityId}", ct);
        var number = FacilityOpsStateStore.ParseIdNumber(id);
        var unit = await dbContext.StorageUnits.SingleOrDefaultAsync(u => u.FacilityId == fac.FacilityId &&
            (u.UnitNumber == id || u.UnitId == number), ct) ?? throw new InvalidOperationException("Không tìm thấy ô kho.");
        var next = UnitStatusRules.Normalize(request.Status ?? "");
        UnitStatusRules.Validate(unit.Status, next, request.Reason);
        var held = await dbContext.UnitAssignments.AnyAsync(a => a.UnitId == unit.UnitId && a.Status == "ACTIVE" &&
            a.Reservation.Status != "CANCELLED" && a.Reservation.Status != "EXPIRED" && a.Reservation.Status != "NO_SHOW" &&
            (a.Reservation.RentalContract == null || (a.Reservation.RentalContract.Status != "COMPLETED" && a.Reservation.RentalContract.Status != "TERMINATED" && a.Reservation.RentalContract.Status != "CANCELLED")), ct)
            || await dbContext.RentalContracts.AnyAsync(c => c.UnitId == unit.UnitId && c.Status != "COMPLETED" &&
                c.Status != "CANCELLED" && c.Status != "TERMINATED", ct);
        if (held) throw new InvalidOperationException("Ô đang được giữ hoặc có hợp đồng chưa đóng, không được đổi trạng thái bằng tay.");
        if (unit.Status != next) {
            dbContext.UnitStatusHistories.Add(new UnitStatusHistory { UnitId = unit.UnitId, ChangedBy = userId,
                OldStatus = unit.Status, NewStatus = next, Reason = request.Reason!.Trim(), ChangedAt = DateTime.UtcNow });
            unit.Status = next;
            unit.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    public async Task RevokeCredentialAsync(long userId, string id, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var unit = await dbContext.StorageUnits
            .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId && u.UnitNumber == id, ct);
        if (unit == null)
        {
            throw new InvalidOperationException($"Không tìm thấy kho {id}.");
        }
        var cred = await dbContext.AccessCredentials.FirstOrDefaultAsync(c => c.UnitId == unit.UnitId && c.Status == "ACTIVE", ct);
        if (cred != null)
        {
            cred.Status = "REVOKED";
            cred.ReturnedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task ReissueCredentialAsync(long userId, ReissueCredentialRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var unit = await dbContext.StorageUnits
            .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId && u.UnitNumber == request.UnitCode, ct);
        if (unit == null)
        {
            throw new InvalidOperationException($"Không tìm thấy kho {request.UnitCode}.");
        }
        var cred = await dbContext.AccessCredentials.FirstOrDefaultAsync(c => c.UnitId == unit.UnitId && c.Status == "ACTIVE", ct);
        if (cred != null)
        {
            cred.CredentialType = request.CredentialType ?? cred.CredentialType;
            await dbContext.SaveChangesAsync(ct);
        }
    }
}
