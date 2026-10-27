using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class PaymentCheckoutConfiguration : IEntityTypeConfiguration<PaymentCheckout>
{
    public void Configure(EntityTypeBuilder<PaymentCheckout> b)
    {
        b.ToTable("payment_checkouts", t =>
        {
            t.HasCheckConstraint("CK_payment_checkouts_amount", "[Amount] >= 0");
            t.HasCheckConstraint("CK_payment_checkouts_status",
                "[Status] IN ('PENDING','PAID','CANCELLED','EXPIRED')");
        });

        b.HasKey(c => c.CheckoutId);
        b.Property(c => c.CheckoutId).UseIdentityColumn();
        b.Property(c => c.PaymentId).IsRequired();
        b.Property(c => c.OrderCode).IsRequired();
        b.HasIndex(c => c.OrderCode).IsUnique();
        b.Property(c => c.Provider).IsRequired().HasMaxLength(30).HasDefaultValue("PAYOS");
        b.Property(c => c.Amount).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(c => c.Status).IsRequired().HasMaxLength(20).HasDefaultValue("PENDING");
        b.Property(c => c.CheckoutUrl).HasMaxLength(2000);
        b.Property(c => c.QrCode).HasMaxLength(2000);
        b.Property(c => c.ExpiresAt).IsRequired();
        b.Property(c => c.CreatedAt).IsRequired();
        b.Property(c => c.UpdatedAt).IsRequired();

        b.HasOne(c => c.Payment)
            .WithMany(p => p.Checkouts)
            .HasForeignKey(c => c.PaymentId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(c => c.PaymentId);
    }
}
