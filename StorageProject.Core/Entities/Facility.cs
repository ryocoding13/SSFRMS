namespace StorageProject.Core.Entities;

public class Facility
{
    public long FacilityId { get; set; }
    public string Name { get; set; } = null!;
    public string Address { get; set; } = null!;
    public string? ContactPhone { get; set; }
    public TimeOnly? OpeningTime { get; set; }
    public TimeOnly? ClosingTime { get; set; }
    // Toạ độ ghim trên bản đồ (WGS84, giống Google Maps). Cả hai cùng có hoặc cùng trống.
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, INACTIVE, TEMPORARILY_CLOSED
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<UserFacility> UserFacilities { get; set; } = [];
    public ICollection<StorageUnit> StorageUnits { get; set; } = [];
    public ICollection<RentalRate> RentalRates { get; set; } = [];
    public ICollection<Policy> Policies { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}
