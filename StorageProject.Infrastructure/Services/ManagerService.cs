using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class ManagerService(AppDbContext dbContext, IStaffService staffService) : IManagerService
{
    public async Task<OpsBoardDto> GetManagerBoardAsync(long userId, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var user = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId, ct);

        // Base staff board from database
        var board = await staffService.GetStaffBoardAsync(userId, ct);

        board.Me = user != null ? new OpsUserInfoDto
        {
            UserId = user.UserId,
            Username = user.Username,
            FullName = user.FullName,
            Role = "MANAGER",
            StaffId = null
        } : null;

        // 1. Allocations (Đơn đặt chỗ đã thanh toán / xác nhận chờ phân bổ kho)
        var confirmedReservations = await dbContext.Reservations
            .AsNoTracking()
            .Include(r => r.Customer)
            .Include(r => r.UnitType)
            .Include(r => r.UnitAssignments).ThenInclude(ua => ua.Unit)
            .Where(r => r.FacilityId == fac.FacilityId && (r.Status == "CONFIRMED" || r.Status == "UNIT_ASSIGNED"))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        board.Allocations = confirmedReservations.Select(r =>
        {
            var activeAssignment = r.UnitAssignments.FirstOrDefault(ua => ua.Status == "ACTIVE");
            return new OpsAllocationDto
            {
                Id = $"SS-{r.CreatedAt:yyyyMMdd}-{r.ReservationId:D4}",
                Customer = r.Customer.FullName,
                Type = r.UnitType.ClimateControlled ? "climate" : "normal",
                Offer = $"Kho {r.UnitType.TypeName}",
                MinArea = r.UnitType.Area,
                MaxArea = r.UnitType.Area * 2,
                Start = r.StartDate.ToString("yyyy-MM-dd"),
                End = r.ExpectedEndDate.ToString("yyyy-MM-dd"),
                Pickup = $"{r.StartDate:yyyy-MM-dd}T09:00:00",
                Status = activeAssignment != null ? "ALLOCATED" : "PENDING",
                Unit = activeAssignment?.Unit?.UnitNumber
            };
        }).ToList();

        // 2. Contracts
        var contracts = await dbContext.RentalContracts
            .AsNoTracking()
            .Include(c => c.Customer)
            .Include(c => c.Unit)
            .Where(c => c.Unit.FacilityId == fac.FacilityId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        board.Contracts = contracts.Select(c => new OpsContractDto
        {
            Id = $"HĐ-{c.StartDate:yyyy}-{c.ContractId:D4}",
            Customer = c.Customer.FullName,
            Unit = c.Unit.UnitNumber,
            End = c.EndDate.ToString("yyyy-MM-dd"),
            Due = c.Status == "ACTIVE" ? "Tiền thuê định kỳ" : "Hợp đồng đã đóng",
            Amount = c.AgreedMonthlyRate,
            State = c.Status,
            Reminders = []
        }).ToList();

        // 3. Renewals
        var renewals = await dbContext.ContractRenewals
            .AsNoTracking()
            .Include(cr => cr.Contract).ThenInclude(c => c.Customer)
            .Include(cr => cr.Contract).ThenInclude(c => c.Unit)
            .Where(cr => cr.Contract.Unit.FacilityId == fac.FacilityId)
            .OrderByDescending(cr => cr.CreatedAt)
            .ToListAsync(ct);

        board.Renewals = renewals.Select(cr => new OpsRenewalDto
        {
            Id = $"GH-{cr.RenewalId:D4}",
            Contract = $"HĐ-{cr.Contract.StartDate:yyyy}-{cr.Contract.ContractId:D4}",
            Customer = cr.Contract.Customer.FullName,
            Unit = cr.Contract.Unit.UnitNumber,
            From = cr.OldEndDate.ToString("yyyy-MM-dd"),
            To = cr.NewEndDate.ToString("yyyy-MM-dd"),
            Months = cr.RenewalPeriodMonths,
            Requested = cr.RequestedAt.ToString("yyyy-MM-ddTHH:mm:ss"),
            Status = cr.Status,
            RejectionReason = null
        }).ToList();

        // 4. Assignments
        board.Assignments = [];
        foreach (var alloc in board.Allocations.Where(a => a.Status == "ALLOCATED" && a.Unit != null))
        {
            board.Assignments.Add(new OpsAssignmentDto
            {
                Id = $"PC-{alloc.Id.Replace("SS-", "")}",
                Title = $"Bàn giao {alloc.Unit} · {alloc.Customer}",
                When = alloc.Pickup,
                Staff = board.Staff.FirstOrDefault()?.StaffId ?? "NV-01",
                Status = "OPEN",
                Ref = $"BG-{alloc.Id.Replace("SS-", "")}"
            });
        }

        // 5. Revenue
        var payments = await dbContext.Payments
            .AsNoTracking()
            .Include(p => p.Contract).ThenInclude(c => c.Unit).ThenInclude(u => u.UnitType)
            .Where(p => p.Contract.Unit.FacilityId == fac.FacilityId && p.Status == "PAID")
            .ToListAsync(ct);

        var normalTotal = payments.Where(p => !p.Contract.Unit.UnitType.ClimateControlled).Sum(p => p.Amount) / 1_000_000m;
        var climateTotal = payments.Where(p => p.Contract.Unit.UnitType.ClimateControlled).Sum(p => p.Amount) / 1_000_000m;

        var revenueMonths = payments
            .Where(p => p.PaidAt.HasValue)
            .GroupBy(p => new { p.PaidAt!.Value.Year, p.PaidAt!.Value.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new OpsRevenueMonthDto
            {
                Label = $"Tháng {g.Key.Month}",
                Month = g.Key.Month,
                Year = g.Key.Year,
                Value = Math.Round(g.Sum(p => p.Amount) / 1_000_000m, 1)
            })
            .ToList();

        if (revenueMonths.Count == 0)
        {
            var now = DateTime.UtcNow;
            revenueMonths.Add(new OpsRevenueMonthDto
            {
                Label = $"Tháng {now.Month}",
                Month = now.Month,
                Year = now.Year,
                Value = Math.Round((normalTotal + climateTotal), 1)
            });
        }

        board.Revenue = new OpsRevenueDto
        {
            Months = revenueMonths,
            ByType = new List<OpsRevenueByTypeDto>
            {
                new() { Label = "Kho thường", Value = Math.Round(normalTotal, 1) },
                new() { Label = "Kiểm soát nhiệt độ", Value = Math.Round(climateTotal, 1) }
            },
            AsOf = DateTime.UtcNow.ToString("yyyy-MM-dd")
        };

        return board;
    }

    public async Task AllocateUnitAsync(long userId, string id, AllocateUnitRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var r = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct);
        if (r == null) throw new InvalidOperationException("Không tìm thấy đơn phân bổ.");

        var unit = await dbContext.StorageUnits
            .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId && u.UnitNumber == request.UnitCode, ct);
        if (unit == null || unit.Status != "AVAILABLE")
        {
            throw new InvalidOperationException("Kho không hợp lệ hoặc không trống.");
        }

        unit.Status = "RESERVED";
        unit.UpdatedAt = DateTime.UtcNow;

        var existingAssignments = await dbContext.UnitAssignments
            .Where(ua => ua.ReservationId == r.ReservationId)
            .ToListAsync(ct);
        foreach (var a in existingAssignments) a.Status = "INACTIVE";

        dbContext.UnitAssignments.Add(new UnitAssignment
        {
            ReservationId = r.ReservationId,
            UnitId = unit.UnitId,
            AssignedBy = userId,
            Status = "ACTIVE",
            AssignedAt = DateTime.UtcNow,
            Reason = "Quản lý cơ sở phân bổ kho"
        });

        r.Status = "CONFIRMED";
        await dbContext.SaveChangesAsync(ct);
    }

    public async Task AssignStaffAsync(long userId, string id, AssignStaffRequest request, CancellationToken ct = default)
    {
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var ticket = await dbContext.SupportTickets.FindAsync([num], ct);
        if (ticket != null)
        {
            var staffUserId = FacilityOpsStateStore.ParseIdNumber(request.StaffId ?? "");
            if (staffUserId > 0) ticket.AssignedStaffId = staffUserId;
            ticket.Status = "IN_PROGRESS";
            ticket.AssignedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task ApproveRenewalAsync(long userId, string id, CancellationToken ct = default)
    {
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract)
            .FirstOrDefaultAsync(r => r.RenewalId == num, ct);
        if (renewal != null)
        {
            renewal.Status = "APPROVED";
            renewal.ApprovedBy = userId;
            renewal.ApprovedAt = DateTime.UtcNow;
            if (renewal.Contract != null)
            {
                renewal.Contract.EndDate = renewal.NewEndDate;
            }
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task RejectRenewalAsync(long userId, string id, RejectRenewalRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ArgumentException("từ chối phải có lý do");
        }
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var renewal = await dbContext.ContractRenewals.FindAsync([num], ct);
        if (renewal != null)
        {
            renewal.Status = "REJECTED";
            renewal.ApprovedBy = userId;
            renewal.ApprovedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task AddContractReminderAsync(long userId, string id, AddReminderRequest request, CancellationToken ct = default)
    {
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var contract = await dbContext.RentalContracts.FindAsync([num], ct);
        if (contract != null)
        {
            dbContext.OverdueCases.Add(new OverdueCase
            {
                ContractId = contract.ContractId,
                AssignedStaffId = userId,
                OverdueFrom = DateOnly.FromDateTime(DateTime.UtcNow),
                Notes = request.Note,
                Status = "CONTACTED",
                OpenedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task ConfirmRefundAsync(long userId, string id, CancellationToken ct = default)
    {
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var contract = await dbContext.RentalContracts
            .Include(c => c.Unit)
            .FirstOrDefaultAsync(c => c.ContractId == num, ct);
        if (contract != null)
        {
            contract.Status = "ENDED";
            if (contract.Unit != null)
            {
                contract.Unit.Status = "AVAILABLE";
                contract.Unit.UpdatedAt = DateTime.UtcNow;
            }
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<IReadOnlyList<OpsUnitDto>> GetFacilityUnitsAsync(long userId, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var units = await dbContext.StorageUnits
            .AsNoTracking()
            .Include(u => u.UnitType)
            .Where(u => u.FacilityId == fac.FacilityId)
            .OrderBy(u => u.UnitNumber)
            .ToListAsync(ct);

        return units.Select(u => new OpsUnitDto
        {
            Code = u.UnitNumber,
            Area = u.UnitType.Area,
            Floor = int.TryParse(u.Floor?.Replace("Tầng", "").Trim(), out var fl) ? fl : 1,
            Type = u.UnitType.ClimateControlled ? "climate" : "normal",
            Status = u.Status switch
            {
                "AVAILABLE" => "EMPTY",
                "OCCUPIED" => "ACTIVE",
                "RESERVED" => "WAITING_HANDOVER",
                "MAINTENANCE" => "MAINTENANCE",
                "LOCKED" => "LOCKED",
                _ => u.Status
            }
        }).ToList();
    }

    public async Task<OpsUnitDto> CreateUnitAsync(long userId, CreateStorageUnitRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var existing = await dbContext.StorageUnits
            .AnyAsync(u => u.FacilityId == fac.FacilityId && u.UnitNumber == request.UnitNumber, ct);
        if (existing)
        {
            throw new InvalidOperationException($"Mã ô kho {request.UnitNumber} đã tồn tại trong cơ sở.");
        }

        var defaultType = await dbContext.UnitTypes.FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Chưa có loại phòng kho nào trong hệ thống.");

        var newUnit = new StorageUnit
        {
            FacilityId = fac.FacilityId,
            UnitTypeId = defaultType.UnitTypeId,
            UnitNumber = request.UnitNumber,
            Floor = request.Floor ?? "Tầng 1",
            Zone = "Khu A",
            Status = "AVAILABLE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.StorageUnits.Add(newUnit);
        await dbContext.SaveChangesAsync(ct);

        return new OpsUnitDto
        {
            Code = newUnit.UnitNumber,
            Area = defaultType.Area,
            Floor = int.TryParse(newUnit.Floor?.Replace("Tầng", "").Trim(), out var fl) ? fl : 1,
            Type = defaultType.ClimateControlled ? "climate" : "normal",
            Status = "EMPTY"
        };
    }

    public async Task<OpsUnitDto> UpdateUnitAsync(long userId, string id, UpdateStorageUnitRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var unit = await dbContext.StorageUnits
            .Include(u => u.UnitType)
            .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId && u.UnitNumber == id, ct);
        if (unit == null)
        {
            throw new InvalidOperationException($"Không tìm thấy ô kho {id}.");
        }

        if (!string.IsNullOrWhiteSpace(request.UnitNumber)) unit.UnitNumber = request.UnitNumber;
        if (!string.IsNullOrWhiteSpace(request.Floor)) unit.Floor = request.Floor;
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            unit.Status = request.Status.ToUpperInvariant() switch
            {
                "EMPTY" => "AVAILABLE",
                "ACTIVE" => "OCCUPIED",
                "WAITING_HANDOVER" => "RESERVED",
                "MAINTENANCE" => "MAINTENANCE",
                "LOCKED" => "LOCKED",
                _ => request.Status.ToUpperInvariant()
            };
        }
        unit.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        return new OpsUnitDto
        {
            Code = unit.UnitNumber,
            Area = unit.UnitType.Area,
            Floor = int.TryParse(unit.Floor?.Replace("Tầng", "").Trim(), out var fl) ? fl : 1,
            Type = unit.UnitType.ClimateControlled ? "climate" : "normal",
            Status = unit.Status switch
            {
                "AVAILABLE" => "EMPTY",
                "OCCUPIED" => "ACTIVE",
                "RESERVED" => "WAITING_HANDOVER",
                "MAINTENANCE" => "MAINTENANCE",
                "LOCKED" => "LOCKED",
                _ => unit.Status
            }
        };
    }

    public async Task LockUnitAsync(long userId, string id, LockUnitRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var unit = await dbContext.StorageUnits
            .FirstOrDefaultAsync(u => u.FacilityId == fac.FacilityId && u.UnitNumber == id, ct);
        if (unit == null)
        {
            throw new InvalidOperationException($"Không tìm thấy ô kho {id}.");
        }
        unit.Status = "LOCKED";
        unit.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
    }
}
