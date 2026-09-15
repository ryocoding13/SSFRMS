namespace StorageProject.Core.Entities;

public class RentalRate
{
    public long RateId { get; set; }
    public long FacilityId { get; set; }
    public long UnitTypeId { get; set; }
    public long SetBy { get; set; }
    public decimal MonthlyRate { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "DRAFT"; // DRAFT, ACTIVE, EXPIRED, INACTIVE
    public DateTime CreatedAt { get; set; }

    public Facility Facility { get; set; } = null!;
    public UnitType UnitType { get; set; } = null!;
    public User SetByUser { get; set; } = null!;
}
