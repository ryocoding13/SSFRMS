namespace StorageProject.Core.Entities;

public class StorageUnit
{
    public long UnitId { get; set; }
    public long FacilityId { get; set; }
    public long UnitTypeId { get; set; }
    public string UnitNumber { get; set; } = null!;
    public string? Floor { get; set; }
    public string? Zone { get; set; }
    public string? LocationDescription { get; set; }
    // AVAILABLE, RESERVED, ASSIGNED, OCCUPIED, RETURN_PENDING, INSPECTION, MAINTENANCE, OUT_OF_SERVICE
    public string Status { get; set; } = "AVAILABLE";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Facility Facility { get; set; } = null!;
    public UnitType UnitType { get; set; } = null!;
    public ICollection<UnitStatusHistory> StatusHistories { get; set; } = [];
    public ICollection<UnitAssignment> UnitAssignments { get; set; } = [];
    public ICollection<RentalContract> RentalContracts { get; set; } = [];
    public ICollection<AccessCredential> AccessCredentials { get; set; } = [];
    public ICollection<SupportTicket> SupportTickets { get; set; } = [];
    public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = [];
}
