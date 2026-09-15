using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // I. User, Role & Authorization
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    // II. Facility & Staff Scope
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<UserFacility> UserFacilities => Set<UserFacility>();

    // III. System Logs
    public DbSet<LoginHistory> LoginHistories => Set<LoginHistory>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    // IV. Storage Unit Management
    public DbSet<UnitType> UnitTypes => Set<UnitType>();
    public DbSet<StorageUnit> StorageUnits => Set<StorageUnit>();
    public DbSet<UnitStatusHistory> UnitStatusHistories => Set<UnitStatusHistory>();

    // V. Pricing & Policy
    public DbSet<RentalRate> RentalRates => Set<RentalRate>();
    public DbSet<Policy> Policies => Set<Policy>();

    // VI. Reservation
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<UnitAssignment> UnitAssignments => Set<UnitAssignment>();

    // VII. Rental Contract
    public DbSet<RentalContract> RentalContracts => Set<RentalContract>();

    // VIII. Renewal
    public DbSet<ContractRenewal> ContractRenewals => Set<ContractRenewal>();

    // IX. Payment
    public DbSet<Payment> Payments => Set<Payment>();

    // X. Check-in & Handover
    public DbSet<HandoverRecord> HandoverRecords => Set<HandoverRecord>();
    public DbSet<AccessCredential> AccessCredentials => Set<AccessCredential>();

    // XI. Return & Inspection
    public DbSet<ReturnInspection> ReturnInspections => Set<ReturnInspection>();

    // XII. Overdue Handling
    public DbSet<OverdueCase> OverdueCases => Set<OverdueCase>();

    // XIII. Support & Issue Handling
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();

    // XIV. Maintenance
    public DbSet<MaintenanceRequest> MaintenanceRequests => Set<MaintenanceRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
