using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

/// <summary>
/// Cấu hình ánh xạ thực thể Cơ sở kho tự quản (Facility) sang bảng 'facilities'.
/// Quản lý thông tin chi nhánh, địa chỉ, số điện thoại, tọa độ địa lý (Latitude/Longitude) và trạng thái (D16/D17).
/// </summary>
public class FacilityConfiguration : IEntityTypeConfiguration<Facility>
{
    /// <summary>Cấu hình bảng facilities, ràng buộc tọa độ GPS và trạng thái hoạt động.</summary>
    public void Configure(EntityTypeBuilder<Facility> b)
    {
        b.ToTable("facilities", t =>
        {
            t.HasCheckConstraint("CK_facilities_status", "[Status] IN ('ACTIVE','INACTIVE','TEMPORARILY_CLOSED')");
            t.HasCheckConstraint("CK_facilities_coordinates",
                "([Latitude] IS NULL AND [Longitude] IS NULL) OR " +
                "([Latitude] BETWEEN -90 AND 90 AND [Longitude] BETWEEN -180 AND 180)");
        });
        b.HasKey(f => f.FacilityId);
        b.Property(f => f.FacilityId).UseIdentityColumn();
        b.Property(f => f.Name).IsRequired().HasMaxLength(150);
        b.Property(f => f.Address).IsRequired().HasMaxLength(255);
        b.Property(f => f.ContactPhone).HasMaxLength(20);
        b.Property(f => f.Latitude).HasPrecision(9, 6);
        b.Property(f => f.Longitude).HasPrecision(9, 6);
        b.Property(f => f.Status).IsRequired().HasMaxLength(30).HasDefaultValue("ACTIVE");
        b.Property(f => f.CreatedAt).IsRequired();
        b.Property(f => f.UpdatedAt).IsRequired();
    }
}

/// <summary>
/// Cấu hình ánh xạ thực thể Phân công nhân sự cơ sở (UserFacility) sang bảng 'user_facilities'.
/// Gán nhân viên và quản lý vào từng cơ sở kho cụ thể (SRS A06: mỗi người phụ trách 1 cơ sở).
/// </summary>
public class UserFacilityConfiguration : IEntityTypeConfiguration<UserFacility>
{
    /// <summary>Cấu hình bảng user_facilities, khóa chính, ràng buộc CHECK trạng thái và quan hệ khóa ngoại.</summary>
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

/// <summary>
/// Cấu hình ánh xạ thực thể Lịch sử đăng nhập (LoginHistory) sang bảng 'login_history'.
/// Lưu trữ dấu vết truy cập, địa chỉ IP, thông tin thiết bị và kết quả đăng nhập (SUCCESS, FAILED, BLOCKED).
/// </summary>
public class LoginHistoryConfiguration : IEntityTypeConfiguration<LoginHistory>
{
    /// <summary>Cấu hình bảng login_history, khóa chính và ràng buộc CHECK trạng thái đăng nhập.</summary>
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

/// <summary>
/// Cấu hình ánh xạ thực thể Nhật ký hoạt động kiểm toán (ActivityLog) sang bảng 'activity_logs'.
/// Ghi nhận chi tiết mọi hành vi thay đổi dữ liệu, thao tác nghiệp vụ quan trọng trong hệ thống.
/// </summary>
public class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    /// <summary>Cấu hình bảng activity_logs, khóa chính, loại đối tượng và liên kết người dùng.</summary>
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
