namespace StorageProject.Core.DTOs.Facility;

public record FacilityDto(
    long FacilityId,
    string Name,
    string Address,
    string? ContactPhone,
    string? OpeningTime,
    string? ClosingTime,
    string Status
);

public record UnitTypeDto(
    long UnitTypeId,
    string TypeName,
    decimal? Length,
    decimal? Width,
    decimal? Height,
    decimal Area,
    bool ClimateControlled,
    string? Description,
    string Status
);

public record RentalRateDto(
    long RateId,
    long FacilityId,
    string FacilityName,
    long UnitTypeId,
    string UnitTypeName,
    decimal MonthlyRate,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo
);

public record AvailabilityQueryRequest(
    long FacilityId,
    long UnitTypeId,
    DateOnly StartDate,
    int RentalPeriodMonths
);

public record AvailabilityResultDto(
    long FacilityId,
    string FacilityName,
    long UnitTypeId,
    string UnitTypeName,
    decimal Area,
    bool ClimateControlled,
    decimal MonthlyRate,
    decimal EstimatedTotalRent,
    decimal RequiredDeposit,
    DateOnly StartDate,
    DateOnly ExpectedEndDate,
    int AvailableUnitCount,
    bool IsAvailable
);
