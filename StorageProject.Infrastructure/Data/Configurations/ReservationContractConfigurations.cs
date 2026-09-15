using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data.Configurations;

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> b)
    {
        b.ToTable("reservations", t =>
        {
            t.HasCheckConstraint("CK_reservations_rental_period", "[RentalPeriodMonths] > 0");
            t.HasCheckConstraint("CK_reservations_quoted_rate", "[QuotedMonthlyRate] >= 0");
            t.HasCheckConstraint("CK_reservations_estimated_amount", "[EstimatedAmount] >= 0");
            t.HasCheckConstraint("CK_reservations_required_deposit", "[RequiredDeposit] >= 0");
            t.HasCheckConstraint("CK_reservations_status",
                "[Status] IN ('PENDING_PAYMENT','CONFIRMED','UNIT_ASSIGNED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW')");
        });
        b.HasKey(r => r.ReservationId);
        b.Property(r => r.ReservationId).UseIdentityColumn();
        b.Property(r => r.StartDate).IsRequired();
        b.Property(r => r.RentalPeriodMonths).IsRequired();
        b.Property(r => r.ExpectedEndDate).IsRequired();
        b.Property(r => r.QuotedMonthlyRate).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(r => r.EstimatedAmount).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(r => r.RequiredDeposit).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(r => r.Status).IsRequired().HasMaxLength(30).HasDefaultValue("PENDING_PAYMENT");
        b.Property(r => r.CancellationReason).HasMaxLength(500);
        b.Property(r => r.CreatedAt).IsRequired();

        b.HasOne(r => r.Customer).WithMany(u => u.Reservations)
            .HasForeignKey(r => r.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(r => r.Facility).WithMany(f => f.Reservations)
            .HasForeignKey(r => r.FacilityId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(r => r.UnitType).WithMany(ut => ut.Reservations)
            .HasForeignKey(r => r.UnitTypeId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class UnitAssignmentConfiguration : IEntityTypeConfiguration<UnitAssignment>
{
    public void Configure(EntityTypeBuilder<UnitAssignment> b)
    {
        b.ToTable("unit_assignments", t =>
        {
            t.HasCheckConstraint("CK_unit_assignments_status", "[Status] IN ('ACTIVE','REPLACED','CANCELLED')");
        });
        b.HasKey(ua => ua.AssignmentId);
        b.Property(ua => ua.AssignmentId).UseIdentityColumn();
        b.Property(ua => ua.Status).IsRequired().HasMaxLength(20).HasDefaultValue("ACTIVE");
        b.Property(ua => ua.AssignedAt).IsRequired();
        b.Property(ua => ua.Reason).HasMaxLength(255);

        b.HasOne(ua => ua.Reservation).WithMany(r => r.UnitAssignments)
            .HasForeignKey(ua => ua.ReservationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ua => ua.Unit).WithMany(su => su.UnitAssignments)
            .HasForeignKey(ua => ua.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(ua => ua.AssignedByUser).WithMany()
            .HasForeignKey(ua => ua.AssignedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

public class RentalContractConfiguration : IEntityTypeConfiguration<RentalContract>
{
    public void Configure(EntityTypeBuilder<RentalContract> b)
    {
        b.ToTable("rental_contracts", t =>
        {
            t.HasCheckConstraint("CK_rental_contracts_dates", "[EndDate] > [StartDate]");
            t.HasCheckConstraint("CK_rental_contracts_rate", "[AgreedMonthlyRate] >= 0");
            t.HasCheckConstraint("CK_rental_contracts_deposit", "[DepositAmount] >= 0");
            t.HasCheckConstraint("CK_rental_contracts_status",
                "[Status] IN ('DRAFT','ACTIVE','EXPIRING','OVERDUE','RETURN_PENDING','COMPLETED','TERMINATED','CANCELLED')");
        });
        b.HasKey(rc => rc.ContractId);
        b.Property(rc => rc.ContractId).UseIdentityColumn();
        // BR04: One reservation → at most one contract
        b.HasIndex(rc => rc.ReservationId).IsUnique();
        b.Property(rc => rc.StartDate).IsRequired();
        b.Property(rc => rc.EndDate).IsRequired();
        b.Property(rc => rc.AgreedMonthlyRate).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(rc => rc.DepositAmount).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(rc => rc.Status).IsRequired().HasMaxLength(30).HasDefaultValue("DRAFT");
        b.Property(rc => rc.TerminationReason).HasMaxLength(500);
        b.Property(rc => rc.CreatedAt).IsRequired();

        b.HasOne(rc => rc.Reservation).WithOne(r => r.RentalContract)
            .HasForeignKey<RentalContract>(rc => rc.ReservationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(rc => rc.Customer).WithMany(u => u.RentalContracts)
            .HasForeignKey(rc => rc.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(rc => rc.Unit).WithMany(su => su.RentalContracts)
            .HasForeignKey(rc => rc.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ContractRenewalConfiguration : IEntityTypeConfiguration<ContractRenewal>
{
    public void Configure(EntityTypeBuilder<ContractRenewal> b)
    {
        b.ToTable("contract_renewals", t =>
        {
            t.HasCheckConstraint("CK_contract_renewals_period", "[RenewalPeriodMonths] > 0");
            t.HasCheckConstraint("CK_contract_renewals_amount", "[RenewalAmount] >= 0");
            t.HasCheckConstraint("CK_contract_renewals_status",
                "[Status] IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')");
        });
        b.HasKey(cr => cr.RenewalId);
        b.Property(cr => cr.RenewalId).UseIdentityColumn();
        b.Property(cr => cr.OldEndDate).IsRequired();
        b.Property(cr => cr.NewEndDate).IsRequired();
        b.Property(cr => cr.RenewalPeriodMonths).IsRequired();
        b.Property(cr => cr.OldMonthlyRate).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(cr => cr.NewMonthlyRate).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(cr => cr.RenewalAmount).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(cr => cr.Status).IsRequired().HasMaxLength(20).HasDefaultValue("PENDING");
        b.Property(cr => cr.RequestedAt).IsRequired();
        b.Property(cr => cr.CreatedAt).IsRequired();

        b.HasOne(cr => cr.Contract).WithMany(rc => rc.ContractRenewals)
            .HasForeignKey(cr => cr.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(cr => cr.ApprovedByUser).WithMany()
            .HasForeignKey(cr => cr.ApprovedBy).OnDelete(DeleteBehavior.SetNull);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.ToTable("payments", t =>
        {
            t.HasCheckConstraint("CK_payments_payment_type",
                "[PaymentType] IN ('DEPOSIT','RENT','RENEWAL','EXTRA_FEE','OVERDUE_FEE','DAMAGE_FEE','CLEANING_FEE','LOST_KEY_FEE','ACCESS_CARD_FEE','REFUND')");
            t.HasCheckConstraint("CK_payments_amount", "[Amount] >= 0");
            t.HasCheckConstraint("CK_payments_payment_method",
                "[PaymentMethod] IN ('CASH','BANK_TRANSFER','CARD','E_WALLET','PAYMENT_GATEWAY')");
            t.HasCheckConstraint("CK_payments_status",
                "[Status] IN ('PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')");
        });
        b.HasKey(p => p.PaymentId);
        b.Property(p => p.PaymentId).UseIdentityColumn();
        b.Property(p => p.PaymentType).IsRequired().HasMaxLength(30);
        b.Property(p => p.Amount).IsRequired().HasColumnType("decimal(15,2)");
        b.Property(p => p.Currency).IsRequired().HasMaxLength(3).HasDefaultValue("VND");
        b.Property(p => p.PaymentMethod).IsRequired().HasMaxLength(30);
        b.Property(p => p.TransactionReference).HasMaxLength(150);
        b.HasIndex(p => p.TransactionReference).IsUnique().HasFilter("[TransactionReference] IS NOT NULL");
        b.Property(p => p.Status).IsRequired().HasMaxLength(30).HasDefaultValue("PENDING");
        b.Property(p => p.CreatedAt).IsRequired();
        b.Property(p => p.UpdatedAt).IsRequired();

        b.HasOne(p => p.Contract).WithMany(rc => rc.Payments)
            .HasForeignKey(p => p.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(p => p.Renewal).WithMany(cr => cr.Payments)
            .HasForeignKey(p => p.RenewalId).OnDelete(DeleteBehavior.SetNull);
    }
}
