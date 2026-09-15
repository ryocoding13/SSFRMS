using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Entities;
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
                r.CreatedAt
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
            r.CreatedAt
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
                     && r.EffectiveFrom <= today 
                     && (r.EffectiveTo == null || r.EffectiveTo >= today))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Chưa có bảng giá áp dụng cho cơ sở và loại kho này.");

        // Check availability
        var expectedEndDate = request.StartDate.AddMonths(request.RentalPeriodMonths);
        var availableUnitsCount = await dbContext.StorageUnits
            .CountAsync(u => u.FacilityId == request.FacilityId 
                          && u.UnitTypeId == request.UnitTypeId 
                          && u.Status == "AVAILABLE", ct);

        var existingReservationsCount = await dbContext.Reservations
            .CountAsync(r => r.FacilityId == request.FacilityId 
                          && r.UnitTypeId == request.UnitTypeId
                          && (r.Status == "PENDING_PAYMENT" || r.Status == "CONFIRMED")
                          && r.StartDate < expectedEndDate
                          && r.ExpectedEndDate > request.StartDate, ct);

        if (availableUnitsCount - existingReservationsCount <= 0)
        {
            throw new InvalidOperationException("Hiện tại đã hết kho trống cho loại kho và khoảng thời gian yêu cầu.");
        }

        decimal depositMonths = 1;
        var depositPolicy = await dbContext.Policies
            .Where(p => p.PolicyType == "DEPOSIT" &&
                (p.FacilityId == request.FacilityId || p.FacilityId == null))
            .FirstOrDefaultAsync(ct);

        if (depositPolicy?.Value.HasValue == true)
        {
            depositMonths = depositPolicy.Value.Value;
        }

        var monthlyRate = activeRate.MonthlyRate;
        var estimatedAmount = monthlyRate * request.RentalPeriodMonths;
        var requiredDeposit = monthlyRate * depositMonths;

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
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Reservations.Add(reservation);
        await dbContext.SaveChangesAsync(ct);

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
            reservation.CreatedAt
        );
    }

    public async Task CancelReservationAsync(long customerId, long reservationId, string reason, CancellationToken ct = default)
    {
        var reservation = await dbContext.Reservations
            .Where(r => r.ReservationId == reservationId && r.CustomerId == customerId)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ hợp lệ.");

        if (reservation.Status != "PENDING_PAYMENT" && reservation.Status != "CONFIRMED")
        {
            throw new InvalidOperationException($"Không thể hủy đơn đặt chỗ ở trạng thái '{reservation.Status}'.");
        }

        reservation.Status = "CANCELLED";
        reservation.CancelledAt = DateTime.UtcNow;
        reservation.CancellationReason = reason;

        await dbContext.SaveChangesAsync(ct);
    }
}
