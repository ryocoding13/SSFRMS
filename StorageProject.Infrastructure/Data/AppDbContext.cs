using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// Database Context chính của hệ thống SafeSpace (SSFRMS) dựa trên Entity Framework Core.
/// Quản lý kết nối, ánh xạ mô hình thực thể sang cơ sở dữ liệu quan hệ (SQL Server),
/// hỗ trợ kiểm toán, khóa đồng thời và thực thi các ràng buộc toàn vẹn nghiệp vụ.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // I. Phân hệ Người dùng, Vai trò & Phân quyền (User, Role & Authorization)
    /// <summary>Danh mục vai trò người dùng trong hệ thống (ADMIN, MANAGER, STAFF, CUSTOMER, OPERATIONS - D05/D16).</summary>
    public DbSet<Role> Roles => Set<Role>();
    /// <summary>Danh mục mã quyền hạn chi tiết trong hệ thống.</summary>
    public DbSet<Permission> Permissions => Set<Permission>();
    /// <summary>Tài khoản người dùng (khách hàng, nhân viên, quản lý, quản trị).</summary>
    public DbSet<User> Users => Set<User>();
    /// <summary>Thử thách xác thực và mã OTP đặt lại mật khẩu người dùng qua email (D35 / F43).</summary>
    public DbSet<PasswordResetChallenge> PasswordResetChallenges => Set<PasswordResetChallenge>();
    /// <summary>Yêu cầu tư vấn hỗ trợ chung của khách hàng khi chưa có hợp đồng (C12-0 / T19).</summary>
    public DbSet<SupportInquiry> SupportInquiries => Set<SupportInquiry>();
    /// <summary>Nội dung trao đổi, phản hồi cho các yêu cầu tư vấn hỗ trợ chung (T19).</summary>
    public DbSet<SupportInquiryReply> SupportInquiryReplies => Set<SupportInquiryReply>();
    /// <summary>Bảng liên kết gán vai trò cho người dùng (n-n).</summary>
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    /// <summary>Bảng liên kết phân quyền chi tiết cho từng vai trò (n-n).</summary>
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    // II. Phân hệ Cơ sở & Phân công Nhân sự (Facility & Staff Scope)
    /// <summary>Danh sách các chi nhánh cơ sở kho tự quản SafeSpace (D17: 12 cơ sở trên toàn quốc).</summary>
    public DbSet<Facility> Facilities => Set<Facility>();
    /// <summary>Phân công nhân viên / quản lý phụ trách cơ sở cụ thể (SRS A06: mỗi người 1 cơ sở).</summary>
    public DbSet<UserFacility> UserFacilities => Set<UserFacility>();

    // III. Phân hệ Nhật ký Hệ thống & Kiểm toán (System Logs & Audit Trail)
    /// <summary>Lịch sử các phiên đăng nhập của người dùng vào hệ thống.</summary>
    public DbSet<LoginHistory> LoginHistories => Set<LoginHistory>();
    /// <summary>Nhật ký vết kiểm toán (Audit Trail) ghi lại mọi thay đổi dữ liệu quan trọng.</summary>
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    // IV. Phân hệ Quản lý Ô kho & Mặt bằng (Storage Unit Management)
    /// <summary>Danh mục loại ô kho (D17: Kho thường & Kho lạnh, diện tích 15m² cỡ M và 30m² cỡ L).</summary>
    public DbSet<UnitType> UnitTypes => Set<UnitType>();
    /// <summary>Danh sách các ô kho vật lý cụ thể tại từng cơ sở (D17: 12 ô mỗi cơ sở, K01-K12).</summary>
    public DbSet<StorageUnit> StorageUnits => Set<StorageUnit>();
    /// <summary>Lịch sử thay đổi trạng thái của ô kho (AVAILABLE, RESERVED, OCCUPIED, MAINTENANCE...).</summary>
    public DbSet<UnitStatusHistory> UnitStatusHistories => Set<UnitStatusHistory>();

    // V. Phân hệ Giá thuê & Chính sách Nghiệp vụ (Pricing & Policy)
    /// <summary>Bảng giá thuê kho niêm yết theo từng cơ sở và loại ô kho (D16: chỉ áp dụng giá ACTIVE).</summary>
    public DbSet<RentalRate> RentalRates => Set<RentalRate>();
    /// <summary>Chính sách vận hành hệ thống (tiền cọc D09, phí hủy D40, ngày đệm D41, xử lý quá hạn D32).</summary>
    public DbSet<Policy> Policies => Set<Policy>();

    // VI. Phân hệ Đặt chỗ & Phân bổ (Reservation & Unit Allocation)
    /// <summary>Đơn đặt chỗ thuê kho trực tuyến của khách hàng (F02 / D02).</summary>
    public DbSet<Reservation> Reservations => Set<Reservation>();
    /// <summary>Lịch sử và quyết định phân bổ ô kho cho đơn đặt chỗ (M05 / D41).</summary>
    public DbSet<UnitAssignment> UnitAssignments => Set<UnitAssignment>();

    // VII. Phân hệ Hợp đồng Thuê kho (Rental Contract)
    /// <summary>Hợp đồng thuê kho chính thức giữa khách hàng và SafeSpace.</summary>
    public DbSet<RentalContract> RentalContracts => Set<RentalContract>();

    // VIII. Phân hệ Gia hạn & Phiên bản Điều khoản (Renewal & Policy Consent)
    /// <summary>Yêu cầu và hồ sơ gia hạn hợp đồng thuê kho (D32 / M01).</summary>
    public DbSet<ContractRenewal> ContractRenewals => Set<ContractRenewal>();
    /// <summary>Phiên thanh toán trực tuyến qua cổng PayOS / VietQR (D23 / D33).</summary>
    public DbSet<PaymentCheckout> PaymentCheckouts => Set<PaymentCheckout>();
    /// <summary>Phiên bản điều khoản hợp đồng thuê kho được công bố (BO07).</summary>
    public DbSet<RentalPolicyVersion> RentalPolicyVersions => Set<RentalPolicyVersion>();
    /// <summary>Bằng chứng đồng ý điều khoản chính sách của khách hàng khi đặt chỗ hoặc gia hạn.</summary>
    public DbSet<PolicyConsent> PolicyConsents => Set<PolicyConsent>();

    // IX. Phân hệ Thanh toán & Giao dịch (Payment & Financial Transactions)
    /// <summary>Các giao dịch thanh toán tiền thuê, tiền cọc, phí quá hạn và hoàn tiền (D09 / D32 / D42).</summary>
    public DbSet<Payment> Payments => Set<Payment>();

    // X. Phân hệ Bàn giao & Kiểm soát Ra vào (Check-in & Handover)
    /// <summary>Biên bản nhận bàn giao chìa khóa vật lý tại quầy (D26 / D36).</summary>
    public DbSet<HandoverRecord> HandoverRecords => Set<HandoverRecord>();
    /// <summary>Thông tin định danh mở cửa kho thông minh (mã QR, mã PIN 6 số, thẻ từ - D26 / D33).</summary>
    public DbSet<AccessCredential> AccessCredentials => Set<AccessCredential>();

    // XI. Phân hệ Trả kho & Kiểm tra Hiện trường (Return & Inspection)
    /// <summary>Biên bản kiểm tra tình trạng ô kho khi khách trả kho (D32 / D38 / D39).</summary>
    public DbSet<ReturnInspection> ReturnInspections => Set<ReturnInspection>();
    /// <summary>Ảnh bằng chứng đính kèm (trả kho, kiểm kê, sự cố, yêu cầu hỗ trợ, khấu trừ - D32 / D35 / D39).</summary>
    public DbSet<EvidencePhoto> EvidencePhotos => Set<EvidencePhoto>();

    // XII. Phân hệ Xử lý Quá hạn & Sự cố Cơ sở (Overdue & Facility Incidents)
    /// <summary>Hồ sơ theo dõi và xử lý hợp đồng quá hạn trả kho (D32: nhắc nhở, lập biên bản, di dời).</summary>
    public DbSet<OverdueCase> OverdueCases => Set<OverdueCase>();
    /// <summary>Hồ sơ ghi nhận và phương án bồi thường sự cố bất khả kháng tại cơ sở (D34 / T13).</summary>
    public DbSet<FacilityIncident> FacilityIncidents => Set<FacilityIncident>();

    // XIII. Phân hệ Chăm sóc Khách hàng & Hỗ trợ Kỹ thuật (Support & Issue Handling)
    /// <summary>Yêu cầu hỗ trợ kỹ thuật và khiếu nại của khách hàng trong kỳ thuê (C12 / D43).</summary>
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();

    // XIV. Phân hệ Bảo trì Cơ sở Vật chất (Facility Maintenance)
    /// <summary>Yêu cầu và phiếu theo dõi bảo trì, vệ sinh, sửa chữa cơ sở vật chất kho.</summary>
    public DbSet<MaintenanceRequest> MaintenanceRequests => Set<MaintenanceRequest>();

    /// <summary>
    /// Cấu hình mô hình thực thể (Fluent API) thông qua tự động quét các cấu hình trong Assembly.
    /// </summary>
    /// <param name="modelBuilder">Builder định nghĩa mô hình EF Core.</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
