using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// Dữ liệu khởi tạo. Mọi bước đều "chỉ thêm phần còn thiếu", nên chạy lại nhiều lần vẫn an toàn và
/// database tạo từ trước cũng được bổ sung khi khởi động lại API.
/// - Danh mục kho theo D17 (Figma 14/10): xem DbSeeder.Catalog.cs
/// - Tài khoản nhân viên / quản lý cơ sở: xem DbSeeder.FacilityOps.cs
/// </summary>
public static partial class DbSeeder
{
    public static async Task SeedByModeAsync(AppDbContext context, string mode, string? adminPassword = null)
    {
        switch (mode?.Trim().ToLowerInvariant())
        {
            case "reference":
                await SeedReferenceAsync(context, adminPassword);
                break;
            case "staging":
                await SeedStagingAsync(context);
                break;
            case "development":
                await SeedAsync(context);
                await FacilityCoordinateSeeder.SeedAsync(context);
                break;
            case "none":
            default:
                break;
        }
    }

    public static async Task SeedReferenceAsync(AppDbContext context, string? adminPassword = null)
    {
        await EnsureRolesAndPermissionsAsync(context);
        var adminRole = await context.Roles.FirstAsync(r => r.RoleName == "ADMIN");
        var admin = await context.Users.FirstOrDefaultAsync(u => u.Username == "admin");
        if (admin == null && !string.IsNullOrWhiteSpace(adminPassword))
        {
            admin = new User
            {
                Username = "admin",
                Email = "admin@storage.vn",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                FullName = "Hệ Thống Admin",
                Phone = "0900000001",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Users.Add(admin);
            await context.SaveChangesAsync();
            context.UserRoles.Add(new UserRole { UserId = admin.UserId, RoleId = adminRole.RoleId, AssignedAt = DateTime.UtcNow });
            await context.SaveChangesAsync();
        }

        var creatorId = admin?.UserId ?? 1;
        await EnsureCatalogAsync(context, creatorId);
        await EnsurePoliciesAsync(context, creatorId);
        await EnsureRentalPolicyVersionsAsync(context, creatorId);
        await FacilityCoordinateSeeder.SeedAsync(context);
    }

    public static async Task SeedStagingAsync(AppDbContext context)
    {
        await SeedAsync(context);
        await FacilityCoordinateSeeder.SeedAsync(context);
    }

    public static async Task EnsureRolesAndPermissionsAsync(AppDbContext context)
    {
        var requiredRoles = new List<(string Name, string Description)>
        {
            ("ADMIN", "Quản trị viên toàn quyền hệ thống"),
            ("MANAGER", "Quản lý cơ sở kho"),
            ("STAFF", "Nhân viên vận hành, bàn giao và kiểm tra kho"),
            ("OPERATIONS", "Quản lý vận hành kinh doanh toàn hệ thống"), // L7: mã duy nhất cho Vận hành KD
            ("CUSTOMER", "Khách hàng thuê kho tự quản")
        };

        foreach (var r in requiredRoles)
        {
            if (!await context.Roles.AnyAsync(x => x.RoleName == r.Name))
            {
                context.Roles.Add(new Role { RoleName = r.Name, Description = r.Description });
            }
        }
        await context.SaveChangesAsync();

        var adminRole = await context.Roles.FirstAsync(r => r.RoleName == "ADMIN");
        var staffRole = await context.Roles.FirstAsync(r => r.RoleName == "STAFF");
        var managerRole = await context.Roles.FirstAsync(r => r.RoleName == "MANAGER");
        var opsRole = await context.Roles.FirstAsync(r => r.RoleName == "OPERATIONS");
        await MergeLegacyOperationsRoleAsync(context, opsRole);
        await ApplyPhien3DataFixesAsync(context);

        if (!await context.Permissions.AnyAsync())
        {
            var permissions = new List<Permission>
            {
                new() { PermissionCode = "USER_MANAGE", PermissionName = "Quản lý tài khoản", Description = "Tạo, sửa, đổi trạng thái và đặt lại mật khẩu người dùng" },
                new() { PermissionCode = "ROLE_MANAGE", PermissionName = "Quản lý vai trò", Description = "Gán và thu hồi vai trò người dùng" },
                new() { PermissionCode = "FACILITY_SCOPE_MANAGE", PermissionName = "Quản lý phạm vi cơ sở", Description = "Phân công cơ sở cho nhân viên và quản lý" },
                new() { PermissionCode = "AUDIT_LOG_VIEW", PermissionName = "Xem nhật ký kiểm toán", Description = "Xem lịch sử đăng nhập và nhật ký hoạt động hệ thống" },
                new() { PermissionCode = "FACILITY_MANAGE", PermissionName = "Quản lý cơ sở", Description = "Quản lý thông tin cơ sở và bảng giá" },
                new() { PermissionCode = "UNIT_MANAGE", PermissionName = "Quản lý kho", Description = "Quản lý phòng kho vật lý và trạng thái kho" },
                new() { PermissionCode = "ASSIGNMENT_MANAGE", PermissionName = "Phân bổ kho", Description = "Gán phòng kho cho đơn đặt chỗ của khách" },
                new() { PermissionCode = "HANDOVER_MANAGE", PermissionName = "Bàn giao kho", Description = "Thực hiện bàn giao và cấp credential" },
                new() { PermissionCode = "RETURN_MANAGE", PermissionName = "Kiểm tra trả kho", Description = "Kiểm tra tình trạng khi khách trả kho" },
                new() { PermissionCode = "RENEWAL_MANAGE", PermissionName = "Duyệt gia hạn", Description = "Kiểm tra và phê duyệt yêu cầu gia hạn hợp đồng" },
                new() { PermissionCode = "TICKET_MANAGE", PermissionName = "Xử lý hỗ trợ", Description = "Tiếp nhận và xử lý sự cố hỗ trợ khách hàng" },
                new() { PermissionCode = "PAYMENT_CONFIRM", PermissionName = "Xác nhận thanh toán", Description = "Xác nhận thu tiền mặt và chuyển khoản" },
                new() { PermissionCode = "REPORT_VIEW", PermissionName = "Xem báo cáo", Description = "Xem báo cáo kinh doanh và tỷ lệ sử dụng kho" },
                new() { PermissionCode = "POLICY_MANAGE", PermissionName = "Quản lý chính sách", Description = "Thiết lập chính sách thuê, khung giá, phí, giảm giá và miễn phí" },
                new() { PermissionCode = "REPORT_SYSTEM", PermissionName = "Xem báo cáo toàn hệ thống", Description = "Xem doanh thu và hiệu suất của mọi cơ sở" },
                new() { PermissionCode = "REPORT_EXPORT", PermissionName = "Xuất báo cáo", Description = "Xuất báo cáo toàn hệ thống ra tệp CSV" }
            };
            context.Permissions.AddRange(permissions);
            await context.SaveChangesAsync();

            var allPerms = await context.Permissions.ToListAsync();
            foreach (var perm in allPerms)
            {
                context.RolePermissions.Add(new RolePermission
                {
                    RoleId = adminRole.RoleId,
                    PermissionId = perm.PermissionId
                });
            }
            await context.SaveChangesAsync();
        }

        var allPermsList = await context.Permissions.ToListAsync();
        var staffPermCodes = new[] { "HANDOVER_MANAGE", "RETURN_MANAGE", "TICKET_MANAGE", "PAYMENT_CONFIRM" };
        var managerPermCodes = new[] { "HANDOVER_MANAGE", "RETURN_MANAGE", "TICKET_MANAGE", "PAYMENT_CONFIRM", "UNIT_MANAGE", "ASSIGNMENT_MANAGE", "RENEWAL_MANAGE", "REPORT_VIEW" };
        var bizOpPermCodes = new[] { "REPORT_VIEW", "AUDIT_LOG_VIEW", "FACILITY_MANAGE", "UNIT_MANAGE", "RENEWAL_MANAGE", "POLICY_MANAGE", "REPORT_SYSTEM", "REPORT_EXPORT" };

        foreach (var code in staffPermCodes)
        {
            var p = allPermsList.FirstOrDefault(x => x.PermissionCode == code);
            if (p != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == staffRole.RoleId && rp.PermissionId == p.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = staffRole.RoleId, PermissionId = p.PermissionId });
            }
        }
        foreach (var code in managerPermCodes)
        {
            var p = allPermsList.FirstOrDefault(x => x.PermissionCode == code);
            if (p != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == managerRole.RoleId && rp.PermissionId == p.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = managerRole.RoleId, PermissionId = p.PermissionId });
            }
        }
        foreach (var code in bizOpPermCodes)
        {
            var p = allPermsList.FirstOrDefault(x => x.PermissionCode == code);
            if (p != null)
            {
                if (!await context.RolePermissions.AnyAsync(rp => rp.RoleId == opsRole.RoleId && rp.PermissionId == p.PermissionId))
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = opsRole.RoleId, PermissionId = p.PermissionId });
                }
            }
        }
        await context.SaveChangesAsync();
    }

    public static async Task SeedAsync(AppDbContext context)
    {
        await EnsureRolesAndPermissionsAsync(context);

        var customerRole = await context.Roles.FirstAsync(r => r.RoleName == "CUSTOMER");
        var adminRole = await context.Roles.FirstAsync(r => r.RoleName == "ADMIN");
        var staffRole = await context.Roles.FirstAsync(r => r.RoleName == "STAFF");

        // 2. Users (Ensure essential admin, staff, manager, operator, and customer users)
        async Task<User> EnsureUserAsync(string username, string email, string fullName, string phone, string plainPassword, Role role)
        {
            var u = await context.Users.FirstOrDefaultAsync(x => x.Username == username);
            if (u == null)
            {
                u = new User
                {
                    Username = username,
                    Email = email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(plainPassword),
                    FullName = fullName,
                    Phone = phone,
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.Users.Add(u);
                await context.SaveChangesAsync();
            }

            if (!await context.UserRoles.AnyAsync(ur => ur.UserId == u.UserId && ur.RoleId == role.RoleId))
            {
                context.UserRoles.Add(new UserRole { UserId = u.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow });
                await context.SaveChangesAsync();
            }
            return u;
        }

        var admin = await EnsureUserAsync("admin", "admin@storage.vn", "Hệ Thống Admin", "0900000001", "Admin@123", adminRole);
        var staff = await EnsureUserAsync("staff01", "staff01@storage.vn", "Trần Nhân Viên", "0900000002", "Staff@123", staffRole);
        var cust1 = await EnsureUserAsync("customer01", "an.nguyen@example.com", "Nguyễn Văn An", "0901234567", "Customer@123", customerRole);
        var cust2 = await EnsureUserAsync("customer02", "mai.tran@example.com", "Trần Thị Mai", "0912345678", "Customer@123", customerRole);

        // 2b. Vai trò Quản lý vận hành KD (OPERATIONS, L7 đã gộp BUSINESS_OPERATOR) + tài khoản ops01
        await EnsureOperationsRoleAsync(context);

        // 2c. Quyền của STAFF / MANAGER + tài khoản manager01, staff02 (BACKEND-TODO A1)
        await EnsureFacilityRolesAsync(context);

        // 3. Danh mục kho theo D17: 4 loại kho, 12 cơ sở, mỗi cơ sở 12 ô + bảng giá
        var catalog = await EnsureCatalogAsync(context, admin.UserId);

        // 4. Policies
        await EnsurePoliciesAsync(context, admin.UserId);
        await EnsureRentalPolicyVersionsAsync(context, admin.UserId);

        // 5. Phân công cơ sở (SRS A06: mỗi nhân viên / quản lý 1 cơ sở)
        await EnsureFacilityAssignmentsAsync(context, catalog.Home.FacilityId, admin.UserId);

        // Phân công cơ sở cho ops01
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var opUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "ops01");
        if (opUser != null && !await context.UserFacilities.AnyAsync(uf => uf.UserId == opUser.UserId && uf.FacilityId == catalog.Home.FacilityId))
        {
            context.UserFacilities.Add(new UserFacility
            {
                UserId = opUser.UserId,
                FacilityId = catalog.Home.FacilityId,
                AssignedBy = admin.UserId,
                AssignedFrom = today.AddDays(-30),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Phiên 3 (05/11/2026), chạy mỗi lần khởi động và idempotent, không xoá dữ liệu:
    /// S06 chuyển ảnh quá hạn cũ (lưu nhầm loại RETURN_INSPECTION, tên tệp before_/after_) sang OVERDUE_BEFORE/AFTER;
    /// D36 huỷ các lịch nhận chìa khóa SCHEDULED hệ thống tự tạo trước đây mà khách chưa yêu cầu và chưa xác minh.
    /// </summary>
    public static async Task ApplyPhien3DataFixesAsync(AppDbContext context)
    {
        // Ảnh quá hạn chỉ đổi loại khi DB đã có ràng buộc CHECK mới (migration Phien3EvidenceOwnerTypes),
        // tránh lỗi khởi động khi nhóm tắt AutoMigrate và chưa áp migration.
        var ownerTypesReady = !context.Database.IsRelational()
            || (await context.Database.GetAppliedMigrationsAsync()).Contains("20261105120000_Phien3EvidenceOwnerTypes");
        var resolvedCaseIds = context.ActivityLogs
            .Where(l => l.Action == "OVERDUE_REMOVAL_RECORDED" && l.EntityType == "OVERDUE_CASE")
            .Select(l => l.EntityId);
        if (ownerTypesReady) await context.EvidencePhotos
            .Where(p => p.OwnerType == "RETURN_INSPECTION" && p.FileName.StartsWith("before_") && resolvedCaseIds.Contains(p.OwnerId))
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.OwnerType, "OVERDUE_BEFORE"));
        if (ownerTypesReady) await context.EvidencePhotos
            .Where(p => p.OwnerType == "RETURN_INSPECTION" && p.FileName.StartsWith("after_") && resolvedCaseIds.Contains(p.OwnerId))
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.OwnerType, "OVERDUE_AFTER"));

        await context.HandoverRecords
            .Where(h => h.Status == "SCHEDULED" && h.VerifiedAt == null
                        && h.Notes == "Chỉ ghi nhận nhận chìa khóa; không kích hoạt hợp đồng")
            .ExecuteUpdateAsync(u => u
                .SetProperty(h => h.Status, "CANCELLED")
                .SetProperty(h => h.Notes, "D36: huỷ lịch tự tạo; khách gửi yêu cầu nhận chìa khóa qua hỗ trợ khi cần"));
        context.ChangeTracker.Clear();
    }

    /// <summary>
    /// L7 (D40): gộp mã vai trò cũ BUSINESS_OPERATOR vào OPERATIONS. Chạy được nhiều lần, không xoá người dùng:
    /// người có vai trò cũ được gán OPERATIONS (nếu chưa có), sau đó gỡ quan hệ và vai trò cũ.
    /// </summary>
    public static async Task MergeLegacyOperationsRoleAsync(AppDbContext context, Role opsRole)
    {
        var legacy = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == "BUSINESS_OPERATOR");
        if (legacy == null) return;

        var legacyUsers = await context.UserRoles.Where(ur => ur.RoleId == legacy.RoleId).ToListAsync();
        var opsUserIds = await context.UserRoles.Where(ur => ur.RoleId == opsRole.RoleId).Select(ur => ur.UserId).ToListAsync();
        foreach (var ur in legacyUsers.Where(ur => !opsUserIds.Contains(ur.UserId)))
            context.UserRoles.Add(new UserRole { UserId = ur.UserId, RoleId = opsRole.RoleId, AssignedBy = ur.AssignedBy, AssignedAt = ur.AssignedAt });
        context.UserRoles.RemoveRange(legacyUsers);
        context.RolePermissions.RemoveRange(await context.RolePermissions.Where(rp => rp.RoleId == legacy.RoleId).ToListAsync());
        context.Roles.Remove(legacy);
        await context.SaveChangesAsync();
    }

    // ------------------------------------------------------------------------------------------
    // Quản lý vận hành kinh doanh (SRS: Business Operations Manager — UC19–UC23)
    // ------------------------------------------------------------------------------------------
    private static async Task EnsureOperationsRoleAsync(AppDbContext context)
    {
        var opsRole = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == "OPERATIONS");
        if (opsRole == null)
        {
            opsRole = new Role { RoleName = "OPERATIONS", Description = "Quản lý vận hành kinh doanh toàn hệ thống" };
            context.Roles.Add(opsRole);
            await context.SaveChangesAsync();
        }

        await MergeLegacyOperationsRoleAsync(context, opsRole);

        var newPermissions = new List<Permission>
        {
            new() { PermissionCode = "POLICY_MANAGE", PermissionName = "Quản lý chính sách", Description = "Thiết lập chính sách thuê, khung giá, phí, giảm giá và miễn phí" },
            new() { PermissionCode = "REPORT_SYSTEM", PermissionName = "Xem báo cáo toàn hệ thống", Description = "Xem doanh thu và hiệu suất của mọi cơ sở" },
            new() { PermissionCode = "REPORT_EXPORT", PermissionName = "Xuất báo cáo", Description = "Xuất báo cáo toàn hệ thống ra tệp CSV" }
        };
        foreach (var perm in newPermissions)
        {
            if (!await context.Permissions.AnyAsync(p => p.PermissionCode == perm.PermissionCode))
            {
                context.Permissions.Add(perm);
            }
        }
        await context.SaveChangesAsync();

        // ADMIN giữ toàn bộ quyền như thiết lập ban đầu
        var adminRole = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == "ADMIN");
        var opsCodes = new[] { "FACILITY_MANAGE", "POLICY_MANAGE", "REPORT_VIEW", "REPORT_SYSTEM", "REPORT_EXPORT", "UNIT_MANAGE", "RENEWAL_MANAGE", "AUDIT_LOG_VIEW" };
        var allPermissions = await context.Permissions.ToListAsync();
        var existingPairs = await context.RolePermissions.Select(rp => new { rp.RoleId, rp.PermissionId }).ToListAsync();

        foreach (var perm in allPermissions)
        {
            if (adminRole != null && !existingPairs.Any(x => x.RoleId == adminRole.RoleId && x.PermissionId == perm.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = adminRole.RoleId, PermissionId = perm.PermissionId });
            }
            if (opsCodes.Contains(perm.PermissionCode))
            {
                if (!existingPairs.Any(x => x.RoleId == opsRole.RoleId && x.PermissionId == perm.PermissionId))
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = opsRole.RoleId, PermissionId = perm.PermissionId });
                }
            }
        }
        await context.SaveChangesAsync();

        // Ensure user ops01
        var opsUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "ops01");
        if (opsUser == null)
        {
            opsUser = new User
            {
                Username = "ops01",
                Email = "ops01@storage.vn",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Ops@123"),
                FullName = "Lê Vận Hành",
                Phone = "0900000004",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Users.Add(opsUser);
            await context.SaveChangesAsync();
        }
        if (!await context.UserRoles.AnyAsync(ur => ur.UserId == opsUser.UserId && ur.RoleId == opsRole.RoleId))
        {
            context.UserRoles.Add(new UserRole { UserId = opsUser.UserId, RoleId = opsRole.RoleId, AssignedAt = DateTime.UtcNow });
            await context.SaveChangesAsync();
        }
    }

    public static async Task EnsurePoliciesAsync(AppDbContext context, long adminUserId)
    {
        if (!await context.Policies.AnyAsync())
        {
            var policies = new List<Policy>
            {
                new()
                {
                    PolicyName = "Tiền đặt cọc tiêu chuẩn",
                    PolicyType = "DEPOSIT",
                    CalculationType = "FIXED",
                    Value = 1.0m, // 1 tháng tiền thuê (D09, D32)
                    RuleDescription = "Khách hàng phải thanh toán tiền cọc tương đương 1 tháng tiền thuê khi ký hợp đồng (D09, D32)",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    PolicyName = "Phí hủy đặt chỗ",
                    PolicyType = "CANCELLATION",
                    CalculationType = "PERCENTAGE",
                    Value = 5.0m, // D40: phí huỷ 5% tiền cọc trước ngày bắt đầu (số tính trong RefundPolicy.CancelFeeRate)
                    RuleDescription = "Huỷ trước ngày bắt đầu thuê: phí 5% tiền cọc, hoàn đủ tiền thuê và 95% tiền cọc. Từ 0h ngày bắt đầu, tiền thuê tháng đó tính đủ (D40)",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    PolicyName = "Phí phạt quá hạn thanh toán",
                    PolicyType = "OVERDUE",
                    CalculationType = "DEPOSIT_PERCENT_PER_DAY",
                    Value = 5.0m, // 5% cọc ban đầu mỗi ngày trễ (D32)
                    RuleDescription = "Phí quá hạn: 5% tiền cọc ban đầu cho mỗi ngày trả kho trễ, tối đa 100% cọc, trừ vào tiền cọc",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    PolicyName = "Thời gian giữ chỗ đặt trước",
                    PolicyType = "RENEWAL",
                    CalculationType = "FIXED",
                    Value = 24.0m, // 24 giờ
                    RuleDescription = "Đơn đặt chỗ chưa thanh toán sẽ tự động hết hạn sau 24 giờ kể từ lúc tạo",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            };

            foreach (var policy in policies)
            {
                policy.CreatedBy = adminUserId;
            }

            context.Policies.AddRange(policies);
            await context.SaveChangesAsync();
        }
    }

    public static async Task EnsureRentalPolicyVersionsAsync(AppDbContext context, long adminUserId)
    {
        if (!await context.RentalPolicyVersions.AnyAsync())
        {
            var defaultSections = new Dictionary<string, string>
            {
                ["payment"] = "Hợp đồng và quyền mở kho được cấp sau khi hệ thống xác nhận thanh toán hoặc nhân viên xác nhận đã thu đủ tại quầy. Bạn sử dụng kho từ ngày bắt đầu hợp đồng; kiểm tra ngày bắt đầu, ngày hết hạn và trạng thái thanh toán trong Kho của tôi.",
                ["access"] = "QR chỉ sử dụng trong thời hạn hợp đồng. QR hết hiệu lực ngay khi hết hạn thuê hoặc khi yêu cầu trả kho được ghi nhận thành công. Chuyển hết đồ trước khi xác nhận trả kho; cần hỗ trợ ra vào sau đó thì liên hệ nhân viên cơ sở.",
                ["renewal"] = "Gửi yêu cầu để cơ sở kiểm tra kỳ thuê tiếp theo. Trong lúc chờ duyệt, ngày hết hạn giữ nguyên. Sau khi duyệt, thanh toán đủ tiền gia hạn qua PayOS hoặc tại quầy để cập nhật kỳ thuê. Không thu lại cọc; yêu cầu bị từ chối hiển thị lý do.",
                ["overdue"] = "Nếu quá hạn mà chưa trả kho, mỗi ngày trừ 5% giá trị cọc ban đầu, tối đa 100% cọc. Sau 20 ngày cọc còn 0 đ, nhân viên kho đưa đồ của khách ra ngoài. Khách hàng tự chịu trách nhiệm theo chính sách.",
                ["return"] = "Chuyển hết đồ trước khi xác nhận trả kho. Cơ sở kiểm tra kho, nhận lại chìa khóa và lập biên bản. Cọc, khoản chưa thanh toán và phí được đối soát; bạn xem được khấu trừ và số tiền hoàn. Không còn cọc thì số tiền hoàn bằng 0 đ.",
                ["cancellation"] = "Trước khi huỷ, kiểm tra điều kiện, khoản khấu trừ và tiền hoàn trên đơn. Chờ hoàn là cơ sở chưa ghi nhận hoàn thành chuyển tiền; Đã hoàn là giao dịch đã được xác nhận. Chưa nhận tiền thì liên hệ cơ sở kèm mã đơn/khoản hoàn.",
                ["support"] = "Xem ngày hết hạn, lịch sử thanh toán, lịch trừ cọc và tiến độ trả kho trong tài khoản. Bạn có thể gửi hỗ trợ tới cơ sở liên quan, kể cả khi chưa có hợp đồng, để được tư vấn loại kho phù hợp."
            };

            var initialVersion = new RentalPolicyVersion
            {
                Version = 1,
                DisplayVersion = "11/2026",
                Rate = 5.0m,
                SectionsJson = System.Text.Json.JsonSerializer.Serialize(defaultSections),
                PublishedBy = adminUserId,
                PublishedAt = DateTime.UtcNow,
                IsCurrent = true
            };

            context.RentalPolicyVersions.Add(initialVersion);
            await context.SaveChangesAsync();
        }
    }
}
