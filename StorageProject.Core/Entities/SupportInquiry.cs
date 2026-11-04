namespace StorageProject.Core.Entities;

public sealed class SupportInquiry
{
    public long InquiryId { get; set; }
    public long CustomerId { get; set; }
    public long FacilityId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "OPEN";
    public int Version { get; set; } = 1;
    public Guid ClientRequestId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public User Customer { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public ICollection<SupportInquiryReply> Replies { get; set; } = [];
}

public sealed class SupportInquiryReply
{
    public long ReplyId { get; set; }
    public long InquiryId { get; set; }
    public long AuthorId { get; set; }
    public Guid ClientRequestId { get; set; }
    public string Note { get; set; } = "";
    public bool CloseRequested { get; set; }
    public DateTime CreatedAt { get; set; }
    public SupportInquiry Inquiry { get; set; } = null!;
    public User Author { get; set; } = null!;
}
