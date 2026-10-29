using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class EvidencePhotoConfiguration : IEntityTypeConfiguration<EvidencePhoto>
{
    public void Configure(EntityTypeBuilder<EvidencePhoto> b)
    {
        b.ToTable("evidence_photos", t =>
        {
            t.HasCheckConstraint("CK_evidence_photos_owner_type", "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT')");
            t.HasCheckConstraint("CK_evidence_photos_content_type", "[ContentType] IN ('image/jpeg','image/png')");
            t.HasCheckConstraint("CK_evidence_photos_size", "[SizeBytes] > 0 AND [SizeBytes] <= 5242880");
        });
        b.HasKey(p => p.PhotoId);
        b.Property(p => p.PhotoId).UseIdentityColumn();
        b.Property(p => p.OwnerType).IsRequired().HasMaxLength(30).IsUnicode(false);
        b.Property(p => p.FileName).IsRequired().HasMaxLength(200);
        b.Property(p => p.ContentType).IsRequired().HasMaxLength(20).IsUnicode(false);
        b.Property(p => p.Data).IsRequired();
        b.Property(p => p.CreatedAt).IsRequired();
        b.HasIndex(p => new { p.OwnerType, p.OwnerId });

        b.HasOne(p => p.UploadedByUser).WithMany()
            .HasForeignKey(p => p.UploadedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
