using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class UnitTypeConfiguration : IEntityTypeConfiguration<UnitType>
{
    public void Configure(EntityTypeBuilder<UnitType> b)
    {
        b.ToTable("unit_types", t =>
        {
            t.HasCheckConstraint("CK_unit_types_length", "[Length] IS NULL OR [Length] > 0");
            t.HasCheckConstraint("CK_unit_types_width", "[Width] IS NULL OR [Width] > 0");
            t.HasCheckConstraint("CK_unit_types_height", "[Height] IS NULL OR [Height] > 0");
            t.HasCheckConstraint("CK_unit_types_area", "[Area] > 0");
            t.HasCheckConstraint("CK_unit_types_status", "[Status] IN ('ACTIVE','INACTIVE')");
        });
        b.HasKey(ut => ut.UnitTypeId);
        b.Property(ut => ut.UnitTypeId).UseIdentityColumn();
        b.Property(ut => ut.TypeName).IsRequired().HasMaxLength(100);
        b.HasIndex(ut => ut.TypeName).IsUnique();
        b.Property(ut => ut.Length).HasColumnType("decimal(8,2)");
        b.Property(ut => ut.Width).HasColumnType("decimal(8,2)");
        b.Property(ut => ut.Height).HasColumnType("decimal(8,2)");
        b.Property(ut => ut.Area).IsRequired().HasColumnType("decimal(8,2)");
        b.Property(ut => ut.ClimateControlled).IsRequired().HasDefaultValue(false);
        b.Property(ut => ut.Description).HasMaxLength(500);
        b.Property(ut => ut.Status).IsRequired().HasMaxLength(20);
        b.Property(ut => ut.CreatedAt).IsRequired();
        b.Property(ut => ut.UpdatedAt).IsRequired();
    }
}

public class StorageUnitConfiguration : IEntityTypeConfiguration<StorageUnit>
{
    public void Configure(EntityTypeBuilder<StorageUnit> b)
    {
        b.ToTable("storage_units", t =>
        {
            t.HasCheckConstraint("CK_storage_units_status",
                "[Status] IN ('AVAILABLE','RESERVED','ASSIGNED','OCCUPIED','RETURN_PENDING','INSPECTION','MAINTENANCE','OUT_OF_SERVICE')");
        });
        b.HasKey(su => su.UnitId);
        b.Property(su => su.UnitId).UseIdentityColumn();
        b.Property(su => su.UnitNumber).IsRequired().HasMaxLength(30);
        b.HasIndex(su => new { su.FacilityId, su.UnitNumber }).IsUnique();
        b.Property(su => su.Floor).HasMaxLength(20);
        b.Property(su => su.Zone).HasMaxLength(50);
        b.Property(su => su.LocationDescription).HasMaxLength(255);
        b.Property(su => su.Status).IsRequired().HasMaxLength(30).HasDefaultValue("AVAILABLE");
        b.Property(su => su.CreatedAt).IsRequired();
        b.Property(su => su.UpdatedAt).IsRequired();

        b.HasOne(su => su.Facility).WithMany(f => f.StorageUnits)
            .HasForeignKey(su => su.FacilityId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(su => su.UnitType).WithMany(ut => ut.StorageUnits)
            .HasForeignKey(su => su.UnitTypeId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class UnitStatusHistoryConfiguration : IEntityTypeConfiguration<UnitStatusHistory>
{
    public void Configure(EntityTypeBuilder<UnitStatusHistory> b)
    {
        b.ToTable("unit_status_history");
        b.HasKey(h => h.StatusHistoryId);
        b.Property(h => h.StatusHistoryId).UseIdentityColumn();
        b.Property(h => h.OldStatus).HasMaxLength(30);
        b.Property(h => h.NewStatus).IsRequired().HasMaxLength(30);
        b.Property(h => h.Reason).HasMaxLength(255);
        b.Property(h => h.ChangedAt).IsRequired();

        b.HasOne(h => h.Unit).WithMany(su => su.StatusHistories)
            .HasForeignKey(h => h.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(h => h.ChangedByUser).WithMany()
            .HasForeignKey(h => h.ChangedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

public class RentalRateConfiguration : IEntityTypeConfiguration<RentalRate>
{
    public void Configure(EntityTypeBuilder<RentalRate> b)
    {
        b.ToTable("rental_rates", t =>
        {
            t.HasCheckConstraint("CK_rental_rates_monthly_rate", "[MonthlyRate] > 0");
            t.HasCheckConstraint("CK_rental_rates_status", "[Status] IN ('DRAFT','ACTIVE','EXPIRED','INACTIVE')");
        });
        b.HasKey(rr => rr.RateId);
        b.Property(rr => rr.RateId).UseIdentityColumn();
        b.Property(rr => rr.MonthlyRate).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(rr => rr.EffectiveFrom).IsRequired();
        b.Property(rr => rr.Status).IsRequired().HasMaxLength(20).HasDefaultValue("DRAFT");
        b.Property(rr => rr.CreatedAt).IsRequired();

        b.HasOne(rr => rr.Facility).WithMany(f => f.RentalRates)
            .HasForeignKey(rr => rr.FacilityId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(rr => rr.UnitType).WithMany(ut => ut.RentalRates)
            .HasForeignKey(rr => rr.UnitTypeId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(rr => rr.SetByUser).WithMany()
            .HasForeignKey(rr => rr.SetBy).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> b)
    {
        b.ToTable("policies", t =>
        {
            t.HasCheckConstraint("CK_policies_policy_type",
                "[PolicyType] IN ('DEPOSIT','RENEWAL','CANCELLATION','RETURN','OVERDUE','EXTRA_FEE','DISCOUNT','FEE_WAIVER','PRICE_RANGE')");
            t.HasCheckConstraint("CK_policies_calculation_type",
                "[CalculationType] IS NULL OR [CalculationType] IN ('FIXED','PERCENTAGE','RANGE','RULE')");
            t.HasCheckConstraint("CK_policies_status", "[Status] IN ('DRAFT','ACTIVE','INACTIVE','EXPIRED')");
        });
        b.HasKey(p => p.PolicyId);
        b.Property(p => p.PolicyId).UseIdentityColumn();
        b.Property(p => p.PolicyName).IsRequired().HasMaxLength(150);
        b.Property(p => p.PolicyType).IsRequired().HasMaxLength(30);
        b.Property(p => p.CalculationType).HasMaxLength(20);
        b.Property(p => p.Value).HasColumnType("decimal(15,2)");
        b.Property(p => p.MinValue).HasColumnType("decimal(15,2)");
        b.Property(p => p.MaxValue).HasColumnType("decimal(15,2)");
        b.Property(p => p.RuleDescription).IsRequired();
        b.Property(p => p.EffectiveFrom).IsRequired();
        b.Property(p => p.Status).IsRequired().HasMaxLength(20).HasDefaultValue("DRAFT");
        b.Property(p => p.CreatedAt).IsRequired();
        b.Property(p => p.UpdatedAt).IsRequired();

        b.HasOne(p => p.Facility).WithMany(f => f.Policies)
            .HasForeignKey(p => p.FacilityId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(p => p.UnitType).WithMany(ut => ut.Policies)
            .HasForeignKey(p => p.UnitTypeId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(p => p.CreatedByUser).WithMany()
            .HasForeignKey(p => p.CreatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
