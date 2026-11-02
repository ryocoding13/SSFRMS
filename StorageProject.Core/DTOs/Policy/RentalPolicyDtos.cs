namespace StorageProject.Core.DTOs.Policy;

/// <summary>
/// CancellationBankSupported / ReturnRequestSupported: server đã lưu tài khoản chính chủ khi huỷ đơn và
/// ảnh kho trống + tài khoản khi gửi trả kho (D32 / T08); giao diện chỉ mở hai luồng này khi cờ = true.
/// </summary>
public record RentalPolicyDto(
    decimal Rate,
    Dictionary<string, string> Sections,
    int Version,
    string DisplayVersion,
    DateTime UpdatedAt,
    bool CancellationBankSupported = true,
    bool ReturnRequestSupported = true
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
