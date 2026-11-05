namespace StorageProject.Core.DTOs.Support;

public record InquiryActionRequest(string? Action, string? Id = null, long? FacilityId = null,
    string? Title = null, string? Description = null, string? Note = null, bool Close = false,
    int? ExpectedVersion = null, Guid? ClientRequestId = null);
public record InquiryReplyDto(string By, string Text, DateTime At, long AuthorId);
public record InquiryDto(string Id, long OwnerId, long FacilityId, string Customer, string Title,
    string Description, string Status, int Version, DateTime CreatedAt, IReadOnlyList<InquiryReplyDto> Responses);
