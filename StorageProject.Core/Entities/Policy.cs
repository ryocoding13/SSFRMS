namespace StorageProject.Core.Entities;

public class Policy
{
    public long PolicyId { get; set; }
    public long? FacilityId { get; set; }     // NULL = system-wide
    public long? UnitTypeId { get; set; }     // NULL = all unit types
    public long CreatedBy { get; set; }
    public string PolicyName { get; set; } = null!;
    // DEPOSIT, RENEWAL, CANCELLATION, RETURN, OVERDUE, EXTRA_FEE, DISCOUNT, FEE_WAIVER, PRICE_RANGE
    public string PolicyType { get; set; } = null!;
    public string? CalculationType { get; set; } // FIXED, PERCENTAGE, RANGE, RULE
    public decimal? Value { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public string RuleDescription { get; set; } = null!;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "DRAFT"; // DRAFT, ACTIVE, INACTIVE, EXPIRED
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Facility? Facility { get; set; }
    public UnitType? UnitType { get; set; }
    public User CreatedByUser { get; set; } = null!;
}
