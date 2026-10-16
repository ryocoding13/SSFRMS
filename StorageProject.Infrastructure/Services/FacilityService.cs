using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Facility;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class FacilityService(AppDbContext dbContext) : IFacilityService
{
    public async Task<IReadOnlyList<FacilityDto>> GetActiveFacilitiesAsync(CancellationToken ct = default)
    {
        return await dbContext.Facilities
            .AsNoTracking()
            .Where(f => f.Status == "ACTIVE")
            .OrderBy(f => f.Name)
            .Select(f => new FacilityDto(
                f.FacilityId,
                f.Name,
                f.Address,
                f.ContactPhone,
                f.OpeningTime != null ? f.OpeningTime.Value.ToString(@"hh\:mm") : null,
                f.ClosingTime != null ? f.ClosingTime.Value.ToString(@"hh\:mm") : null,
                f.Status,
                f.Latitude,
                f.Longitude
            ))
            .ToListAsync(ct);
    }

    public async Task<FacilityDto?> GetFacilityByIdAsync(long facilityId, CancellationToken ct = default)
    {
        var f = await dbContext.Facilities
            .AsNoTracking()
            .Where(x => x.FacilityId == facilityId)
            .FirstOrDefaultAsync(ct);

        if (f == null) return null;

        return new FacilityDto(
            f.FacilityId,
            f.Name,
            f.Address,
            f.ContactPhone,
            f.OpeningTime != null ? f.OpeningTime.Value.ToString(@"hh\:mm") : null,
            f.ClosingTime != null ? f.ClosingTime.Value.ToString(@"hh\:mm") : null,
            f.Status,
            f.Latitude,
            f.Longitude
        );
    }

    public async Task<IReadOnlyList<UnitTypeDto>> GetActiveUnitTypesAsync(CancellationToken ct = default)
    {
        return await dbContext.UnitTypes
            .AsNoTracking()
            .Where(u => u.Status == "ACTIVE")
            .OrderBy(u => u.Area)
            .Select(u => new UnitTypeDto(
                u.UnitTypeId,
                u.TypeName,
                u.Length,
                u.Width,
                u.Height,
                u.Area,
                u.ClimateControlled,
                u.Description,
                u.Status
            ))
            .ToListAsync(ct);
    }

    public async Task<UnitTypeDto?> GetUnitTypeByIdAsync(long unitTypeId, CancellationToken ct = default)
    {
        var u = await dbContext.UnitTypes
            .AsNoTracking()
            .Where(x => x.UnitTypeId == unitTypeId)
            .FirstOrDefaultAsync(ct);

        if (u == null) return null;

        return new UnitTypeDto(
            u.UnitTypeId,
            u.TypeName,
            u.Length,
            u.Width,
            u.Height,
            u.Area,
            u.ClimateControlled,
            u.Description,
            u.Status
        );
    }

    public async Task<IReadOnlyList<RentalRateDto>> GetActiveRatesAsync(long? facilityId, long? unitTypeId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = dbContext.RentalRates
            .AsNoTracking()
            .Include(r => r.Facility)
            .Include(r => r.UnitType)
            .Where(r => r.Status == "ACTIVE" && r.EffectiveFrom <= today && (r.EffectiveTo == null || r.EffectiveTo >= today));

        if (facilityId.HasValue)
        {
            query = query.Where(r => r.FacilityId == facilityId.Value);
        }

        if (unitTypeId.HasValue)
        {
            query = query.Where(r => r.UnitTypeId == unitTypeId.Value);
        }

        return await query
            .Select(r => new RentalRateDto(
                r.RateId,
                r.FacilityId,
                r.Facility.Name,
                r.UnitTypeId,
                r.UnitType.TypeName,
                r.MonthlyRate,
                r.EffectiveFrom,
                r.EffectiveTo
            ))
            .ToListAsync(ct);
    }

    public async Task<AvailabilityResultDto?> CheckAvailabilityAsync(AvailabilityQueryRequest request, CancellationToken ct = default)
    {
        var facility = await dbContext.Facilities.FindAsync([request.FacilityId], ct);
        var unitType = await dbContext.UnitTypes.FindAsync([request.UnitTypeId], ct);

        if (facility == null || unitType == null)
        {
            return null;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var activeRate = await dbContext.RentalRates
            .Where(r => r.FacilityId == request.FacilityId 
                     && r.UnitTypeId == request.UnitTypeId 
                     && r.Status == "ACTIVE"
                     && r.EffectiveFrom <= today 
                     && (r.EffectiveTo == null || r.EffectiveTo >= today))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var monthlyRate = activeRate?.MonthlyRate ?? 0;
        var expectedEndDate = request.StartDate.AddMonths(request.RentalPeriodMonths);

        // Count units available
        var totalMatchingUnits = await dbContext.StorageUnits
            .CountAsync(u => u.FacilityId == request.FacilityId 
                          && u.UnitTypeId == request.UnitTypeId 
                          && u.Status == "AVAILABLE", ct);

        // Check active reservations that hold units
        var reservedUnitsCount = await dbContext.Reservations
            .CountAsync(r => r.FacilityId == request.FacilityId 
                          && r.UnitTypeId == request.UnitTypeId
                          && (r.Status == "PENDING_PAYMENT" || r.Status == "PENDING_VERIFICATION" || r.Status == "CONFIRMED")
                          && r.StartDate < expectedEndDate
                          && r.ExpectedEndDate > request.StartDate, ct);

        var availableCount = Math.Max(0, totalMatchingUnits - reservedUnitsCount);

        // Cọc theo chính sách DEPOSIT đang áp dụng (BR20, BR21) — cùng cách tính với lúc tạo đơn đặt chỗ
        var depositPolicy = await OpsRules.FindApplicablePolicyAsync(
            dbContext, "DEPOSIT", request.FacilityId, request.UnitTypeId, today, ct);

        var estimatedTotalRent = monthlyRate * request.RentalPeriodMonths;
        var requiredDeposit = OpsRules.CalculateDeposit(depositPolicy, monthlyRate, estimatedTotalRent);

        return new AvailabilityResultDto(
            facility.FacilityId,
            facility.Name,
            unitType.UnitTypeId,
            unitType.TypeName,
            unitType.Area,
            unitType.ClimateControlled,
            monthlyRate,
            estimatedTotalRent,
            requiredDeposit,
            request.StartDate,
            expectedEndDate,
            availableCount,
            availableCount > 0
        );
    }
}
