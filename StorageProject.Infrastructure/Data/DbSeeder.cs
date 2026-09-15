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
}
