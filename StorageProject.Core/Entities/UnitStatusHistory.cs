namespace StorageProject.Core.Entities;

public class UnitStatusHistory
{
    public long StatusHistoryId { get; set; }
    public long UnitId { get; set; }
    public long ChangedBy { get; set; }
    public string? OldStatus { get; set; }
    public string NewStatus { get; set; } = null!;
    public string? Reason { get; set; }
    public DateTime ChangedAt { get; set; }

    public StorageUnit Unit { get; set; } = null!;
    public User ChangedByUser { get; set; } = null!;
}
