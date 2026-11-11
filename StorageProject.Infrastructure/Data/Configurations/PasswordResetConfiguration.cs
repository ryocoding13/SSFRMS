using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

/// <summary>
/// Cấu hình ánh xạ thực thể Thử thách đặt lại mật khẩu (PasswordResetChallenge) sang bảng 'password_reset_challenges'.
/// Quản lý mã OTP băm HMAC, số lần thử sai, nonce chống phát lại và thời hạn hiệu lực của yêu cầu quên mật khẩu (D35/F43).
/// </summary>
public sealed class PasswordResetConfiguration : IEntityTypeConfiguration<PasswordResetChallenge>
{
    /// <summary>Cấu hình bảng password_reset_challenges, khóa chính 1-1 với User và các trường bảo mật.</summary>
    public void Configure(EntityTypeBuilder<PasswordResetChallenge> b)
    {
        b.ToTable("password_reset_challenges");
        b.HasKey(x => x.UserId);
        b.Property(x => x.UserId).ValueGeneratedNever();
        b.Property(x => x.Email).IsRequired().HasMaxLength(255);
        b.Property(x => x.CodeHash).IsRequired().HasMaxLength(64);
        b.Property(x => x.Nonce).IsRequired().HasMaxLength(32);
        b.Property(x => x.PasswordFingerprint).IsRequired().HasMaxLength(64);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
