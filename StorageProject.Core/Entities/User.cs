namespace StorageProject.Core.Entities;

public class User
{
    public long UserId { get; set; }
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string? Phone { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, INACTIVE, LOCKED, SUSPENDED
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];
    public ICollection<UserFacility> UserFacilities { get; set; } = [];
    public ICollection<LoginHistory> LoginHistories { get; set; } = [];
    public ICollection<ActivityLog> ActivityLogs { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
    public ICollection<RentalContract> RentalContracts { get; set; } = [];
    public ICollection<SupportTicket> SupportTickets { get; set; } = [];
}
