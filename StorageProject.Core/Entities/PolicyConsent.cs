namespace StorageProject.Core.Entities;

/// <summary>
/// Bằng chứng điện tử ghi nhận khách hàng đã đồng ý với phiên bản điều khoản cho thuê (D32 / T20).
/// Lưu vết thời điểm chấp thuận, kênh chấp thuận (web hoặc quầy) theo từng đơn đặt chỗ, hợp đồng hoặc yêu cầu gia hạn.
/// </summary>
public class PolicyConsent
{
    /// <summary>Mã định danh bản ghi đồng ý điều khoản.</summary>
    public long ConsentId { get; set; }

    /// <summary>Mã khách hàng thực hiện chấp thuận.</summary>
    public long CustomerId { get; set; }

    /// <summary>Mã phiên bản điều khoản hợp đồng được chấp thuận.</summary>
    public long PolicyVersionId { get; set; }

    /// <summary>Mã đơn đặt chỗ tương ứng (nếu đồng ý lúc đặt chỗ ban đầu).</summary>
    public long? ReservationId { get; set; }

    /// <summary>Mã hợp đồng thuê tương ứng (nếu đồng ý lúc ký hợp đồng).</summary>
    public long? ContractId { get; set; }

    /// <summary>Mã yêu cầu gia hạn tương ứng (nếu đồng ý lúc gửi yêu cầu gia hạn kỳ mới).</summary>
    public long? RenewalId { get; set; }

    /// <summary>Thời điểm khách hàng bấm chấp thuận.</summary>
    public DateTime AcceptedAt { get; set; }

    /// <summary>Kênh chấp thuận: WEB_CUSTOMER (tự thao tác trên website) hoặc COUNTER_CUSTOMER (xác nhận tại quầy cơ sở).</summary>
    public string Channel { get; set; } = "WEB_CUSTOMER"; // WEB_CUSTOMER, COUNTER_CUSTOMER

    public User Customer { get; set; } = null!;
    public RentalPolicyVersion PolicyVersion { get; set; } = null!;
    public Reservation? Reservation { get; set; }
    public RentalContract? Contract { get; set; }
    public ContractRenewal? Renewal { get; set; }
}
