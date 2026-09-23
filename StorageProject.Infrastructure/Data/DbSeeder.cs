using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

public static class DbSeeder
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

        var admin = await context.Users.FirstAsync(u => u.Username == "admin");
        var staff = await context.Users.FirstAsync(u => u.Username == "staff01");
        var cust1 = await context.Users.FirstAsync(u => u.Username == "customer01");

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
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeS.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 500000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeM.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 1500000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeL.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 3000000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeS.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 550000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeM.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 1600000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeL.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 3200000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
                new() { FacilityId = quan7Fac.FacilityId, UnitTypeId = typeXL.UnitTypeId, SetBy = admin.UserId, MonthlyRate = 5500000m, EffectiveFrom = today, Status = "ACTIVE", CreatedAt = DateTime.UtcNow },
            };

            context.RentalRates.AddRange(rates);
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

        // 7. Storage Units
        if (!await context.StorageUnits.AnyAsync())
        {
            var units = new List<StorageUnit>
            {
                // Tân Bình
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeS.UnitTypeId, UnitNumber = "TB-S-101", Floor = "Tầng 1", Zone = "Khu A", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeS.UnitTypeId, UnitNumber = "TB-S-102", Floor = "Tầng 1", Zone = "Khu A", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeM.UnitTypeId, UnitNumber = "TB-M-103", Floor = "Tầng 1", Zone = "Khu B", Status = "OCCUPIED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeM.UnitTypeId, UnitNumber = "TB-M-104", Floor = "Tầng 1", Zone = "Khu B", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeL.UnitTypeId, UnitNumber = "TB-L-201", Floor = "Tầng 2", Zone = "Khu C", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new() { FacilityId = tanBinhFac.FacilityId, UnitTypeId = typeL.UnitTypeId, UnitNumber = "TB-L-202", Floor = "Tầng 2", Zone = "Khu C", Status = "AVAILABLE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },

                // Quận 7
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

        // 7b. Mạng lưới 12 cơ sở SafeSpace theo thiết kế Figma.
        //     Chạy lại nhiều lần vẫn an toàn: chỉ thêm cơ sở / bảng giá / phòng kho còn thiếu,
        //     nên database đã tạo từ trước cũng được bổ sung khi khởi động lại API.
        await SeedSafeSpaceNetworkAsync(context, admin.UserId, typeS, typeM, typeL, typeXL);

        // 8. Sample Customer Data (Reservation, Contract, Payment, SupportTicket for customer01)
        if (!await context.Reservations.AnyAsync())
        {
            var occupiedUnit = await context.StorageUnits.FirstAsync(u => u.UnitNumber == "TB-M-103");

            // Reservation 1: Converted to Contract
            var startDate1 = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-15));
            var endDate1 = startDate1.AddMonths(3);

            var res1 = new Reservation
            {
                CustomerId = cust1.UserId,
                FacilityId = tanBinhFac.FacilityId,
                UnitTypeId = typeM.UnitTypeId,
                StartDate = startDate1,
                ExpectedEndDate = endDate1,
                RentalPeriodMonths = 3,
                QuotedMonthlyRate = 1500000m,
                EstimatedAmount = 4500000m,
                RequiredDeposit = 1500000m,
                Status = "CHECKED_IN",
                CreatedAt = DateTime.UtcNow.AddDays(-16),
                ExpiresAt = DateTime.UtcNow.AddDays(-15)
            };
            context.Reservations.Add(res1);
            await context.SaveChangesAsync();

            // Contract for Reservation 1
            var contract = new RentalContract
            {
                ReservationId = res1.ReservationId,
                CustomerId = cust1.UserId,
                UnitId = occupiedUnit.UnitId,
                StartDate = startDate1,
                EndDate = endDate1,
                AgreedMonthlyRate = 1500000m,
                DepositAmount = 1500000m,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow.AddDays(-15),
                ActivatedAt = DateTime.UtcNow.AddDays(-15)
            };
            context.RentalContracts.Add(contract);
            await context.SaveChangesAsync();

            // Handover Record
            var handover = new HandoverRecord
            {
                ContractId = contract.ContractId,
                StaffId = staff.UserId,
                InitialCondition = "Kho sạch sẽ, hệ thống điều hòa hoạt động tốt, đã bàn giao khóa",
                ScheduledAt = DateTime.UtcNow.AddDays(-15),
                HandoverAt = DateTime.UtcNow.AddDays(-15),
                CustomerConfirmed = true,
                StaffConfirmed = true,
                Status = "HANDED_OVER",
                CreatedAt = DateTime.UtcNow.AddDays(-15)
            };
            context.HandoverRecords.Add(handover);

            // Payments (Deposit + Rent)
            var depositPayment = new Payment
            {
                ContractId = contract.ContractId,
                PaymentType = "DEPOSIT",
                Amount = 1500000m,
                Currency = "VND",
                PaymentMethod = "BANK_TRANSFER",
                TransactionReference = "VNPAY-DEP-10001",
                DueDate = startDate1,
                PaidAt = DateTime.UtcNow.AddDays(-15),
                Status = "PAID",
                CreatedAt = DateTime.UtcNow.AddDays(-15),
                UpdatedAt = DateTime.UtcNow.AddDays(-15)
            };

            var rentPayment = new Payment
            {
                ContractId = contract.ContractId,
                PaymentType = "RENT",
                Amount = 1500000m,
                Currency = "VND",
                PaymentMethod = "BANK_TRANSFER",
                TransactionReference = "VNPAY-RENT-10002",
                DueDate = startDate1,
                PaidAt = DateTime.UtcNow.AddDays(-15),
                Status = "PAID",
                CreatedAt = DateTime.UtcNow.AddDays(-15),
                UpdatedAt = DateTime.UtcNow.AddDays(-15)
            };

            context.Payments.AddRange(depositPayment, rentPayment);

            // Support Ticket
            var ticket = new SupportTicket
            {
                CustomerId = cust1.UserId,
                ContractId = contract.ContractId,
                UnitId = occupiedUnit.UnitId,
                IssueType = "UNIT",
                Title = "Kiểm tra nhiệt độ phòng kho",
                Description = "Nhờ nhân viên kiểm tra lại nhiệt độ kho TB-M-103 vào buổi trưa",
                Priority = "NORMAL",
                Status = "OPEN",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            };
            context.SupportTickets.Add(ticket);

            // Reservation 2: Pending payment for customer01
            var startDate2 = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
            var res2 = new Reservation
            {
                CustomerId = cust1.UserId,
                FacilityId = tanBinhFac.FacilityId,
                UnitTypeId = typeS.UnitTypeId,
                StartDate = startDate2,
                ExpectedEndDate = startDate2.AddMonths(1),
                RentalPeriodMonths = 1,
                QuotedMonthlyRate = 500000m,
                EstimatedAmount = 500000m,
                RequiredDeposit = 500000m,
                Status = "PENDING_PAYMENT",
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24)
            };
            context.Reservations.Add(res2);

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
