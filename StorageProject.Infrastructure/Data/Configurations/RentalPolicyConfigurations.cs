using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

/// <summary>
/// Cấu hình ánh xạ thực thể Phiên bản điều khoản thuê kho (RentalPolicyVersion) sang bảng 'rental_policy_versions'.
/// Quản lý nội dung các điều khoản, tỷ lệ giá, và đánh dấu phiên bản hiện hành đang áp dụng (BO07).
/// </summary>
public class RentalPolicyVersionConfiguration : IEntityTypeConfiguration<RentalPolicyVersion>
{
    /// <summary>Cấu hình bảng rental_policy_versions, ràng buộc CHECK số phiên bản và tỷ lệ.</summary>
    public void Configure(EntityTypeBuilder<RentalPolicyVersion> b)
    {
        b.ToTable("rental_policy_versions", t =>
        {
            t.HasCheckConstraint("CK_rental_policy_versions_rate", "[Rate] >= 0 AND [Rate] <= 100");
            t.HasCheckConstraint("CK_rental_policy_versions_version", "[Version] > 0");
        });

        b.HasKey(v => v.PolicyVersionId);
        b.Property(v => v.PolicyVersionId).UseIdentityColumn();
        b.Property(v => v.Version).IsRequired();
        b.HasIndex(v => v.Version).IsUnique();
        b.Property(v => v.DisplayVersion).IsRequired().HasMaxLength(50);
        b.Property(v => v.Rate).IsRequired().HasColumnType("decimal(5,2)");
        b.Property(v => v.SectionsJson).IsRequired();
        b.Property(v => v.PublishedBy).IsRequired();
        b.Property(v => v.PublishedAt).IsRequired();
        b.Property(v => v.IsCurrent).IsRequired().HasDefaultValue(false);

        b.HasOne(v => v.PublishedByUser)
            .WithMany()
            .HasForeignKey(v => v.PublishedBy)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(v => v.IsCurrent).HasFilter("[IsCurrent] = 1");
    }
}

/// <summary>
/// Cấu hình ánh xạ thực thể Chấp thuận điều khoản chính sách (PolicyConsent) sang bảng 'policy_consents'.
/// Lưu trữ bằng chứng khách hàng đã đọc và chấp thuận điều khoản hợp đồng khi đặt chỗ hoặc gia hạn (BO07).
/// </summary>
public class PolicyConsentConfiguration : IEntityTypeConfiguration<PolicyConsent>
{
    /// <summary>Cấu hình bảng policy_consents, khóa ngoại và chỉ mục tìm kiếm theo khách hàng/hợp đồng.</summary>
    public void Configure(EntityTypeBuilder<PolicyConsent> b)
    {
        b.ToTable("policy_consents");

        b.HasKey(c => c.ConsentId);
        b.Property(c => c.ConsentId).UseIdentityColumn();
        b.Property(c => c.CustomerId).IsRequired();
        b.Property(c => c.PolicyVersionId).IsRequired();
        b.Property(c => c.AcceptedAt).IsRequired();
        b.Property(c => c.Channel).IsRequired().HasMaxLength(30).HasDefaultValue("WEB_CUSTOMER");

        b.HasOne(c => c.Customer)
            .WithMany()
            .HasForeignKey(c => c.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(c => c.PolicyVersion)
            .WithMany(v => v.Consents)
            .HasForeignKey(c => c.PolicyVersionId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(c => c.Reservation)
            .WithMany(r => r.PolicyConsents)
            .HasForeignKey(c => c.ReservationId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(c => c.Contract)
            .WithMany(rc => rc.PolicyConsents)
            .HasForeignKey(c => c.ContractId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(c => c.Renewal)
            .WithMany(cr => cr.PolicyConsents)
            .HasForeignKey(c => c.RenewalId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(c => new { c.CustomerId, c.PolicyVersionId });
        b.HasIndex(c => c.ReservationId).HasFilter("[ReservationId] IS NOT NULL");
        b.HasIndex(c => c.RenewalId).HasFilter("[RenewalId] IS NOT NULL");
    }
}
