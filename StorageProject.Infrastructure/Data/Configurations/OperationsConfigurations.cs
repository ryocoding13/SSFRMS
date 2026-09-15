using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class HandoverRecordConfiguration : IEntityTypeConfiguration<HandoverRecord>
{
    public void Configure(EntityTypeBuilder<HandoverRecord> b)
    {
        b.ToTable("handover_records", t =>
        {
            t.HasCheckConstraint("CK_handover_records_status",
                "[Status] IN ('SCHEDULED','VERIFIED','HANDED_OVER','CANCELLED')");
        });
        b.HasKey(h => h.HandoverId);
        b.Property(h => h.HandoverId).UseIdentityColumn();
        // One handover per contract (UNIQUE)
        b.HasIndex(h => h.ContractId).IsUnique();
        b.Property(h => h.InitialCondition).HasMaxLength(500);
        b.Property(h => h.CustomerConfirmed).IsRequired().HasDefaultValue(false);
        b.Property(h => h.StaffConfirmed).IsRequired().HasDefaultValue(false);
        b.Property(h => h.Status).IsRequired().HasMaxLength(20).HasDefaultValue("SCHEDULED");
        b.Property(h => h.CreatedAt).IsRequired();

        b.HasOne(h => h.Contract).WithOne(rc => rc.HandoverRecord)
            .HasForeignKey<HandoverRecord>(h => h.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(h => h.Staff).WithMany()
            .HasForeignKey(h => h.StaffId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class AccessCredentialConfiguration : IEntityTypeConfiguration<AccessCredential>
{
    public void Configure(EntityTypeBuilder<AccessCredential> b)
    {
        b.ToTable("access_credentials", t =>
        {
            t.HasCheckConstraint("CK_access_credentials_type",
                "[CredentialType] IN ('KEY','LOCK','ACCESS_CARD','ACCESS_CODE')");
            t.HasCheckConstraint("CK_access_credentials_status",
                "[Status] IN ('ACTIVE','RETURNED','LOST','REVOKED','REPLACED')");
        });
        b.HasKey(ac => ac.CredentialId);
        b.Property(ac => ac.CredentialId).UseIdentityColumn();
        b.Property(ac => ac.CredentialType).IsRequired().HasMaxLength(20);
        b.Property(ac => ac.CredentialReference).HasMaxLength(100);
        b.Property(ac => ac.SecretHash).HasMaxLength(255);
        b.Property(ac => ac.IssuedAt).IsRequired();
        b.Property(ac => ac.Status).IsRequired().HasMaxLength(20).HasDefaultValue("ACTIVE");

        b.HasOne(ac => ac.Contract).WithMany(rc => rc.AccessCredentials)
            .HasForeignKey(ac => ac.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ac => ac.Unit).WithMany(su => su.AccessCredentials)
            .HasForeignKey(ac => ac.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ac => ac.IssuedByUser).WithMany()
            .HasForeignKey(ac => ac.IssuedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ReturnInspectionConfiguration : IEntityTypeConfiguration<ReturnInspection>
{
    public void Configure(EntityTypeBuilder<ReturnInspection> b)
    {
        b.ToTable("return_inspections", t =>
        {
            t.HasCheckConstraint("CK_return_inspections_condition",
                "[ConditionStatus] IS NULL OR [ConditionStatus] IN ('GOOD','DIRTY','DAMAGED','MAINTENANCE_REQUIRED')");
            t.HasCheckConstraint("CK_return_inspections_status",
                "[Status] IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')");
        });
        b.HasKey(ri => ri.InspectionId);
        b.Property(ri => ri.InspectionId).UseIdentityColumn();
        b.Property(ri => ri.ConditionStatus).HasMaxLength(30);
        b.Property(ri => ri.CleaningRequired).IsRequired().HasDefaultValue(false);
        b.Property(ri => ri.MaintenanceRequired).IsRequired().HasDefaultValue(false);
        b.Property(ri => ri.DamageFee).IsRequired().HasColumnType("decimal(15,2)").HasDefaultValue(0m);
        b.Property(ri => ri.CleaningFee).IsRequired().HasColumnType("decimal(15,2)").HasDefaultValue(0m);
        b.Property(ri => ri.Status).IsRequired().HasMaxLength(20).HasDefaultValue("SCHEDULED");
        b.Property(ri => ri.CreatedAt).IsRequired();

        b.HasOne(ri => ri.Contract).WithMany(rc => rc.ReturnInspections)
            .HasForeignKey(ri => ri.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ri => ri.Staff).WithMany()
            .HasForeignKey(ri => ri.StaffId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class OverdueCaseConfiguration : IEntityTypeConfiguration<OverdueCase>
{
    public void Configure(EntityTypeBuilder<OverdueCase> b)
    {
        b.ToTable("overdue_cases", t =>
        {
            t.HasCheckConstraint("CK_overdue_cases_status",
                "[Status] IN ('OPEN','CONTACTED','PAYMENT_PENDING','RETURN_PENDING','RESOLVED','ESCALATED')");
        });
        b.HasKey(oc => oc.OverdueCaseId);
        b.Property(oc => oc.OverdueCaseId).UseIdentityColumn();
        b.Property(oc => oc.OverdueFrom).IsRequired();
        b.Property(oc => oc.OutstandingAmount).IsRequired().HasColumnType("decimal(15,2)").HasDefaultValue(0m);
        b.Property(oc => oc.Status).IsRequired().HasMaxLength(30).HasDefaultValue("OPEN");
        b.Property(oc => oc.OpenedAt).IsRequired();

        b.HasOne(oc => oc.Contract).WithMany(rc => rc.OverdueCases)
            .HasForeignKey(oc => oc.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(oc => oc.AssignedStaff).WithMany()
            .HasForeignKey(oc => oc.AssignedStaffId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class SupportTicketConfiguration : IEntityTypeConfiguration<SupportTicket>
{
    public void Configure(EntityTypeBuilder<SupportTicket> b)
    {
        b.ToTable("support_tickets", t =>
        {
            t.HasCheckConstraint("CK_support_tickets_issue_type",
                "[IssueType] IN ('UNIT','LOCK','ACCESS_CODE','ACCESS_CARD','PAYMENT','STORED_ITEM','OTHER')");
            t.HasCheckConstraint("CK_support_tickets_priority",
                "[Priority] IN ('LOW','NORMAL','HIGH','URGENT')");
            t.HasCheckConstraint("CK_support_tickets_status",
                "[Status] IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')");
        });
        b.HasKey(st => st.TicketId);
        b.Property(st => st.TicketId).UseIdentityColumn();
        b.Property(st => st.IssueType).IsRequired().HasMaxLength(30);
        b.Property(st => st.Title).IsRequired().HasMaxLength(150);
        b.Property(st => st.Description).IsRequired();
        b.Property(st => st.Priority).IsRequired().HasMaxLength(20).HasDefaultValue("NORMAL");
        b.Property(st => st.Status).IsRequired().HasMaxLength(20).HasDefaultValue("OPEN");
        b.Property(st => st.CreatedAt).IsRequired();

        b.HasOne(st => st.Customer).WithMany(u => u.SupportTickets)
            .HasForeignKey(st => st.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(st => st.Contract).WithMany(rc => rc.SupportTickets)
            .HasForeignKey(st => st.ContractId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(st => st.Unit).WithMany(su => su.SupportTickets)
            .HasForeignKey(st => st.UnitId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(st => st.AssignedStaff).WithMany()
            .HasForeignKey(st => st.AssignedStaffId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class MaintenanceRequestConfiguration : IEntityTypeConfiguration<MaintenanceRequest>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequest> b)
    {
        b.ToTable("maintenance_requests", t =>
        {
            t.HasCheckConstraint("CK_maintenance_requests_type",
                "[MaintenanceType] IN ('INSPECTION','REPAIR','CLEANING','LOCK','ACCESS_SYSTEM','OTHER')");
            t.HasCheckConstraint("CK_maintenance_requests_priority",
                "[Priority] IN ('LOW','NORMAL','HIGH','URGENT')");
            t.HasCheckConstraint("CK_maintenance_requests_status",
                "[Status] IN ('OPEN','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')");
        });
        b.HasKey(mr => mr.MaintenanceId);
        b.Property(mr => mr.MaintenanceId).UseIdentityColumn();
        b.Property(mr => mr.MaintenanceType).IsRequired().HasMaxLength(30);
        b.Property(mr => mr.IssueDescription).IsRequired();
        b.Property(mr => mr.Priority).IsRequired().HasMaxLength(20).HasDefaultValue("NORMAL");
        b.Property(mr => mr.Cost).IsRequired().HasColumnType("decimal(15,2)").HasDefaultValue(0m);
        b.Property(mr => mr.Status).IsRequired().HasMaxLength(20).HasDefaultValue("OPEN");
        b.Property(mr => mr.CreatedAt).IsRequired();

        b.HasOne(mr => mr.Unit).WithMany(su => su.MaintenanceRequests)
            .HasForeignKey(mr => mr.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(mr => mr.SupportTicket).WithMany(st => st.MaintenanceRequests)
            .HasForeignKey(mr => mr.SupportTicketId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(mr => mr.ReportedByUser).WithMany()
            .HasForeignKey(mr => mr.ReportedBy).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(mr => mr.AssignedStaff).WithMany()
            .HasForeignKey(mr => mr.AssignedStaffId).OnDelete(DeleteBehavior.SetNull);
    }
}
