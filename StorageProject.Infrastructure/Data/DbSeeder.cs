using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// Dữ liệu khởi tạo. Mọi bước đều "chỉ thêm phần còn thiếu", nên chạy lại nhiều lần vẫn an toàn và
/// database tạo từ trước cũng được bổ sung khi khởi động lại API.
/// - Danh mục kho theo D17 (Figma 14/10): xem DbSeeder.Catalog.cs
/// - Tài khoản nhân viên / quản lý cơ sở và dữ liệu vận hành mẫu: xem DbSeeder.FacilityOps.cs
/// </summary>
public static partial class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Roles
        if (!await context.Roles.AnyAsync())
        {
            var roles = new List<Role>
            {
                new() { RoleName = "ADMIN", Description = "Quản trị viên toàn quyền hệ thống" },
                new() { RoleName = "MANAGER", Description = "Quản lý cơ sở kho" },
                new() { RoleName = "STAFF", Description = "Nhân viên vận hành, bàn giao và kiểm tra kho" },
                new() { RoleName = "CUSTOMER", Description = "Khách hàng thuê kho tự quản" }
            };
            context.Roles.AddRange(roles);
            await context.SaveChangesAsync();
        }

        var customerRole = await context.Roles.FirstAsync(r => r.RoleName == "CUSTOMER");
        var adminRole = await context.Roles.FirstAsync(r => r.RoleName == "ADMIN");
        var staffRole = await context.Roles.FirstAsync(r => r.RoleName == "STAFF");

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
                new() { PermissionCode = "REPORT_VIEW", PermissionName = "Xem báo cáo", Description = "Xem báo cáo kinh doanh và tỷ lệ sử dụng kho" }
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

        // 2. Users
        if (!await context.Users.AnyAsync())
        {
            var adminUser = new User
            {
                Username = "admin",
                Email = "admin@storage.vn",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                FullName = "Hệ Thống Admin",
                Phone = "0900000001",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var staffUser = new User
            {
                Username = "staff01",
                Email = "staff01@storage.vn",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Staff@123"),
                FullName = "Trần Nhân Viên",
                Phone = "0900000002",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var customer01 = new User
            {
                Username = "customer01",
                Email = "an.nguyen@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Customer@123"),
                FullName = "Nguyễn Văn An",
                Phone = "0901234567",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var customer02 = new User
            {
                Username = "customer02",
                Email = "mai.tran@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Customer@123"),
                FullName = "Trần Thị Mai",
                Phone = "0912345678",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            context.Users.AddRange(adminUser, staffUser, customer01, customer02);
            await context.SaveChangesAsync();

            // Assign User Roles
            context.UserRoles.AddRange(
                new UserRole { UserId = adminUser.UserId, RoleId = adminRole.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = staffUser.UserId, RoleId = staffRole.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = customer01.UserId, RoleId = customerRole.RoleId, AssignedAt = DateTime.UtcNow },
                new UserRole { UserId = customer02.UserId, RoleId = customerRole.RoleId, AssignedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        // 2b. Vai trò Quản lý vận hành KD (OPERATIONS) + tài khoản ops01
        await EnsureOperationsRoleAsync(context);

        // 2c. Quyền của STAFF / MANAGER + tài khoản manager01, staff02 (BACKEND-TODO A1)
        await EnsureFacilityRolesAsync(context);

        var admin = await context.Users.FirstAsync(u => u.Username == "admin");

        // 3. Danh mục kho theo D17: 4 loại kho, 12 cơ sở, mỗi cơ sở 12 ô + bảng giá
        var catalog = await EnsureCatalogAsync(context, admin.UserId);

        // 4. Policies
        if (!await context.Policies.AnyAsync())
        {
            var policies = new List<Policy>
            {
                new()
                {
                    CreatedBy = admin.UserId,
                    PolicyName = "Chính sách tiền đặt cọc thuê kho",
                    PolicyType = "DEPOSIT",
                    CalculationType = "FIXED",
                    Value = 1.0m, // 1 tháng
                    RuleDescription = "Yêu cầu khách hàng đặt cọc tương đương 1 tháng tiền thuê khi ký hợp đồng",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    CreatedBy = admin.UserId,
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

        // 5. Phân công cơ sở (SRS A06: mỗi nhân viên / quản lý 1 cơ sở) + dữ liệu vận hành mẫu tại cơ sở đó
        await EnsureFacilityAssignmentsAsync(context, catalog.Home.FacilityId, admin.UserId);
        await SeedFacilityOperationsAsync(context, catalog);
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
        var opsCodes = new[] { "FACILITY_MANAGE", "POLICY_MANAGE", "REPORT_VIEW", "REPORT_SYSTEM", "REPORT_EXPORT" };
        var allPermissions = await context.Permissions.ToListAsync();
        var existingPairs = await context.RolePermissions.Select(rp => new { rp.RoleId, rp.PermissionId }).ToListAsync();

        foreach (var perm in allPermissions)
        {
            if (adminRole != null && !existingPairs.Any(x => x.RoleId == adminRole.RoleId && x.PermissionId == perm.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = adminRole.RoleId, PermissionId = perm.PermissionId });
            }
            if (opsCodes.Contains(perm.PermissionCode) && !existingPairs.Any(x => x.RoleId == opsRole.RoleId && x.PermissionId == perm.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = opsRole.RoleId, PermissionId = perm.PermissionId });
            }
        }
        await context.SaveChangesAsync();

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
