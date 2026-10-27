using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class RentalPolicyService(AppDbContext dbContext) : IRentalPolicyService
{
    private static readonly string[] RequiredSections =
    [
        "payment", "access", "renewal", "overdue", "return", "cancellation", "support"
    ];

    private static readonly Dictionary<string, string> DefaultSections = new()
    {
        ["payment"] = "Hợp đồng và quyền mở kho được cấp sau khi hệ thống xác nhận thanh toán hoặc nhân viên xác nhận đã thu đủ tại quầy. Bạn sử dụng kho từ ngày bắt đầu hợp đồng; kiểm tra ngày bắt đầu, ngày hết hạn và trạng thái thanh toán trong Kho của tôi.",
        ["access"] = "QR chỉ sử dụng trong thời hạn hợp đồng. QR hết hiệu lực ngay khi hết hạn thuê hoặc khi yêu cầu trả kho được ghi nhận thành công. Chuyển hết đồ trước khi xác nhận trả kho; cần hỗ trợ ra vào sau đó thì liên hệ nhân viên cơ sở.",
        ["renewal"] = "Gửi yêu cầu để cơ sở kiểm tra kỳ thuê tiếp theo. Trong lúc chờ duyệt, ngày hết hạn giữ nguyên. Sau khi duyệt, thanh toán đủ tiền gia hạn qua PayOS hoặc tại quầy để cập nhật kỳ thuê. Không thu lại cọc; yêu cầu bị từ chối hiển thị lý do.",
        ["overdue"] = "Nếu quá hạn mà chưa trả kho, mỗi ngày trừ 5% giá trị cọc ban đầu, tối đa 100% cọc. Sau 20 ngày cọc còn 0 đ, nhân viên kho đưa đồ của khách ra ngoài. Khách hàng tự chịu trách nhiệm theo chính sách.",
        ["return"] = "Chuyển hết đồ trước khi xác nhận trả kho. Cơ sở kiểm tra kho, nhận lại chìa khóa và lập biên bản. Cọc, khoản chưa thanh toán và phí được đối soát; bạn xem được khấu trừ và số tiền hoàn. Không còn cọc thì số tiền hoàn bằng 0 đ.",
        ["cancellation"] = "Trước khi huỷ, kiểm tra điều kiện, khoản khấu trừ và tiền hoàn trên đơn. Chờ hoàn là cơ sở chưa ghi nhận hoàn thành chuyển tiền; Đã hoàn là giao dịch đã được xác nhận. Chưa nhận tiền thì liên hệ cơ sở kèm mã đơn/khoản hoàn.",
        ["support"] = "Xem ngày hết hạn, lịch sử thanh toán, lịch trừ cọc và tiến độ trả kho trong tài khoản. Bạn có thể gửi hỗ trợ tới cơ sở liên quan, kể cả khi chưa có hợp đồng, để được tư vấn loại kho phù hợp."
    };

    public async Task<RentalPolicyDto> GetCurrentPolicyAsync(CancellationToken ct = default)
    {
        var current = await dbContext.RentalPolicyVersions
            .AsNoTracking()
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(v => v.IsCurrent, ct);

        if (current == null)
        {
            return new RentalPolicyDto(
                Rate: 5.0m,
                Sections: DefaultSections,
                Version: 1,
                DisplayVersion: "11/2026",
                UpdatedAt: DateTime.UtcNow
            );
        }

        var sections = JsonSerializer.Deserialize<Dictionary<string, string>>(current.SectionsJson)
            ?? DefaultSections;

        return new RentalPolicyDto(
            Rate: current.Rate,
            Sections: sections,
            Version: current.Version,
            DisplayVersion: current.DisplayVersion,
            UpdatedAt: current.PublishedAt
        );
    }

    public async Task<RentalPolicyDto?> GetPolicyVersionAsync(int version, CancellationToken ct = default)
    {
        var policy = await dbContext.RentalPolicyVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Version == version, ct);

        if (policy == null) return null;

        var sections = JsonSerializer.Deserialize<Dictionary<string, string>>(policy.SectionsJson)
            ?? DefaultSections;

        return new RentalPolicyDto(
            Rate: policy.Rate,
            Sections: sections,
            Version: policy.Version,
            DisplayVersion: policy.DisplayVersion,
            UpdatedAt: policy.PublishedAt
        );
    }

    public async Task<RentalPolicyDto> SaveRentalPolicyAsync(long userId, SaveRentalPolicyRequest request, CancellationToken ct = default)
    {
        if (request.Action != "SAVE_RENTAL_POLICY")
        {
            throw new ArgumentException("Action không hợp lệ. Chỉ chấp nhận SAVE_RENTAL_POLICY.");
        }

        var rate = request.Rate ?? 5.0m;
        if (rate <= 0 || rate > 100)
        {
            throw new ArgumentException("Tỷ lệ khấu trừ mỗi ngày phải lớn hơn 0 và không quá 100%.");
        }

        if (request.Sections == null)
        {
            throw new ArgumentException("Vui lòng cung cấp nội dung các phần chính sách.");
        }

        foreach (var sec in RequiredSections)
        {
            if (!request.Sections.TryGetValue(sec, out var content) || string.IsNullOrWhiteSpace(content))
            {
                throw new ArgumentException($"Phần '{sec}' trong chính sách không được để trống.");
            }
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(ct);

        var current = await dbContext.RentalPolicyVersions
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(v => v.IsCurrent, ct);

        if (request.Version.HasValue && current != null && current.Version != request.Version.Value)
        {
            throw new InvalidOperationException("Phiên bản chính sách đã được thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        if (current != null)
        {
            current.IsCurrent = false;
        }

        var maxVersion = await dbContext.RentalPolicyVersions.MaxAsync(v => (int?)v.Version, ct) ?? 0;
        var nextVersion = maxVersion + 1;
        var now = DateTime.UtcNow;
        var vnNow = now.AddHours(7);
        var displayVersion = $"{vnNow.Month:D2}/{vnNow.Year}";

        var newPolicyVersion = new RentalPolicyVersion
        {
            Version = nextVersion,
            DisplayVersion = displayVersion,
            Rate = rate,
            SectionsJson = JsonSerializer.Serialize(request.Sections),
            PublishedBy = userId,
            PublishedAt = now,
            IsCurrent = true
        };

        dbContext.RentalPolicyVersions.Add(newPolicyVersion);

        // Keep OVERDUE policy table in sync with the new rate
        var overduePolicy = await dbContext.Policies
            .FirstOrDefaultAsync(p => p.PolicyType == "OVERDUE" && p.Status == "ACTIVE", ct);

        if (overduePolicy != null)
        {
            overduePolicy.Value = rate;
            overduePolicy.UpdatedAt = now;
        }

        // Audit log
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            EntityType = "RENTAL_POLICY",
            EntityId = nextVersion,
            Action = "RENTAL_POLICY_PUBLISHED",
            NewValue = JsonSerializer.Serialize(new { version = nextVersion, displayVersion, rate }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new RentalPolicyDto(
            Rate: rate,
            Sections: request.Sections,
            Version: nextVersion,
            DisplayVersion: displayVersion,
            UpdatedAt: now
        );
    }

    public async Task<PolicyConsentDto> RecordReservationConsentAsync(long customerId, long reservationId, PolicyConsentRequest request, string channel = "WEB_CUSTOMER", CancellationToken ct = default)
    {
        if (!request.Accepted)
        {
            throw new ArgumentException("Bạn phải chấp nhận chính sách cho thuê để tiếp tục.");
        }

        var reservation = await dbContext.Reservations
            .SingleOrDefaultAsync(r => r.ReservationId == reservationId && r.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn đặt chỗ của bạn.");

        var currentVersion = await dbContext.RentalPolicyVersions
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(v => v.IsCurrent, ct);

        var expectedVersion = currentVersion?.Version ?? 1;
        if (request.PolicyVersion != expectedVersion)
        {
            throw new InvalidOperationException("Phiên bản chính sách không còn hiệu lực. Vui lòng tải lại trang để chấp thuận bản mới nhất.");
        }

        var consent = new PolicyConsent
        {
            CustomerId = customerId,
            PolicyVersionId = currentVersion?.PolicyVersionId ?? 1,
            ReservationId = reservationId,
            AcceptedAt = DateTime.UtcNow,
            Channel = channel
        };

        dbContext.PolicyConsents.Add(consent);
        await dbContext.SaveChangesAsync(ct);

        return new PolicyConsentDto(
            ConsentId: consent.ConsentId,
            CustomerId: customerId,
            PolicyVersion: expectedVersion,
            DisplayVersion: currentVersion?.DisplayVersion ?? "11/2026",
            AcceptedAt: consent.AcceptedAt,
            Channel: consent.Channel
        );
    }

    public async Task<PolicyConsentDto> RecordRenewalConsentAsync(long customerId, long renewalId, PolicyConsentRequest request, string channel = "WEB_CUSTOMER", CancellationToken ct = default)
    {
        if (!request.Accepted)
        {
            throw new ArgumentException("Bạn phải chấp nhận chính sách cho thuê để tiếp tục.");
        }

        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract)
            .SingleOrDefaultAsync(r => r.RenewalId == renewalId && r.Contract.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy yêu cầu gia hạn.");

        var currentVersion = await dbContext.RentalPolicyVersions
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(v => v.IsCurrent, ct);

        var expectedVersion = currentVersion?.Version ?? 1;
        if (request.PolicyVersion != expectedVersion)
        {
            throw new InvalidOperationException("Phiên bản chính sách không còn hiệu lực. Vui lòng tải lại trang để chấp thuận bản mới nhất.");
        }

        var consent = new PolicyConsent
        {
            CustomerId = customerId,
            PolicyVersionId = currentVersion?.PolicyVersionId ?? 1,
            RenewalId = renewalId,
            ContractId = renewal.ContractId,
            AcceptedAt = DateTime.UtcNow,
            Channel = channel
        };

        renewal.PolicyVersion = expectedVersion;
        renewal.AcceptedAt = consent.AcceptedAt;

        dbContext.PolicyConsents.Add(consent);
        await dbContext.SaveChangesAsync(ct);

        return new PolicyConsentDto(
            ConsentId: consent.ConsentId,
            CustomerId: customerId,
            PolicyVersion: expectedVersion,
            DisplayVersion: currentVersion?.DisplayVersion ?? "11/2026",
            AcceptedAt: consent.AcceptedAt,
            Channel: consent.Channel
        );
    }
}
