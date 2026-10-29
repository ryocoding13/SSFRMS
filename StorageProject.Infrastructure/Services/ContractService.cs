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
        // D32 / T08: kiểm toàn bộ dữ liệu khách gửi trước khi ghi (ảnh kho trống bắt buộc, đã chuyển hết đồ).
        if (request.Emptied != true) throw new ArgumentException("Vui lòng xác nhận đã chuyển hết đồ ra khỏi kho.");
        var photos = EvidencePhotos.Decode(request.Photos, required: true, what: "kho trống");
        var today = OpsRules.TodayLocal;
        if (request.Date < today) throw new ArgumentException("Ngày trả kho phải từ hôm nay trở đi.");
        var note = (request.Note ?? string.Empty).Trim();
        if (note.Length > 1000) throw new ArgumentException("Ghi chú tối đa 1000 ký tự.");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"move-out:{contractId}", ct);
        var contract = await dbContext.RentalContracts
            .Include(c => c.Unit)
                .ThenInclude(u => u.Facility)
            .Include(c => c.Customer)
            .Include(c => c.ContractRenewals)
            .Include(c => c.ReturnInspections)
            .FirstOrDefaultAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct);

        if (contract == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy hợp đồng #{contractId}.");
        }

        // Cho phép cả hợp đồng quá hạn (D32: gửi trả kho thì dừng tính phí). Không nhận yêu cầu trùng.
        if (contract.Status is not ("ACTIVE" or "EXPIRING" or "OVERDUE"))
        {
            throw new InvalidOperationException(contract.Status == "RETURN_PENDING"
                ? "Hợp đồng đã có yêu cầu trả kho. Không gửi lại được."
                : $"Không thể đăng ký trả kho với hợp đồng ở trạng thái {contract.Status}.");
        }
        if (contract.StartDate > today) throw new InvalidOperationException("Hợp đồng chưa đến ngày bắt đầu thuê. Vui lòng huỷ đơn thay vì trả kho.");
        if (contract.ReturnInspections.Any(i => i.Status is "SCHEDULED" or "IN_PROGRESS"))
        {
            throw new InvalidOperationException("Hợp đồng đã có yêu cầu trả kho. Không gửi lại được.");
        }
        if (contract.ContractRenewals.Any(r => r.Status is "PENDING" or "APPROVED"))
        {
            throw new InvalidOperationException("Hợp đồng đang có yêu cầu gia hạn chưa xong. Huỷ hoặc hoàn tất gia hạn trước khi trả kho.");
        }
        var bank = RefundBank.Validate(new StorageProject.Core.DTOs.Evidence.RefundBankInput(
            request.BankName, request.AccountNumber, request.AccountHolder), contract.Customer.FullName);

        // Giờ hẹn khách chọn là giờ Việt Nam; DB lưu UTC (D10).
        var timePart = new TimeOnly(9, 0);
        if (!string.IsNullOrWhiteSpace(request.Slot))
        {
            var firstTime = request.Slot.Split(['-', '–'])[0].Trim();
            if (TimeOnly.TryParse(firstTime, System.Globalization.CultureInfo.InvariantCulture, out var parsedTime))
            {
                timePart = parsedTime;
            }
        }
        var scheduledAt = DateTime.SpecifyKind(request.Date.ToDateTime(timePart).AddHours(-7), DateTimeKind.Utc);

        // Nhân viên đang được phân công tại cơ sở của ô kho (quản lý có thể giao lại ở M06).
        var staffUser = await dbContext.Users
            .Where(u => u.Status == "ACTIVE"
                        && u.UserRoles.Any(ur => ur.Role.RoleName == "STAFF")
                        && u.UserFacilities.Any(uf => uf.FacilityId == contract.Unit.FacilityId && uf.Status == "ACTIVE"
                                                      && uf.AssignedFrom <= today && (uf.AssignedTo == null || uf.AssignedTo >= today)))
            .OrderBy(u => u.UserId)
            .FirstOrDefaultAsync(ct)
            ?? await dbContext.Users.Where(u => u.UserRoles.Any(ur => ur.Role.RoleName == "STAFF")).OrderBy(u => u.UserId).FirstOrDefaultAsync(ct)
            ?? contract.Customer;

        var now = DateTime.UtcNow;
        var inspection = new StorageProject.Core.Entities.ReturnInspection
        {
            ContractId = contract.ContractId,
            StaffId = staffUser.UserId,
            ScheduledAt = scheduledAt,
            Status = "SCHEDULED",
            Notes = note.Length > 0 ? note : null,
            RefundBankName = bank.BankName,
            RefundAccountNumber = bank.AccountNumber,
            RefundAccountHolder = bank.AccountHolder,
            CreatedAt = now // mốc dừng tính phí quá hạn (D32)
        };

        dbContext.ReturnInspections.Add(inspection);
        contract.Status = "RETURN_PENDING"; // AccessService từ chối QR/PIN của hợp đồng RETURN_PENDING
        await dbContext.SaveChangesAsync(ct);
        EvidencePhotos.Attach(dbContext, photos, EvidencePhotos.MoveOut, inspection.InspectionId, customerId, now);
        dbContext.ActivityLogs.Add(new StorageProject.Core.Entities.ActivityLog
        {
            UserId = customerId, Action = "MOVE_OUT_REQUESTED", EntityType = "RETURN_INSPECTION", EntityId = inspection.InspectionId,
            NewValue = System.Text.Json.JsonSerializer.Serialize(new { photos = photos.Count, bankName = bank.BankName, slot = request.Slot }),
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new MoveOutResponseDto(
            inspection.InspectionId,
            contract.ContractId,
            inspection.Status,
            inspection.ScheduledAt,
            "Đăng ký lịch trả kho thành công. Nhân viên sẽ tiến hành kiểm tra kho theo lịch hẹn."
        );
    }
}
