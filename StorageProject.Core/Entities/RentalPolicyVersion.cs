namespace StorageProject.Core.Entities;

public class RentalPolicyVersion
{
    public long PolicyVersionId { get; set; }
    public int Version { get; set; }
    public string DisplayVersion { get; set; } = null!;
    public decimal Rate { get; set; }
    public string SectionsJson { get; set; } = null!;
    public long PublishedBy { get; set; }
    public DateTime PublishedAt { get; set; }
    public bool IsCurrent { get; set; }

    public User PublishedByUser { get; set; } = null!;
    public ICollection<PolicyConsent> Consents { get; set; } = [];
}
