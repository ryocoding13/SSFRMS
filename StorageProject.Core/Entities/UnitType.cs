namespace StorageProject.Core.Entities;

public class UnitType
{
    public long UnitTypeId { get; set; }
    public string TypeName { get; set; } = null!;
    public decimal? Length { get; set; }
    public decimal? Width { get; set; }
    public decimal? Height { get; set; }
    public decimal Area { get; set; }
    public bool ClimateControlled { get; set; } = false;
    public string? Description { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, INACTIVE
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<StorageUnit> StorageUnits { get; set; } = [];
    public ICollection<RentalRate> RentalRates { get; set; } = [];
    public ICollection<Policy> Policies { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}
