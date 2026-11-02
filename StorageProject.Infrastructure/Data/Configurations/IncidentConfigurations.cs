using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class FacilityIncidentConfiguration : IEntityTypeConfiguration<FacilityIncident>
{
    public void Configure(EntityTypeBuilder<FacilityIncident> b)
    {
        b.ToTable("facility_incidents", t =>
        {
            t.HasCheckConstraint("CK_facility_incidents_status",
                "[Status] IN ('DRAFT','PROPOSED','TRANSFER_PENDING','TRANSFERRED','TERMINATION_PENDING','TERMINATED')");
            t.HasCheckConstraint("CK_facility_incidents_proposal", "[Proposal] IS NULL OR [Proposal] IN ('TRANSFER','TERMINATE')");
            t.HasCheckConstraint("CK_facility_incidents_choice", "[ChoiceOption] IS NULL OR [ChoiceOption] IN ('TRANSFER','TERMINATE')");
            t.HasCheckConstraint("CK_facility_incidents_version", "[Version] > 0");
        });
        b.HasKey(i => i.IncidentId);
        b.Property(i => i.IncidentId).UseIdentityColumn();
        b.Property(i => i.CaseCode).IsRequired().HasMaxLength(40).IsUnicode(false);
        b.HasIndex(i => i.CaseCode).IsUnique();
        b.Property(i => i.Status).IsRequired().HasMaxLength(30).HasDefaultValue("DRAFT");
        b.Property(i => i.Version).IsRequired().HasDefaultValue(1);
        b.Property(i => i.Description).HasMaxLength(1000);
        b.Property(i => i.Proposal).HasMaxLength(20);
        b.Property(i => i.ChoiceOption).HasMaxLength(20);
        b.Property(i => i.ChoiceNote).HasMaxLength(1000);
        b.Property(i => i.RefundBankName).HasMaxLength(100);
        b.Property(i => i.RefundAccountNumber).HasMaxLength(19).IsUnicode(false);
        b.Property(i => i.RefundAccountHolder).HasMaxLength(150);
        b.Property(i => i.CurrentMonthRent).HasColumnType("decimal(15,2)");
        b.Property(i => i.UnusedRent).HasColumnType("decimal(15,2)");
        b.Property(i => i.CreatedAt).IsRequired();
        b.Property(i => i.UpdatedAt).IsRequired();

        // Mỗi hợp đồng chỉ một hồ sơ đang mở; một ô thay thế chỉ được giữ cho một hồ sơ (chống hai khách giữ cùng ô).
        b.HasIndex(i => i.ContractId).IsUnique()
            .HasFilter("[Status] IN ('DRAFT','PROPOSED','TRANSFER_PENDING','TERMINATION_PENDING')");
        b.HasIndex(i => i.TargetUnitId).IsUnique()
            .HasFilter("[TargetUnitId] IS NOT NULL AND [Status] IN ('PROPOSED','TRANSFER_PENDING')");
        b.HasIndex(i => new { i.FacilityId, i.Status });

        b.HasOne(i => i.Contract).WithMany()
            .HasForeignKey(i => i.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(i => i.OldUnit).WithMany()
            .HasForeignKey(i => i.OldUnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(i => i.TargetUnit).WithMany()
            .HasForeignKey(i => i.TargetUnitId).OnDelete(DeleteBehavior.Restrict);
    }
}
