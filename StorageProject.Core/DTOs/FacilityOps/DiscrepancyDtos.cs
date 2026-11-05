namespace StorageProject.Core.DTOs.FacilityOps;

public record DiscrepancyDto(
    string Id,
    long FacilityId,
    string Customer,
    string Reference,
    decimal Expected,
    decimal Actual,
    string Note,
    string Status,
    string CreatedAt,
    string? Resolution = null,
    string? ResolvedAt = null
);

public record DiscrepancyActionRequest(
    string Action,
    string? Id = null,
    string? Reference = null,
    string? Customer = null,
    decimal? Expected = null,
    decimal? Actual = null,
    string? Note = null
);
