using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class FacilityConfiguration : IEntityTypeConfiguration<Facility>
{
    public void Configure(EntityTypeBuilder<Facility> b)
    {
        b.ToTable("facilities", t =>
        {
            t.HasCheckConstraint("CK_facilities_status", "[Status] IN ('ACTIVE','INACTIVE','TEMPORARILY_CLOSED')");
        });
        b.HasKey(f => f.FacilityId);
        b.Property(f => f.FacilityId).UseIdentityColumn();
        b.Property(f => f.Name).IsRequired().HasMaxLength(150);
        b.Property(f => f.Address).IsRequired().HasMaxLength(255);
        b.Property(f => f.ContactPhone).HasMaxLength(20);
        b.Property(f => f.Status).IsRequired().HasMaxLength(30).HasDefaultValue("ACTIVE");
        b.Property(f => f.CreatedAt).IsRequired();
        b.Property(f => f.UpdatedAt).IsRequired();
    }
}

public class UserFacilityConfiguration : IEntityTypeConfiguration<UserFacility>
{
    public void Configure(EntityTypeBuilder<UserFacility> b)
    {
        b.ToTable("user_facilities", t =>
        {
            t.HasCheckConstraint("CK_user_facilities_status", "[Status] IN ('ACTIVE','ENDED','SUSPENDED')");
        });
        b.HasKey(uf => uf.UserFacilityId);
        b.Property(uf => uf.UserFacilityId).UseIdentityColumn();
        b.Property(uf => uf.AssignedFrom).IsRequired();
        b.Property(uf => uf.Status).IsRequired().HasMaxLength(20);
        b.Property(uf => uf.CreatedAt).IsRequired();

        b.HasOne(uf => uf.User).WithMany(u => u.UserFacilities)
            .HasForeignKey(uf => uf.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(uf => uf.Facility).WithMany(f => f.UserFacilities)
            .HasForeignKey(uf => uf.FacilityId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(uf => uf.Assigner).WithMany()
            .HasForeignKey(uf => uf.AssignedBy).OnDelete(DeleteBehavior.SetNull);
    }
}

public class LoginHistoryConfiguration : IEntityTypeConfiguration<LoginHistory>
{
    public void Configure(EntityTypeBuilder<LoginHistory> b)
    {
        b.ToTable("login_history", t =>
        {
            t.HasCheckConstraint("CK_login_history_status", "[LoginStatus] IN ('SUCCESS','FAILED','BLOCKED')");
        });
        b.HasKey(lh => lh.LoginHistoryId);
        b.Property(lh => lh.LoginHistoryId).UseIdentityColumn();
        b.Property(lh => lh.LoginAt).IsRequired();
        b.Property(lh => lh.IpAddress).HasMaxLength(45);
        b.Property(lh => lh.DeviceInfo).HasMaxLength(255);
        b.Property(lh => lh.LoginStatus).IsRequired().HasMaxLength(20);

        b.HasOne(lh => lh.User).WithMany(u => u.LoginHistories)
            .HasForeignKey(lh => lh.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> b)
    {
        b.ToTable("activity_logs");
        b.HasKey(al => al.LogId);
        b.Property(al => al.LogId).UseIdentityColumn();
        b.Property(al => al.Action).IsRequired().HasMaxLength(100);
        b.Property(al => al.EntityType).IsRequired().HasMaxLength(80);
        b.Property(al => al.IpAddress).HasMaxLength(45);
        b.Property(al => al.LoggedAt).IsRequired();

        b.HasOne(al => al.User).WithMany(u => u.ActivityLogs)
            .HasForeignKey(al => al.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}
