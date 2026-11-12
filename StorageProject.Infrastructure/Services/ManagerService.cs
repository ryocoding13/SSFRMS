using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Ops;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ quản lý cơ sở (ManagerService) thực thi IManagerService.
/// Triển khai các chức năng của Quản lý cơ sở (Figma M01–M08):
/// bảng điều hành Quản lý (Board), phân bổ ô kho, phân công nhân viên, duyệt/từ chối gia hạn, nhắc nhở quá hạn và quản trị ô kho.
/// </summary>
public class ManagerService(AppDbContext dbContext, IStaffService staffService) : IManagerService
{
    /// <summary>
    /// Lấy toàn bộ dữ liệu bảng vận hành cơ sở (Board) dành riêng cho vai trò Quản lý cơ sở.
    /// Bao gồm phân bổ đơn, hợp đồng, gia hạn, phân công nhân sự và thống kê doanh thu.
    /// </summary>
    /// <param name="userId">ID người dùng vai trò Quản lý.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Dữ liệu OpsBoardDto đầy đủ cho Quản lý.</returns>
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
            .Where(r => r.FacilityId == fac.FacilityId && (r.Status == "CONFIRMED" || r.Status == "UNIT_ASSIGNED" || (r.Status == "PENDING_AT_FACILITY" && r.ExpiresAt > DateTime.UtcNow)))
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

