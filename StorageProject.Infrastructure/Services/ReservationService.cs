using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class ReservationService(AppDbContext dbContext) : IReservationService
{
    public async Task<IReadOnlyList<ReservationDto>> GetMyReservationsAsync(long customerId, CancellationToken ct = default)
    {
        return await dbContext.Reservations
            .AsNoTracking()
            .Include(r => r.Facility)
            .Include(r => r.UnitType)
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReservationDto(
                r.ReservationId,
                r.FacilityId,
                r.Facility.Name,
                r.UnitTypeId,
                r.UnitType.TypeName,
                r.StartDate,
                r.ExpectedEndDate,
                r.RentalPeriodMonths,
                r.QuotedMonthlyRate,
                r.EstimatedAmount,
                r.RequiredDeposit,
                r.Status,
                r.ExpiresAt,
                r.CancelledAt,
                r.CancellationReason,
                r.CreatedAt,
                r.PaymentMethod
            ))
            .ToListAsync(ct);
    }

    public async Task<ReservationDetailDto?> GetReservationDetailAsync(long customerId, long reservationId, CancellationToken ct = default)
    {
        var r = await dbContext.Reservations
            .AsNoTracking()
            .Include(x => x.Facility)
            .Include(x => x.UnitType)
            .Include(x => x.UnitAssignments)
                .ThenInclude(a => a.Unit)
            .Include(x => x.RentalContract)
            .Where(x => x.ReservationId == reservationId && x.CustomerId == customerId)
            .FirstOrDefaultAsync(ct);

        if (r == null) return null;

        var assignedUnit = r.UnitAssignments.OrderByDescending(a => a.AssignedAt).FirstOrDefault()?.Unit?.UnitNumber;
        var contract = r.RentalContract;

        return new ReservationDetailDto(
            r.ReservationId,
            r.FacilityId,
            r.Facility.Name,
            r.UnitTypeId,
            r.UnitType.TypeName,
            r.StartDate,
            r.ExpectedEndDate,
            r.RentalPeriodMonths,
            r.QuotedMonthlyRate,
            r.EstimatedAmount,
            r.RequiredDeposit,
            r.Status,
            r.ExpiresAt,
            r.CheckInAppointmentAt,
            assignedUnit,
            contract?.ContractId,
            contract?.Status,
            r.CreatedAt,
                r.PaymentMethod
        );
    }

    public async Task<ReservationDto> CreateReservationAsync(long customerId, CreateReservationRequest request, CancellationToken ct = default)
    {
        if (request.RentalPeriodMonths <= 0)
        {
            throw new ArgumentException("Thời hạn thuê phải lớn hơn 0 tháng.");
        }

        var facility = await dbContext.Facilities.FindAsync([request.FacilityId], ct)
            ?? throw new InvalidOperationException("Không tìm thấy cơ sở kho.");

        // UC19: chỉ cơ sở đang hoạt động mới nhận đặt chỗ mới (tạm đóng vẫn phục vụ khách hiện tại)
        if (facility.Status != "ACTIVE")
        {
            throw new InvalidOperationException("Cơ sở này đang tạm ngừng nhận đặt chỗ mới. Vui lòng chọn cơ sở khác.");
        }

        var unitType = await dbContext.UnitTypes.FindAsync([request.UnitTypeId], ct)
            ?? throw new InvalidOperationException("Không tìm thấy loại phòng kho.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.StartDate < today)
        {
            throw new ArgumentException("Ngày bắt đầu thuê không thể ở quá khứ.");
        }

        var activeRate = await dbContext.RentalRates
            .Where(r => r.FacilityId == request.FacilityId 
                     && r.UnitTypeId == request.UnitTypeId 
                     && r.Status == "ACTIVE"
                     && r.EffectiveFrom <= today 
                     && (r.EffectiveTo == null || r.EffectiveTo >= today))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Chưa có bảng giá áp dụng cho cơ sở và loại kho này.");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"inventory:{request.FacilityId}", ct);
        // Check availability
        var expectedEndDate = request.StartDate.AddMonths(request.RentalPeriodMonths);
        var availableUnitsCount = await dbContext.StorageUnits
            .CountAsync(u => u.FacilityId == request.FacilityId 
                          && u.UnitTypeId == request.UnitTypeId 
                          && u.Status == "AVAILABLE", ct);

        var existingReservationsCount = await dbContext.Reservations
            .CountAsync(r => r.FacilityId == request.FacilityId 
                          && r.UnitTypeId == request.UnitTypeId
                          && (r.Status == "CONFIRMED" || ((r.Status == "PENDING_PAYMENT" || r.Status == "PENDING_VERIFICATION" || r.Status == "PENDING_AT_FACILITY") && r.ExpiresAt > DateTime.UtcNow))
                          && !r.UnitAssignments.Any(a => a.Status == "ACTIVE")
                          && r.StartDate < expectedEndDate
                          && r.ExpectedEndDate > request.StartDate, ct);

        if (availableUnitsCount - existingReservationsCount <= 0)
        {
            throw new InvalidOperationException("Hiện tại đã hết kho trống cho loại kho và khoảng thời gian yêu cầu.");
        }

        // Chỉ chính sách đang áp dụng, chọn theo thứ tự ưu tiên BR20 (bản nháp của Vận hành KD không ảnh hưởng)
        var depositPolicy = await OpsRules.FindApplicablePolicyAsync(
            dbContext, "DEPOSIT", request.FacilityId, request.UnitTypeId, today, ct);

        var monthlyRate = activeRate.MonthlyRate;
        var estimatedAmount = monthlyRate * request.RentalPeriodMonths;
        var requiredDeposit = OpsRules.CalculateDeposit(depositPolicy, monthlyRate, estimatedAmount);

        var reservation = new Reservation
        {
            CustomerId = customerId,
            FacilityId = request.FacilityId,
            UnitTypeId = request.UnitTypeId,
            StartDate = request.StartDate,
            ExpectedEndDate = expectedEndDate,
            RentalPeriodMonths = request.RentalPeriodMonths,
            QuotedMonthlyRate = monthlyRate,
            EstimatedAmount = estimatedAmount,
            RequiredDeposit = requiredDeposit,
            Status = "PENDING_PAYMENT",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Reservations.Add(reservation);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ReservationDto(
            reservation.ReservationId,
            reservation.FacilityId,
            facility.Name,
            reservation.UnitTypeId,
            unitType.TypeName,
            reservation.StartDate,
            reservation.ExpectedEndDate,
            reservation.RentalPeriodMonths,
            reservation.QuotedMonthlyRate,
            reservation.EstimatedAmount,
            reservation.RequiredDeposit,
            reservation.Status,
            reservation.ExpiresAt,
            reservation.CancelledAt,
            reservation.CancellationReason,
            reservation.CreatedAt,
            reservation.PaymentMethod
        );
    }

    public async Task CancelReservationAsync(long customerId, long reservationId, string reason, CancellationToken ct = default)
    {
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"reservation:{reservationId}", ct);
        var reservation = await dbContext.Reservations
            .Where(r => r.ReservationId == reservationId && r.CustomerId == customerId)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ hợp lệ.");

        if (reservation.Status != "PENDING_PAYMENT" && reservation.Status != "CONFIRMED" && reservation.Status != "PENDING_AT_FACILITY")
        {
            throw new InvalidOperationException($"Không thể hủy đơn đặt chỗ ở trạng thái '{reservation.Status}'.");
        }

        reservation.Status = "CANCELLED";
        reservation.CancelledAt = DateTime.UtcNow;
        reservation.CancellationReason = reason;
        foreach (var a in await dbContext.UnitAssignments.Include(a => a.Unit).Where(a => a.ReservationId == reservationId && a.Status == "ACTIVE").ToListAsync(ct))
        {
            a.Status = "CANCELLED";
            if (a.Unit.Status == "RESERVED") a.Unit.Status = "AVAILABLE";
        }
        var draft = await dbContext.RentalContracts.SingleOrDefaultAsync(c => c.ReservationId == reservationId && c.Status == "DRAFT", ct);
        if (draft != null) draft.Status = "CANCELLED";
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// C04 / F03: khách bấm "Tôi đã chuyển khoản" → đơn chờ nhân viên đối soát (S09).
    /// Gọi lại khi đơn đã chờ đối soát thì trả về đơn như cũ (an toàn khi bấm hai lần).
    /// </summary>
    public async Task<ReservationDto> ConfirmTransferAsync(long customerId, long reservationId, CancellationToken ct = default)
    {
        var reservation = await dbContext.Reservations
            .Include(r => r.Facility)
            .Include(r => r.UnitType)
            .FirstOrDefaultAsync(r => r.ReservationId == reservationId && r.CustomerId == customerId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy đơn đặt chỗ.");

        if (reservation.Status == "PENDING_VERIFICATION") return ToDto(reservation);
        if (reservation.Status != "PENDING_PAYMENT")
        {
            throw new InvalidOperationException("Đơn đặt chỗ này không còn chờ chuyển khoản.");
        }

        var now = DateTime.UtcNow;
        if (reservation.ExpiresAt.HasValue && reservation.ExpiresAt.Value <= now)
        {
            reservation.Status = "EXPIRED";
            reservation.CancelledAt = now;
            reservation.CancellationReason = "Quá thời gian giữ chỗ chưa xác nhận chuyển khoản";
            await dbContext.SaveChangesAsync(ct);
            throw new ReservationExpiredException("Đơn đặt chỗ đã hết thời gian giữ chỗ.");
        }

        reservation.Status = "PENDING_VERIFICATION";
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = customerId,
            Action = "TRANSFER_REPORTED",
            EntityType = "RESERVATION",
            EntityId = reservation.ReservationId,
            NewValue = JsonSerializer.Serialize(new { amount = reservation.EstimatedAmount + reservation.RequiredDeposit }),
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);
        return ToDto(reservation);
    }

    private static ReservationDto ToDto(Reservation r) => new(
        r.ReservationId,
        r.FacilityId,
        r.Facility.Name,
        r.UnitTypeId,
        r.UnitType.TypeName,
        r.StartDate,
        r.ExpectedEndDate,
        r.RentalPeriodMonths,
        r.QuotedMonthlyRate,
        r.EstimatedAmount,
        r.RequiredDeposit,
        r.Status,
        r.ExpiresAt,
        r.CancelledAt,
        r.CancellationReason,
        r.CreatedAt,
                r.PaymentMethod
    );
}
