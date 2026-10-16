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
        var reservations = await dbContext.Reservations
            .AsNoTracking()
            .Include(r => r.Customer)
            .Include(r => r.UnitType)
            .Where(r => r.FacilityId == fac.FacilityId &&
                       (r.Status == "PENDING_VERIFICATION" || r.Status == "PENDING_PAYMENT" || r.Status == "CONFIRMED" || r.Status == "MISMATCH"))
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
                Method = "Chuyển khoản ngân hàng",
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
                Status = r.Status == "CHECKED_IN" ? "DONE" : "TODO",
                DocType = "Căn cước công dân",
                DocLast4 = null,
                VerifiedAt = r.Status == "CHECKED_IN" ? r.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss") : null
            };
        }).ToList();

        var handoverRecords = await dbContext.HandoverRecords
            .AsNoTracking()
            .Include(h => h.Contract).ThenInclude(c => c.Customer)
            .Include(h => h.Contract).ThenInclude(c => c.Unit)
            .Where(h => h.Contract.Unit.FacilityId == fac.FacilityId)
            .OrderByDescending(h => h.ScheduledAt)
            .ToListAsync(ct);

        var handoverDtos = handoverRecords.Select(h => new OpsHandoverDto
        {
            Id = $"BG-{h.HandoverId:D4}",
            VerificationId = $"XM-{(h.Contract.ReservationId > 0 ? h.Contract.ReservationId : h.HandoverId):D4}",
            Unit = h.Contract.Unit.UnitNumber,
            Customer = h.Contract.Customer.FullName,
            Status = h.HandoverAt.HasValue ? "COMPLETED" : "WAITING",
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

        // 6. Tickets
        var tickets = await dbContext.SupportTickets
            .AsNoTracking()
            .Include(t => t.Customer)
            .Include(t => t.Unit)
            .Include(t => t.AssignedStaff)
            .Where(t => t.Unit != null && t.Unit.FacilityId == fac.FacilityId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var ticketDtos = tickets.Select(t => new OpsTicketDto
        {
            Id = $"HT-{t.TicketId:D4}",
            Unit = t.Unit?.UnitNumber ?? "KHO",
            Customer = t.Customer.FullName,
            Title = t.Title,
            CreatedAt = t.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"),
            Schedule = t.CreatedAt.AddHours(4).ToString("yyyy-MM-ddTHH:mm:ss"),
            Status = t.Status,
            Assignee = t.AssignedStaff != null ? $"NV-{t.AssignedStaff.UserId:D2}" : null,
            Notes = new List<OpsTicketNoteDto>
            {
                new()
                {
                    Author = t.Customer.FullName,
                    Content = t.Description,
                    CreatedAt = t.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss")
                }
            }
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
        var r = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct);
        if (r == null)
        {
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ / thanh toán.");
        }
        if (r.Status == "CONFIRMED")
        {
            throw new InvalidOperationException("không xác nhận hai lần");
        }

        r.Status = "CONFIRMED";
        r.PaidAt = DateTime.UtcNow;

        // Auto assign available unit if none assigned yet
        if (!r.UnitAssignments.Any(ua => ua.Status == "ACTIVE"))
        {
            var unit = await dbContext.StorageUnits
                .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId &&
                                          u.UnitTypeId == r.UnitTypeId &&
                                          u.Status == "AVAILABLE", ct);
            if (unit != null)
            {
                unit.Status = "RESERVED";
                unit.UpdatedAt = DateTime.UtcNow;

                dbContext.UnitAssignments.Add(new UnitAssignment
                {
                    ReservationId = r.ReservationId,
                    UnitId = unit.UnitId,
                    AssignedBy = userId,
                    Status = "ACTIVE",
                    AssignedAt = DateTime.UtcNow,
                    Reason = "Nhân viên xác nhận đối soát thanh toán"
                });
            }
        }

        await dbContext.SaveChangesAsync(ct);
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
            r.Status = "CHECKED_IN";
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task CompleteHandoverAsync(long userId, string id, CompleteHandoverRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var r = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct);
        if (r != null)
        {
            var assignment = r.UnitAssignments.FirstOrDefault(ua => ua.Status == "ACTIVE");
            if (assignment != null)
            {
                var unit = assignment.Unit;
                unit.Status = "OCCUPIED";
                unit.UpdatedAt = DateTime.UtcNow;

                var existingContract = await dbContext.RentalContracts.FirstOrDefaultAsync(c => c.ReservationId == r.ReservationId, ct);
                if (existingContract == null)
                {
                    var contract = new RentalContract
                    {
                        ReservationId = r.ReservationId,
                        CustomerId = r.CustomerId,
                        UnitId = unit.UnitId,
                        StartDate = r.StartDate,
                        EndDate = r.ExpectedEndDate,
                        AgreedMonthlyRate = r.QuotedMonthlyRate,
                        DepositAmount = r.RequiredDeposit,
                        Status = "ACTIVE",
                        CreatedAt = DateTime.UtcNow,
                        ActivatedAt = DateTime.UtcNow
                    };
                    dbContext.RentalContracts.Add(contract);
                    await dbContext.SaveChangesAsync(ct);

                    dbContext.HandoverRecords.Add(new HandoverRecord
                    {
                        ContractId = contract.ContractId,
                        StaffId = userId,
                        ScheduledAt = DateTime.UtcNow,
                        VerifiedAt = DateTime.UtcNow,
                        HandoverAt = DateTime.UtcNow,
                        InitialCondition = "Đã kiểm tra và bàn giao kho",
                        Notes = $"Phương thức mở khóa: {request.UnlockMethod}"
                    });
                }
            }
            await dbContext.SaveChangesAsync(ct);
        }
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

    public async Task AddTicketResponseAsync(long userId, string id, TicketResponseRequest request, CancellationToken ct = default)
    {
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var ticket = await dbContext.SupportTickets.FindAsync([num], ct);
        if (ticket != null)
        {
            ticket.Status = request.NextStatus;
            ticket.AssignedStaffId = userId;
            if (request.NextStatus == "RESOLVED" || request.NextStatus == "DONE")
            {
                ticket.ResolvedAt = DateTime.UtcNow;
            }
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task UpdateUnitStatusAsync(long userId, string id, UpdateUnitStatusRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Status))
        {
            throw new ArgumentException("Trạng thái kho không được để trống.");
        }
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var unit = await dbContext.StorageUnits
            .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId && (u.UnitNumber == id || u.UnitId == FacilityOpsStateStore.ParseIdNumber(id)), ct);
        if (unit == null)
        {
            throw new InvalidOperationException($"Không tìm thấy kho {id}.");
        }

        var dbStatus = request.Status.ToUpperInvariant() switch
        {
            "EMPTY" => "AVAILABLE",
            "ACTIVE" => "OCCUPIED",
            "WAITING_HANDOVER" => "RESERVED",
            "MAINTENANCE" => "MAINTENANCE",
            "LOCKED" => "LOCKED",
            _ => request.Status.ToUpperInvariant()
        };

        unit.Status = dbStatus;
        unit.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
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
