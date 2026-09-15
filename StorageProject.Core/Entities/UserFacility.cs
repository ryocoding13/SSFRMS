namespace StorageProject.Core.Entities;

public class UserFacility
{
    public long UserFacilityId { get; set; }
    public long UserId { get; set; }
    public long FacilityId { get; set; }
    public long? AssignedBy { get; set; }
    public DateOnly AssignedFrom { get; set; }
    public DateOnly? AssignedTo { get; set; }
    public string Status { get; set; } = null!; // ACTIVE, ENDED, SUSPENDED
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public User? Assigner { get; set; }
}
