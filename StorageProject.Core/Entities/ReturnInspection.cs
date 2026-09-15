namespace StorageProject.Core.Entities;

public class ReturnInspection
{
    public long InspectionId { get; set; }
    public long ContractId { get; set; }
    public long StaffId { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? InspectedAt { get; set; }
    public string? ConditionStatus { get; set; } // GOOD, DIRTY, DAMAGED, MAINTENANCE_REQUIRED
    public string? DamageDescription { get; set; }
    public bool CleaningRequired { get; set; } = false;
    public bool MaintenanceRequired { get; set; } = false;
    public decimal DamageFee { get; set; } = 0;
    public decimal CleaningFee { get; set; } = 0;
    public string? Notes { get; set; }
    public string Status { get; set; } = "SCHEDULED"; // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    public DateTime CreatedAt { get; set; }

    public RentalContract Contract { get; set; } = null!;
    public User Staff { get; set; } = null!;
}
