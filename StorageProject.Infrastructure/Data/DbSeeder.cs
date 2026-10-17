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
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Roles
        var requiredRoles = new List<(string Name, string Description)>
        {
            ("ADMIN", "Quản trị viên toàn quyền hệ thống"),
            ("MANAGER", "Quản lý cơ sở kho"),
            ("STAFF", "Nhân viên vận hành, bàn giao và kiểm tra kho"),
            ("OPERATIONS", "Quản lý vận hành kinh doanh toàn hệ thống"),
            ("BUSINESS_OPERATOR", "Quản lý vận hành kinh doanh toàn hệ thống"),
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

        var customerRole = await context.Roles.FirstAsync(r => r.RoleName == "CUSTOMER");
        var adminRole = await context.Roles.FirstAsync(r => r.RoleName == "ADMIN");
        var staffRole = await context.Roles.FirstAsync(r => r.RoleName == "STAFF");
        var managerRole = await context.Roles.FirstAsync(r => r.RoleName == "MANAGER");
        var businessOpRole = await context.Roles.FirstAsync(r => r.RoleName == "BUSINESS_OPERATOR");
        var opsRole = await context.Roles.FirstAsync(r => r.RoleName == "OPERATIONS");

        // 1.1 Permissions & RolePermissions
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

            // Assign all permissions to ADMIN role
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

        // Ensure STAFF, MANAGER, OPERATIONS & BUSINESS_OPERATOR permissions
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
                if (!await context.RolePermissions.AnyAsync(rp => rp.RoleId == businessOpRole.RoleId && rp.PermissionId == p.PermissionId))
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = businessOpRole.RoleId, PermissionId = p.PermissionId });
                }
                if (!await context.RolePermissions.AnyAsync(rp => rp.RoleId == opsRole.RoleId && rp.PermissionId == p.PermissionId))
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = opsRole.RoleId, PermissionId = p.PermissionId });
                }
            }
        }
        await context.SaveChangesAsync();

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

        // 2b. Vai trò Quản lý vận hành KD (OPERATIONS & BUSINESS_OPERATOR) + tài khoản ops01
        await EnsureOperationsRoleAsync(context);

        // 2c. Quyền của STAFF / MANAGER + tài khoản manager01, staff02 (BACKEND-TODO A1)
        await EnsureFacilityRolesAsync(context);

        // 3. Danh mục kho theo D17: 4 loại kho, 12 cơ sở, mỗi cơ sở 12 ô + bảng giá
        var catalog = await EnsureCatalogAsync(context, admin.UserId);

        // 4. Policies
        if (!await context.Policies.AnyAsync())
        {
            var policies = new List<Policy>
            {
                new()
                {
                    PolicyName = "Tiền đặt cọc tiêu chuẩn",
                    PolicyType = "DEPOSIT",
                    CalculationType = "PERCENTAGE",
                    Value = 100.0m, // 100% của 1 tháng tiền thuê
                    RuleDescription = "Khách hàng phải thanh toán tiền cọc tương đương 1 tháng tiền thuê khi ký hợp đồng",
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
                    Value = 0.0m, // Miễn phí hủy trước khi check-in
                    RuleDescription = "Miễn phí hủy đơn đặt chỗ trước thời điểm bắt đầu thuê",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    PolicyName = "Phí phạt quá hạn thanh toán",
                    PolicyType = "OVERDUE",
                    CalculationType = "PERCENTAGE",
                    Value = 5.0m, // 5% mỗi tuần trễ hạn
                    RuleDescription = "Tính phí phạt 5% trên số tiền nợ cho mỗi tuần quá hạn",
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

            context.Policies.AddRange(policies);
            await context.SaveChangesAsync();
        }

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

        var bizOpRole = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == "BUSINESS_OPERATOR");
        if (bizOpRole == null)
        {
            bizOpRole = new Role { RoleName = "BUSINESS_OPERATOR", Description = "Quản lý vận hành kinh doanh toàn hệ thống" };
            context.Roles.Add(bizOpRole);
            await context.SaveChangesAsync();
        }

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
                if (!existingPairs.Any(x => x.RoleId == bizOpRole.RoleId && x.PermissionId == perm.PermissionId))
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = bizOpRole.RoleId, PermissionId = perm.PermissionId });
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
}
