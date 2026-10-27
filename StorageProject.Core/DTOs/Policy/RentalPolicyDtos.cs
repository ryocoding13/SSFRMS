namespace StorageProject.Core.DTOs.Policy;

public record RentalPolicyDto(
    decimal Rate,
    Dictionary<string, string> Sections,
    int Version,
    string DisplayVersion,
    DateTime UpdatedAt
);

public record SaveRentalPolicyRequest(
    string Action,
    decimal? Rate,
    Dictionary<string, string>? Sections,
    int? Version
);

public record PolicyConsentRequest(
    int PolicyVersion,
    bool Accepted
);

public record PolicyConsentDto(
    long ConsentId,
    long CustomerId,
    int PolicyVersion,
    string DisplayVersion,
    DateTime AcceptedAt,
    string Channel
);
