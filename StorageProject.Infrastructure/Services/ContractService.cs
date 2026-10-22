using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class ContractService(AppDbContext dbContext) : IContractService
{
    public async Task<IReadOnlyList<ContractSummaryDto>> GetMyContractsAsync(long customerId, CancellationToken ct = default)
    {
        return await dbContext.RentalContracts
            .AsNoTracking()
            .Include(c => c.Unit)
                .ThenInclude(u => u.Facility)
            .Include(c => c.Unit)
                .ThenInclude(u => u.UnitType)
            .Where(c => c.CustomerId == customerId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new ContractSummaryDto(
                c.ContractId,
                c.ReservationId,
                c.UnitId,
                c.Unit.UnitNumber,
                c.Unit.Facility.Name,
                c.Unit.UnitType.TypeName,
                c.StartDate,
                c.EndDate,
                c.AgreedMonthlyRate,
                c.DepositAmount,
                c.Status,
                c.ActivatedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<ContractDetailDto?> GetContractDetailAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var c = await dbContext.RentalContracts
            .AsNoTracking()
            .Include(x => x.Unit)
                .ThenInclude(u => u.Facility)
            .Include(x => x.Unit)
                .ThenInclude(u => u.UnitType)
            .Include(x => x.Payments)
            .Include(x => x.ContractRenewals)
            .Include(x => x.HandoverRecord)
            .Include(x => x.AccessCredentials)
            .Where(x => x.ContractId == contractId && x.CustomerId == customerId)
            .FirstOrDefaultAsync(ct);

        if (c == null) return null;

        var handover = c.HandoverRecord;

        var handoverDto = handover == null ? null : new HandoverSummaryDto(
            handover.HandoverId,
            handover.Status,
            handover.ScheduledAt,
            handover.HandoverAt,
            handover.CustomerConfirmed,
            handover.StaffConfirmed
        );

        var payments = c.Payments
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentDto(
                p.PaymentId,
                p.ContractId,
                p.RenewalId,
                p.PaymentType,
                p.Amount,
                p.Currency,
                p.PaymentMethod,
                p.TransactionReference,
                p.DueDate,
                p.PaidAt,
                p.Status,
                p.CreatedAt
            ))
            .ToList();

        var renewals = c.ContractRenewals
            .OrderByDescending(r => r.RequestedAt)
            .Select(r => new RenewalDto(
                r.RenewalId,
                r.ContractId,
                r.OldEndDate,
                r.NewEndDate,
                r.RenewalPeriodMonths,
                r.OldMonthlyRate,
                r.NewMonthlyRate,
                r.RenewalAmount,
                r.Status,
                r.RequestedAt,
                r.ApprovedAt
            ))
            .ToList();

        return new ContractDetailDto(
            c.ContractId,
            c.ReservationId,
            c.UnitId,
            c.Unit.UnitNumber,
            c.Unit.Facility.Name,
            c.Unit.UnitType.TypeName,
            c.StartDate,
            c.EndDate,
            c.AgreedMonthlyRate,
            c.DepositAmount,
            c.Status,
            c.TerminationReason,
            c.CreatedAt,
            c.ActivatedAt,
            c.CompletedAt,
            handoverDto,
            payments,
            renewals,
            c.AccessCredentials.Where(a => a.Status == "ACTIVE" && a.CredentialType == "ACCESS_CODE" &&
                a.CredentialReference != null && a.CredentialReference.Length > 3 &&
                Guid.TryParseExact(a.CredentialReference[3..], "N", out _))
                .Select(a => (DateTime?)a.IssuedAt).Max()
        );
    }

    public async Task<MoveOutResponseDto> RegisterMoveOutAsync(long customerId, long contractId, MoveOutRequest request, CancellationToken ct = default)
    {
        var contract = await dbContext.RentalContracts
            .Include(c => c.Unit)
                .ThenInclude(u => u.Facility)
            .Include(c => c.Customer)
            .FirstOrDefaultAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct);

        if (contract == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy hợp đồng #{contractId}.");
        }

        if (contract.Status is not ("ACTIVE" or "EXPIRING"))
        {
            throw new InvalidOperationException($"Không thể đăng ký trả kho với hợp đồng ở trạng thái {contract.Status}.");
        }

        // Parse scheduled datetime
        var timePart = new TimeOnly(9, 0);
        if (!string.IsNullOrWhiteSpace(request.Slot))
        {
            var firstTime = request.Slot.Split(['-', '–'])[0].Trim();
            if (TimeOnly.TryParse(firstTime, out var parsedTime))
            {
                timePart = parsedTime;
            }
        }
        var scheduledAt = request.Date.ToDateTime(timePart);

        // Find a staff member at the facility or system staff
        var staffUser = await dbContext.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserRoles.Any(ur => ur.Role.RoleName == "STAFF"), ct)
            ?? contract.Customer;

        var inspection = new StorageProject.Core.Entities.ReturnInspection
        {
            ContractId = contract.ContractId,
            StaffId = staffUser.UserId,
            ScheduledAt = scheduledAt,
            Status = "SCHEDULED",
            Notes = request.Note,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ReturnInspections.Add(inspection);
        contract.Status = "RETURN_PENDING";
        await dbContext.SaveChangesAsync(ct);

        return new MoveOutResponseDto(
            inspection.InspectionId,
            contract.ContractId,
            inspection.Status,
            inspection.ScheduledAt,
            "Đăng ký lịch trả kho thành công. Nhân viên sẽ tiến hành kiểm tra kho theo lịch hẹn."
        );
    }
}
