using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

/// <summary>
/// Cấu hình ánh xạ thực thể Yêu cầu tư vấn hỗ trợ chung (SupportInquiry) sang bảng 'support_inquiries'.
/// Tiếp nhận câu hỏi, tư vấn của khách hàng khi chưa có hợp đồng thuê kho (C12-0 / T19).
/// Áp dụng kiểm soát xung đột đồng thời (ConcurrencyToken) qua cột Version.
/// </summary>
public sealed class SupportInquiryConfiguration : IEntityTypeConfiguration<SupportInquiry>
{
    /// <summary>Cấu hình bảng support_inquiries, khóa chính, ràng buộc CHECK trạng thái và chỉ mục.</summary>
    public void Configure(EntityTypeBuilder<SupportInquiry> b)
    {
        b.ToTable("support_inquiries", t => {
            t.HasCheckConstraint("CK_support_inquiries_status", "[Status] IN ('OPEN','WAITING_CUSTOMER','CLOSED')");
            t.HasCheckConstraint("CK_support_inquiries_version", "[Version] > 0");
        });
        b.HasKey(x => x.InquiryId);
        b.Property(x => x.InquiryId).UseIdentityColumn();
        b.Property(x => x.Title).IsRequired().HasMaxLength(100);
        b.Property(x => x.Description).IsRequired().HasMaxLength(1000);
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.CustomerId, x.ClientRequestId }).IsUnique();
        b.HasIndex(x => new { x.FacilityId, x.Status });
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Facility).WithMany().HasForeignKey(x => x.FacilityId).OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>
/// Cấu hình ánh xạ thực thể Phản hồi yêu cầu tư vấn (SupportInquiryReply) sang bảng 'support_inquiry_replies'.
/// Quản lý nội dung phản hồi giữa nhân viên cơ sở và khách hàng, kèm cơ chế idempotency qua ClientRequestId (T19).
/// </summary>
public sealed class SupportInquiryReplyConfiguration : IEntityTypeConfiguration<SupportInquiryReply>
{
    /// <summary>Cấu hình bảng support_inquiry_replies, khóa chính và quan hệ khóa ngoại xóa Cascade theo inquiry.</summary>
    public void Configure(EntityTypeBuilder<SupportInquiryReply> b)
    {
        b.ToTable("support_inquiry_replies");
        b.HasKey(x => x.ReplyId);
        b.Property(x => x.ReplyId).UseIdentityColumn();
        b.Property(x => x.Note).IsRequired().HasMaxLength(1000);
        b.HasIndex(x => new { x.InquiryId, x.AuthorId, x.ClientRequestId }).IsUnique();
        b.HasOne(x => x.Inquiry).WithMany(x => x.Replies).HasForeignKey(x => x.InquiryId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
    }
}