        // D46: kế hoạch chuyển ô (RenewalUnitMove) — ô mới khách chọn và cọc chênh (đã chốt khi duyệt nếu có)
        var renewalIds = renewals.Select(r => r.RenewalId).ToList();
        var moveLogs = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == "RENEWAL" && l.EntityId != null && renewalIds.Contains(l.EntityId.Value)
                        && (l.Action == RenewalUnitMove.Requested || l.Action == RenewalUnitMove.Held))
            .OrderBy(l => l.LoggedAt).ThenBy(l => l.LogId).ToListAsync(ct);
        string? MoveField(long id, string field, params string[] actions)
        {
            var log = moveLogs.LastOrDefault(l => l.EntityId == id && actions.Contains(l.Action));
            if (log?.NewValue is not { Length: > 0 } json) return null;
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty(field, out var v) ? (v.ValueKind == System.Text.Json.JsonValueKind.String ? v.GetString() : v.ToString()) : null;
        }
        decimal TopUp(long id) => decimal.TryParse(MoveField(id, "topUp", RenewalUnitMove.Held, RenewalUnitMove.Requested),
            System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var t) ? t : 0m;

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
            RejectionReason = null,
            TargetUnit = MoveField(cr.RenewalId, "targetUnit", RenewalUnitMove.Requested),
            DepositTopUp = TopUp(cr.RenewalId)
        }).ToList();

        // 4. Assignments
        board.Assignments = [];
        foreach (var alloc in board.Allocations.Where(a => a.Status == "ALLOCATED" && a.Unit != null))
        {
            board.Assignments.Add(new OpsAssignmentDto
            {
                Id = $"PC-{alloc.Id.Replace("SS-", "")}",
                Title = $"Nhận chìa khóa {alloc.Unit} · {alloc.Customer}",
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
            .Include(p => p.Reservation).ThenInclude(r => r.UnitType)
            .Where(p => (p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId) == fac.FacilityId && p.Status == "PAID" && p.PaymentType == "RENT")
            .ToListAsync(ct);

        var normalTotal = payments.Where(p => !(p.ContractId != null ? p.Contract.Unit.UnitType.ClimateControlled : p.Reservation.UnitType.ClimateControlled)).Sum(p => p.Amount);
        var climateTotal = payments.Where(p => (p.ContractId != null ? p.Contract.Unit.UnitType.ClimateControlled : p.Reservation.UnitType.ClimateControlled)).Sum(p => p.Amount);

        var revenueMonths = payments
            .Where(p => p.PaidAt.HasValue)
            .GroupBy(p => new { p.PaidAt!.Value.Year, p.PaidAt!.Value.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new OpsRevenueMonthDto
            {
                Label = $"Tháng {g.Key.Month}",
                Month = g.Key.Month,
                Year = g.Key.Year,
                Value = Math.Round(g.Sum(p => p.Amount), 0)
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
                Value = Math.Round(normalTotal + climateTotal, 0)
            });
        }

        var forfeitedRefs = (await dbContext.Payments.AsNoTracking()
            .Where(p => (p.ContractId != null ? p.Contract.Unit.FacilityId : p.Reservation.FacilityId) == fac.FacilityId
                        && p.PaymentType == "REFUND" && p.Status == "CANCELLED" && p.TransactionReference != null
                        && p.TransactionReference.StartsWith("FORFEITED:"))
            .Select(p => p.Amount).ToListAsync(ct)).Sum(); // cộng trong bộ nhớ: SQLite không SUM được decimal

        board.Revenue = new OpsRevenueDto
        {
            ForfeitedRefunds = Math.Round(forfeitedRefs, 0),
            Months = revenueMonths,
            ByType = new List<OpsRevenueByTypeDto>
            {
                new() { Label = "Kho thường", Value = Math.Round(normalTotal, 0) },
                new() { Label = "Kiểm soát nhiệt độ", Value = Math.Round(climateTotal, 0) }
            },
            AsOf = DateTime.UtcNow.ToString("yyyy-MM-dd")
        };

        return board;
    }

    /// <summary>
    /// Phân bổ ô kho cụ thể cho đơn đặt chỗ đã đối soát hợp lệ (M05).
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="id">Mã đơn đặt chỗ.</param>
    /// <param name="request">Yêu cầu phân bổ chứa mã ô kho.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task AllocateUnitAsync(long userId, string id, AllocateUnitRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var r = await FacilityOpsStateStore.FindReservationByIdAsync(dbContext, id, fac.FacilityId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn phân bổ.");
        await ReservationAllocation.AllocateAsync(dbContext, userId, fac.FacilityId, r.ReservationId, request.UnitCode, ct);
    }

    /// <summary>
    /// Phân công nhân viên phụ trách xử lý yêu cầu hỗ trợ (M06).
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="id">Mã yêu cầu hỗ trợ.</param>
    /// <param name="request">Yêu cầu chứa ID nhân viên được gán.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task AssignStaffAsync(long userId, string id, AssignStaffRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        var ticket = await dbContext.SupportTickets
            .Include(t => t.Unit)
            .Include(t => t.Contract).ThenInclude(c => c!.Unit)
            .FirstOrDefaultAsync(t => t.TicketId == num && (t.Contract != null ? t.Contract.Unit.FacilityId == fac.FacilityId : t.Unit != null && t.Unit.FacilityId == fac.FacilityId), ct)
            ?? throw new InvalidOperationException("Không tìm thấy yêu cầu hỗ trợ tại cơ sở.");

        var staffUserId = FacilityOpsStateStore.ParseIdNumber(request.StaffId ?? "");
        if (staffUserId > 0)
        {
            var isStaffAtFac = await dbContext.UserFacilities.AnyAsync(uf => uf.UserId == staffUserId && uf.FacilityId == fac.FacilityId && uf.Status == "ACTIVE", ct);
            if (!isStaffAtFac) throw new InvalidOperationException("Nhân viên không thuộc cơ sở.");
            ticket.AssignedStaffId = staffUserId;
        }
        ticket.Status = "IN_PROGRESS";
        ticket.AssignedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Duyệt yêu cầu gia hạn hợp đồng (M01 / M03) sử dụng logic tập trung RenewalApproval.
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="id">Mã yêu cầu gia hạn.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public Task ApproveRenewalAsync(long userId, string id, CancellationToken ct = default)
        => throw new InvalidOperationException("Chức năng quản lý duyệt gia hạn đã bỏ. Hệ thống tự động xác nhận gia hạn hợp lệ để khách thanh toán trực tiếp.");

    /// <summary>Khóa luồng từ chối gia hạn thủ công sau Task #23.</summary>
    public Task RejectRenewalAsync(long userId, string id, RejectRenewalRequest request, CancellationToken ct = default)
        => throw new InvalidOperationException("Chức năng quản lý duyệt gia hạn đã bỏ. Hệ thống tự động xác nhận gia hạn hợp lệ để khách thanh toán trực tiếp.");

    /// <summary>
    /// Ghi nhận lời nhắc khách hàng quá hạn thanh toán/trả kho (M04 / M07), cập nhật hồ sơ OverdueCase.
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="id">Mã hợp đồng.</param>
    /// <param name="request">Yêu cầu ghi chú nhắc nhở.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task AddContractReminderAsync(long userId, string id, AddReminderRequest request, CancellationToken ct = default)
    {
        var fac = await FacilityOpsStateStore.GetUserFacilityAsync(dbContext, userId, ct);
        var num = FacilityOpsStateStore.ParseIdNumber(id);
        // M04: cùng khoá với tiến trình quá hạn (OverdueProcessor) và đăng ký trả kho → không tạo hai hồ sơ cho một hợp đồng.
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"move-out:{num}", ct);
        var contract = await dbContext.RentalContracts
            .Include(c => c.Unit)
            .Include(c => c.OverdueCases)
            .FirstOrDefaultAsync(c => c.ContractId == num && c.Unit.FacilityId == fac.FacilityId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy hợp đồng tại cơ sở.");
        if (contract.Status is "COMPLETED" or "TERMINATED" or "CANCELLED")
            throw new InvalidOperationException("Hợp đồng đã kết thúc, không ghi nhắc quá hạn.");

        var now = DateTime.UtcNow;
        var open = contract.OverdueCases.Where(o => o.Status != "RESOLVED").OrderByDescending(o => o.OpenedAt).FirstOrDefault();
        if (open != null)
        {
            open.Status = open.Status == "OPEN" ? "CONTACTED" : open.Status;
            open.Notes = string.IsNullOrWhiteSpace(request.Note) ? open.Notes : string.Join("\n", new[] { open.Notes, request.Note }.Where(n => !string.IsNullOrWhiteSpace(n)));
        }
        else
        {
            dbContext.OverdueCases.Add(new OverdueCase
            {
                ContractId = contract.ContractId,
                AssignedStaffId = userId,
                OverdueFrom = contract.EndDate.AddDays(1),
                Notes = request.Note,
                Status = "CONTACTED",
                OpenedAt = now
            });
        }
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Lấy danh sách toàn bộ ô kho trong cơ sở phụ trách kèm trạng thái vận hành.
    /// </summary>
    /// <param name="userId">ID Quản lý.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Danh sách ô kho thuộc cơ sở.</returns>
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

    /// <summary>
    /// Tạo mới một ô kho trong cơ sở quản lý.
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="request">Thông tin ô kho mới gồm mã số và tầng.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thông tin ô kho vừa tạo.</returns>
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

    /// <summary>
    /// Cập nhật thông tin ô kho (mã số, tầng).
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="id">Mã ô kho cần cập nhật.</param>
    /// <param name="request">Thông tin cập nhật mới.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thông tin ô kho sau khi cập nhật.</returns>
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
        if (!string.IsNullOrWhiteSpace(request.Status) && UnitStatusRules.Normalize(request.Status) != unit.Status)
            throw new InvalidOperationException("Đổi trạng thái bằng thao tác trạng thái riêng và nhập lý do.");
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

    /// <summary>
    /// Khóa ngừng phục vụ ô kho (chuyển sang trạng thái OUT_OF_SERVICE) kèm lý do.
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="id">Mã ô kho.</param>
    /// <param name="request">Yêu cầu khóa kho chứa lý do.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task LockUnitAsync(long userId, string id, LockUnitRequest request, CancellationToken ct = default)
    {
        await staffService.UpdateUnitStatusAsync(userId, id, new UpdateUnitStatusRequest { Status = "OUT_OF_SERVICE", Reason = request.Reason }, ct);
    }
}
