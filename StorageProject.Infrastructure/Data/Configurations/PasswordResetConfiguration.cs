using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public sealed class PasswordResetConfiguration : IEntityTypeConfiguration<PasswordResetChallenge>
{
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
