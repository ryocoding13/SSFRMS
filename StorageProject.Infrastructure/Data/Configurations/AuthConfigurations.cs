using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> b)
    {
        b.ToTable("roles");
        b.HasKey(r => r.RoleId);
        b.Property(r => r.RoleId).UseIdentityColumn();
        b.Property(r => r.RoleName).IsRequired().HasMaxLength(50);
        b.HasIndex(r => r.RoleName).IsUnique();
        b.Property(r => r.Description).HasMaxLength(255);
    }
}

public class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> b)
    {
        b.ToTable("permissions");
        b.HasKey(p => p.PermissionId);
        b.Property(p => p.PermissionId).UseIdentityColumn();
        b.Property(p => p.PermissionCode).IsRequired().HasMaxLength(80);
        b.HasIndex(p => p.PermissionCode).IsUnique();
        b.Property(p => p.PermissionName).IsRequired().HasMaxLength(100);
        b.Property(p => p.Description).HasMaxLength(255);
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users", t =>
        {
            t.HasCheckConstraint("CK_users_status", "[Status] IN ('ACTIVE','INACTIVE','LOCKED','SUSPENDED')");
        });
        b.HasKey(u => u.UserId);
        b.Property(u => u.UserId).UseIdentityColumn();
        b.Property(u => u.Username).IsRequired().HasMaxLength(50);
        b.HasIndex(u => u.Username).IsUnique();
        b.Property(u => u.PasswordHash).IsRequired().HasMaxLength(255);
        b.Property(u => u.FullName).IsRequired().HasMaxLength(150);
        b.Property(u => u.Email).IsRequired().HasMaxLength(255);
        b.HasIndex(u => u.Email).IsUnique();
        b.Property(u => u.Phone).HasMaxLength(20);
        b.Property(u => u.Status).IsRequired().HasMaxLength(20).HasDefaultValue("ACTIVE");
        b.Property(u => u.CreatedAt).IsRequired();
        b.Property(u => u.UpdatedAt).IsRequired();
    }
}

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> b)
    {
        b.ToTable("user_roles");
        b.HasKey(ur => new { ur.UserId, ur.RoleId });
        b.Property(ur => ur.AssignedAt).IsRequired().HasDefaultValueSql("GETUTCDATE()");

        b.HasOne(ur => ur.User).WithMany(u => u.UserRoles)
            .HasForeignKey(ur => ur.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ur => ur.Role).WithMany(r => r.UserRoles)
            .HasForeignKey(ur => ur.RoleId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ur => ur.Assigner).WithMany()
            .HasForeignKey(ur => ur.AssignedBy).OnDelete(DeleteBehavior.SetNull);
    }
}

public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> b)
    {
        b.ToTable("role_permissions");
        b.HasKey(rp => new { rp.RoleId, rp.PermissionId });

        b.HasOne(rp => rp.Role).WithMany(r => r.RolePermissions)
            .HasForeignKey(rp => rp.RoleId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(rp => rp.Permission).WithMany(p => p.RolePermissions)
            .HasForeignKey(rp => rp.PermissionId).OnDelete(DeleteBehavior.Cascade);
    }
}
