using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Roles
        var requiredRoles = new List<(string Name, string Description)>
        {
            ("ADMIN", "Quản trị viên toàn quyền hệ thống"),
            ("MANAGER", "Quản lý cơ sở kho"),
            ("STAFF", "Nhân viên vận hành, bàn giao và kiểm tra kho"),
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

        // Ensure STAFF, MANAGER & BUSINESS_OPERATOR permissions
        var allPermsList = await context.Permissions.ToListAsync();
        var staffPermCodes = new[] { "HANDOVER_MANAGE", "RETURN_MANAGE", "TICKET_MANAGE", "PAYMENT_CONFIRM" };
        var managerPermCodes = new[] { "HANDOVER_MANAGE", "RETURN_MANAGE", "TICKET_MANAGE", "PAYMENT_CONFIRM", "UNIT_MANAGE", "ASSIGNMENT_MANAGE", "RENEWAL_MANAGE", "REPORT_VIEW" };
        var bizOpPermCodes = new[] { "REPORT_VIEW", "AUDIT_LOG_VIEW", "FACILITY_MANAGE", "UNIT_MANAGE", "RENEWAL_MANAGE" };

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
            if (p != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == businessOpRole.RoleId && rp.PermissionId == p.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = businessOpRole.RoleId, PermissionId = p.PermissionId });
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
        var manager = await EnsureUserAsync("manager01", "manager01@storage.vn", "Phạm Thu Hà", "0900000003", "Manager@123", managerRole);
        var operatorUser = await EnsureUserAsync("operator01", "operator01@storage.vn", "Lê Vận Hành Kinh Doanh", "0900000004", "Operator@123", businessOpRole);
        var cust1 = await EnsureUserAsync("customer01", "an.nguyen@example.com", "Nguyễn Văn An", "0901234567", "Customer@123", customerRole);
        var cust2 = await EnsureUserAsync("customer02", "mai.tran@example.com", "Trần Thị Mai", "0912345678", "Customer@123", customerRole);

        // 3. Facilities
        if (!await context.Facilities.AnyAsync())
        {
            var fac1 = new Facility
            {
                Name = "SSFRMS Chi nhánh Tân Bình",
                Address = "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh",
                ContactPhone = "02838112233",
                OpeningTime = new TimeOnly(7, 0),
                ClosingTime = new TimeOnly(22, 0),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var fac2 = new Facility
            {
                Name = "SSFRMS Chi nhánh Quận 7",
                Address = "456 Nguyễn Thị Thập, Phường Tân Quy, Quận 7, TP. Hồ Chí Minh",
                ContactPhone = "02837778899",
                OpeningTime = new TimeOnly(6, 0),
                ClosingTime = new TimeOnly(23, 0),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            context.Facilities.AddRange(fac1, fac2);
            await context.SaveChangesAsync();
        }

        var tanBinhFac = await context.Facilities.FirstAsync(f => f.Name.Contains("Tân Bình"));
        var quan7Fac = await context.Facilities.FirstAsync(f => f.Name.Contains("Quận 7"));

        // 4. Unit Types
        if (!await context.UnitTypes.AnyAsync())
        {
            var types = new List<UnitType>
            {
                new()
                {
                    TypeName = "Tủ Locker Cá Nhân (0.5m x 0.5m)",
                    Length = 0.5m,
                    Width = 0.5m,
                    Height = 1.0m,
                    Area = 0.25m,
                    ClimateControlled = false,
                    Description = "Ngăn tủ locker cá nhân thông minh, bảo mật cao, cất giữ giấy tờ, phụ kiện hoặc balo",
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    TypeName = "Kho Mini S (1m x 1m)",
                    Length = 1.0m,
                    Width = 1.0m,
                    Height = 2.5m,
                    Area = 1.0m,
                    ClimateControlled = false,
                    Description = "Kho nhỏ tiết kiệm, phù hợp cất giữ vali, tài liệu, phụ kiện gia đình",
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    TypeName = "Kho Tiêu Chuẩn M (2m x 2m)",
                    Length = 2.0m,
                    Width = 2.0m,
                    Height = 2.8m,
                    Area = 4.0m,
                    ClimateControlled = true,
                    Description = "Kho điều hòa mát mẻ, phù hợp đồ nội thất, thiết bị điện tử, hàng shop online",
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    TypeName = "Kho Lớn L (3m x 3m)",
                    Length = 3.0m,
                    Width = 3.0m,
                    Height = 3.0m,
                    Area = 9.0m,
                    ClimateControlled = true,
                    Description = "Kho điều hòa sức chứa lớn, phù hợp lưu trữ đồ chuyển nhà 2-3 phòng ngủ",
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new()
                {
                    TypeName = "Kho Doanh Nghiệp XL (4m x 4m)",
                    Length = 4.0m,
                    Width = 4.0m,
                    Height = 3.2m,
                    Area = 16.0m,
                    ClimateControlled = true,
                    Description = "Kho chuyên biệt cho doanh nghiệp lưu trữ tài liệu chứng từ hoặc kiện hàng thương mại",
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            };

            context.UnitTypes.AddRange(types);
            await context.SaveChangesAsync();
        }

        var typeLocker = await context.UnitTypes.FirstOrDefaultAsync(t => t.TypeName.Contains("Tủ Locker"));
        if (typeLocker == null)
        {
            typeLocker = new UnitType
            {
                TypeName = "Tủ Locker Cá Nhân (0.5m x 0.5m)",
                Length = 0.5m,
                Width = 0.5m,
                Height = 1.0m,
                Area = 0.25m,
                ClimateControlled = false,
                Description = "Ngăn tủ locker cá nhân thông minh, bảo mật cao, cất giữ giấy tờ, phụ kiện hoặc balo",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.UnitTypes.Add(typeLocker);
            await context.SaveChangesAsync();
        }

        var typeS = await context.UnitTypes.FirstAsync(t => t.TypeName.Contains("Kho Mini S"));
        var typeM = await context.UnitTypes.FirstAsync(t => t.TypeName.Contains("Kho Tiêu Chuẩn M"));
        var typeL = await context.UnitTypes.FirstAsync(t => t.TypeName.Contains("Kho Lớn L"));
        var typeXL = await context.UnitTypes.FirstAsync(t => t.TypeName.Contains("Kho Doanh Nghiệp XL"));

        // 5. Rental Rates
        if (!await context.RentalRates.AnyAsync())
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var rates = new List<RentalRate>
            {
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 1000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeS.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 500000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeM.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 1500000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeL.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 3000000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 1000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeS.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 550000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeM.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 1600000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeL.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 3200000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeXL.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 5500000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
            };

            context.RentalRates.AddRange(rates);
            await context.SaveChangesAsync();
        }

        var rateDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        // Đảm bảo có bảng giá 1.000 VND/tháng cho Tủ Locker tại Tân Bình (dùng để test thanh toán payOS)
        if (!await context.RentalRates.AnyAsync(r => r.FacilityId == tanBinhFac.FacilityId && r.UnitTypeId == typeLocker.UnitTypeId))
        {
            context.RentalRates.Add(new RentalRate
            {
                FacilityId = tanBinhFac.FacilityId,
                UnitTypeId = typeLocker.UnitTypeId,
                SetBy = admin.UserId,
                MonthlyRate = 1000m,
                EffectiveFrom = rateDate,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }
        // Đảm bảo có bảng giá 1.000 VND/tháng cho Tủ Locker tại Quận 7
        if (!await context.RentalRates.AnyAsync(r => r.FacilityId == quan7Fac.FacilityId && r.UnitTypeId == typeLocker.UnitTypeId))
        {
            context.RentalRates.Add(new RentalRate
            {
                FacilityId = quan7Fac.FacilityId,
                UnitTypeId = typeLocker.UnitTypeId,
                SetBy = admin.UserId,
                MonthlyRate = 1000m,
                EffectiveFrom = rateDate,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        // 6. Policies
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

        // 7. Storage Units (Tất cả ô kho đều AVAILABLE khi mới mở hệ thống)
        if (!await context.StorageUnits.AnyAsync())
        {
            var units = new List<StorageUnit>
            {
                // Tân Bình
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "TB-LK-101", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "TB-LK-102", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeS.UnitTypeId, UnitNumber = "TB-S-101", Floor = "Tầng 1", Zone = "Khu A", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeS.UnitTypeId, UnitNumber = "TB-S-102", Floor = "Tầng 1", Zone = "Khu A", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeM.UnitTypeId, UnitNumber = "TB-M-103", Floor = "Tầng 1", Zone = "Khu B", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeM.UnitTypeId, UnitNumber = "TB-M-104", Floor = "Tầng 1", Zone = "Khu B", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeL.UnitTypeId, UnitNumber = "TB-L-201", Floor = "Tầng 2", Zone = "Khu C", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeL.UnitTypeId, UnitNumber = "TB-L-202", Floor = "Tầng 2", Zone = "Khu C", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },

                // Quận 7
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "Q7-LK-101", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "Q7-LK-102", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeS.UnitTypeId, UnitNumber = "Q7-S-101", Floor = "Tầng 1", Zone = "Khu 1", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeS.UnitTypeId, UnitNumber = "Q7-S-102", Floor = "Tầng 1", Zone = "Khu 1", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeM.UnitTypeId, UnitNumber = "Q7-M-103", Floor = "Tầng 1", Zone = "Khu 2", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeM.UnitTypeId, UnitNumber = "Q7-M-104", Floor = "Tầng 1", Zone = "Khu 2", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeL.UnitTypeId, UnitNumber = "Q7-L-201", Floor = "Tầng 2", Zone = "Khu 3", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeXL.UnitTypeId, UnitNumber = "Q7-XL-301", Floor = "Tầng 3", Zone = "Khu VIP", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            };

            context.StorageUnits.AddRange(units);
            await context.SaveChangesAsync();
        }

        // Đảm bảo ô kho Tủ Locker luôn có sẵn (AVAILABLE) trên DB đã seed trước đó
        if (!await context.StorageUnits.AnyAsync(u => u.FacilityId == tanBinhFac.FacilityId && u.UnitNumber == "TB-LK-101"))
        {
            context.StorageUnits.AddRange(
                new StorageUnit { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "TB-LK-101", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new StorageUnit { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "TB-LK-102", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }
        if (!await context.StorageUnits.AnyAsync(u => u.FacilityId == quan7Fac.FacilityId && u.UnitNumber == "Q7-LK-101"))
        {
            context.StorageUnits.AddRange(
                new StorageUnit { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "Q7-LK-101", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new StorageUnit { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "Q7-LK-102", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        // 7b. Mạng lưới 12 cơ sở SafeSpace theo thiết kế Figma (Tất cả ô kho đều AVAILABLE)
        await SeedSafeSpaceNetworkAsync(context, admin.UserId, typeS, typeM, typeL, typeXL);

        // 7c. UserFacility: phân công cơ sở cho staff01, manager01, operator01
        var nlbFac = await context.Facilities.FirstOrDefaultAsync(f => f.Name.Contains("Nguyễn Lương Bằng"))
                     ?? await context.Facilities.FirstAsync();

        if (!await context.UserFacilities.AnyAsync(uf => uf.UserId == staff.UserId && uf.FacilityId == nlbFac.FacilityId))
        {
            context.UserFacilities.Add(new UserFacility
            {
                UserId = staff.UserId,
                FacilityId = nlbFac.FacilityId,
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
        }
        if (!await context.UserFacilities.AnyAsync(uf => uf.UserId == manager.UserId && uf.FacilityId == nlbFac.FacilityId))
        {
            context.UserFacilities.Add(new UserFacility
            {
                UserId = manager.UserId,
                FacilityId = nlbFac.FacilityId,
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
        }
        if (!await context.UserFacilities.AnyAsync(uf => uf.UserId == operatorUser.UserId && uf.FacilityId == nlbFac.FacilityId))
        {
            context.UserFacilities.Add(new UserFacility
            {
                UserId = operatorUser.UserId,
                FacilityId = nlbFac.FacilityId,
                AssignedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
        }
        await context.SaveChangesAsync();

        // Đảm bảo Nguyễn Lương Bằng cũng có bảng giá 1.000 VND và ô kho Tủ Locker
        if (!await context.RentalRates.AnyAsync(r => r.FacilityId == nlbFac.FacilityId && r.UnitTypeId == typeLocker.UnitTypeId))
        {
            context.RentalRates.Add(new RentalRate
            {
                FacilityId = nlbFac.FacilityId,
                UnitTypeId = typeLocker.UnitTypeId,
                SetBy = admin.UserId,
                MonthlyRate = 1000m,
                EffectiveFrom = rateDate,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }
        if (!await context.StorageUnits.AnyAsync(u => u.FacilityId == nlbFac.FacilityId && u.UnitNumber == "NLB-LK-101"))
        {
            context.StorageUnits.AddRange(
                new StorageUnit { FacilityId = nlbFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "NLB-LK-101", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new StorageUnit { FacilityId = nlbFac.FacilityId, UnitTypeId = typeLocker.UnitTypeId, UnitNumber = "NLB-LK-102", Floor = "Tầng 1", Zone = "Khu Locker", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }
    }

    // ------------------------------------------------------------------------------------------
    // Mạng lưới cơ sở SafeSpace (Figma C02 / Trang chủ)
    // RateM = giá kho Tiêu Chuẩn M; các loại khác tính theo tỉ lệ (S ≈ 40%, L = 2×, XL = 3,5×).
    // ------------------------------------------------------------------------------------------
    private sealed record SeedFacility(string Code, string Name, string Address, string Phone, int OpenHour, int CloseHour, decimal RateM, bool HasXL);

    private static readonly SeedFacility[] SafeSpaceNetwork =
    [
        new("NLB", "SafeSpace Nguyễn Lương Bằng", "12 Nguyễn Lương Bằng, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh", "02837001012", 6, 22, 1150000m, true),
        new("HL", "SafeSpace Him Lam", "Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh", "02837001013", 6, 22, 1050000m, false),
        new("PX", "SafeSpace Phú Xuân", "Đường Nguyễn Hữu Thọ, Xã Phú Xuân, Huyện Nhà Bè, TP. Hồ Chí Minh", "02837001014", 6, 22, 890000m, false),
        new("TT", "SafeSpace Tân Thuận", "Đường Huỳnh Tấn Phát, Phường Tân Thuận Đông, Quận 7, TP. Hồ Chí Minh", "02837001015", 6, 22, 1100000m, true),
        new("PMH", "SafeSpace Phú Mỹ Hưng", "Đường Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh", "02837001016", 6, 22, 1250000m, true),
        new("BT", "SafeSpace Bình Thạnh", "Đường Nguyễn Xí, Phường 26, Quận Bình Thạnh, TP. Hồ Chí Minh", "02837001017", 6, 22, 980000m, false),
        new("NB", "SafeSpace Nhà Bè", "Đường Huỳnh Tấn Phát, Thị trấn Nhà Bè, Huyện Nhà Bè, TP. Hồ Chí Minh", "02837001018", 6, 22, 850000m, false),
        new("BC", "SafeSpace Bình Chánh", "Quốc lộ 50, Xã Bình Hưng, Huyện Bình Chánh, TP. Hồ Chí Minh", "02837001019", 6, 22, 790000m, true),
        new("TD", "SafeSpace Thủ Đức", "Đường Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh", "02837001020", 6, 22, 920000m, false),
        new("GV", "SafeSpace Gò Vấp", "Đường Quang Trung, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh", "02837001021", 6, 22, 930000m, false),
    ];

    private static decimal RoundRate(decimal value) => Math.Round(value / 10000m, MidpointRounding.AwayFromZero) * 10000m;

    private static async Task SeedSafeSpaceNetworkAsync(AppDbContext context, long adminId, UnitType typeS, UnitType typeM, UnitType typeL, UnitType typeXL)
    {
        // Đổi tên 2 cơ sở seed ban đầu sang thương hiệu SafeSpace (chỉ đổi khi còn tên cũ)
        var renames = new Dictionary<string, string>
        {
            ["SSFRMS Chi nhánh Tân Bình"] = "SafeSpace Tân Bình",
            ["SSFRMS Chi nhánh Quận 7"] = "SafeSpace Quận 7",
        };
        var oldNames = renames.Keys.ToList();
        var toRename = await context.Facilities.Where(f => oldNames.Contains(f.Name)).ToListAsync();
        foreach (var f in toRename)
        {
            f.Name = renames[f.Name];
            f.UpdatedAt = DateTime.UtcNow;
        }
        if (toRename.Count > 0) await context.SaveChangesAsync();

        var effectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));

        foreach (var seed in SafeSpaceNetwork)
        {
            var facility = await context.Facilities.FirstOrDefaultAsync(f => f.Name == seed.Name);
            if (facility == null)
            {
                facility = new Facility
                {
                    Name = seed.Name,
                    Address = seed.Address,
                    ContactPhone = seed.Phone,
                    OpeningTime = new TimeOnly(seed.OpenHour, 0),
                    ClosingTime = new TimeOnly(seed.CloseHour, 0),
                    Status = "ACTIVE",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.Facilities.Add(facility);
                await context.SaveChangesAsync();
            }

            // (loại kho, giá/tháng, số phòng, ký hiệu, số phòng bắt đầu, tầng, khu)
            var plan = new List<(UnitType Type, decimal Rate, int Count, string Size, int FirstNo, string Floor, string Zone)>
            {
                (typeS, RoundRate(seed.RateM * 0.4m), 2, "S", 101, "Tầng 1", "Khu A"),
                (typeM, seed.RateM, 2, "M", 111, "Tầng 1", "Khu B"),
                (typeL, RoundRate(seed.RateM * 2m), 1, "L", 201, "Tầng 2", "Khu C"),
            };
            if (seed.HasXL) plan.Add((typeXL, RoundRate(seed.RateM * 3.5m), 1, "XL", 301, "Tầng 3", "Khu D"));

            foreach (var item in plan)
            {
                var hasRate = await context.RentalRates.AnyAsync(r => r.FacilityId == facility.FacilityId && r.UnitTypeId == item.Type.UnitTypeId);
                if (!hasRate)
                {
                    context.RentalRates.Add(new RentalRate
                    {
                        FacilityId = facility.FacilityId,
                        UnitTypeId = item.Type.UnitTypeId,
                        SetBy = adminId,
                        MonthlyRate = item.Rate,
                        EffectiveFrom = effectiveFrom,
                        Status = "ACTIVE",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                for (var i = 0; i < item.Count; i++)
                {
                    var unitNumber = $"{seed.Code}-{item.Size}-{item.FirstNo + i}";
                    var exists = await context.StorageUnits.AnyAsync(u => u.FacilityId == facility.FacilityId && u.UnitNumber == unitNumber);
                    if (exists) continue;
                    context.StorageUnits.Add(new StorageUnit
                    {
                        FacilityId = facility.FacilityId,
                        UnitTypeId = item.Type.UnitTypeId,
                        UnitNumber = unitNumber,
                        Floor = item.Floor,
                        Zone = item.Zone,
                        Status = "AVAILABLE",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }
            await context.SaveChangesAsync();
        }
    }
}
