using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// Khu Nhân viên cơ sở / Quản lý cơ sở (BACKEND-TODO A1):
/// - Quyền của role STAFF, MANAGER; tài khoản manager01 / Manager@123 và staff02 / Staff@123.
/// - Phân công cơ sở: staff01, staff02, manager01 → SafeSpace Nguyễn Lương Bằng (SRS A06: mỗi người 1 cơ sở).
/// - Dữ liệu vận hành mẫu tại cơ sở đó để màn S01–S09, M01–M08 có việc để xử lý ngay sau khi tạo DB.
/// </summary>
public static partial class DbSeeder
{
    private static readonly string[] StaffPermissionCodes = ["HANDOVER_MANAGE", "RETURN_MANAGE", "TICKET_MANAGE", "PAYMENT_CONFIRM"];

    private static readonly string[] ManagerPermissionCodes =
        ["HANDOVER_MANAGE", "RETURN_MANAGE", "TICKET_MANAGE", "PAYMENT_CONFIRM", "UNIT_MANAGE", "ASSIGNMENT_MANAGE", "RENEWAL_MANAGE", "REPORT_VIEW"];

    private static async Task<User> EnsureUserAsync(AppDbContext context, string username, string email, string password, string fullName, string phone, string roleName)
    {
        var user = await context.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null)
        {
            user = new User
            {
                Username = username, Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                FullName = fullName, Phone = phone, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
        }
        var role = await context.Roles.FirstAsync(r => r.RoleName == roleName);
        if (!await context.UserRoles.AnyAsync(ur => ur.UserId == user.UserId && ur.RoleId == role.RoleId))
        {
            context.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow });
            await context.SaveChangesAsync();
        }
        return user;
    }

    private static async Task EnsureFacilityRolesAsync(AppDbContext context)
    {
        var staffRole = await context.Roles.FirstAsync(r => r.RoleName == "STAFF");
        var managerRole = await context.Roles.FirstAsync(r => r.RoleName == "MANAGER");
        var permissions = await context.Permissions.ToListAsync();
        var pairs = await context.RolePermissions.Select(rp => new { rp.RoleId, rp.PermissionId }).ToListAsync();

        foreach (var perm in permissions)
        {
            if (StaffPermissionCodes.Contains(perm.PermissionCode) && !pairs.Any(x => x.RoleId == staffRole.RoleId && x.PermissionId == perm.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = staffRole.RoleId, PermissionId = perm.PermissionId });
            }
            if (ManagerPermissionCodes.Contains(perm.PermissionCode) && !pairs.Any(x => x.RoleId == managerRole.RoleId && x.PermissionId == perm.PermissionId))
            {
                context.RolePermissions.Add(new RolePermission { RoleId = managerRole.RoleId, PermissionId = perm.PermissionId });
            }
        }
        await context.SaveChangesAsync();

        await EnsureUserAsync(context, "manager01", "manager01@storage.vn", "Manager@123", "Phạm Thu Hà", "0900000005", "MANAGER");
        await EnsureUserAsync(context, "staff02", "staff02@storage.vn", "Staff@123", "Nguyễn Minh Tâm", "0900000006", "STAFF");
    }

    /// <summary>Gán cơ sở cho tài khoản chưa có cơ sở nào đang hiệu lực (không ghi đè phân công do quản trị đặt).</summary>
    private static async Task EnsureFacilityAssignmentsAsync(AppDbContext context, long facilityId, long adminId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        foreach (var username in new[] { "staff01", "staff02", "manager01" })
        {
            var user = await context.Users.FirstOrDefaultAsync(u => u.Username == username);
            if (user == null) continue;
            var hasActive = await context.UserFacilities.AnyAsync(uf => uf.UserId == user.UserId && uf.Status == "ACTIVE");
            if (hasActive) continue;
            context.UserFacilities.Add(new UserFacility
            {
                UserId = user.UserId, FacilityId = facilityId, AssignedBy = adminId,
                AssignedFrom = today.AddDays(-30), Status = "ACTIVE", CreatedAt = DateTime.UtcNow
            });
        }
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Dữ liệu vận hành mẫu tại cơ sở đầu tiên. Chỉ chạy khi cơ sở này chưa có đơn đặt chỗ nào.
    /// Ô kho: K01, K09 đang thuê · K02 sắp hết hạn + chờ duyệt gia hạn · K03 quá hạn · K05 chờ bàn giao ·
    /// K07 chờ kiểm tra trả kho · K10 bảo trì · còn lại trống. Thêm 2 khoản chờ đối soát, 1 đơn chờ phân bổ,
    /// 1 đơn chờ chuyển khoản (để khách thử "Tôi đã chuyển khoản").
    /// </summary>
    private static async Task SeedFacilityOperationsAsync(AppDbContext context, SeedCatalog catalog)
    {
        var home = catalog.Home;
        if (await context.Reservations.AnyAsync(r => r.FacilityId == home.FacilityId)) return;

        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc.AddHours(7));
        DateTime Utc(DateOnly d, int hour, int minute = 0) =>
            DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(hour, minute)).AddHours(-7), DateTimeKind.Utc);

        var staff01 = await context.Users.FirstAsync(u => u.Username == "staff01");
        var manager = await context.Users.FirstAsync(u => u.Username == "manager01");
        var cust01 = await context.Users.FirstAsync(u => u.Username == "customer01");
        var cust02 = await context.Users.FirstAsync(u => u.Username == "customer02");
        var cust03 = await EnsureUserAsync(context, "customer03", "tung.le@example.com", "Customer@123", "Lê Văn Tùng", "0903000003", "CUSTOMER");
        var cust04 = await EnsureUserAsync(context, "customer04", "lan.hoang@example.com", "Customer@123", "Hoàng Thị Lan", "0903000004", "CUSTOMER");
        var cust05 = await EnsureUserAsync(context, "customer05", "huy.phan@example.com", "Customer@123", "Phan Quốc Huy", "0903000005", "CUSTOMER");
        var cust06 = await EnsureUserAsync(context, "customer06", "trang.dang@example.com", "Customer@123", "Đặng Thu Trang", "0903000006", "CUSTOMER");

        var units = await context.StorageUnits.Where(u => u.FacilityId == home.FacilityId).ToDictionaryAsync(u => u.UnitNumber);
        // Giá đang áp dụng của từng loại kho (có thể có nhiều bản ACTIVE nếu Vận hành KD đã lên lịch giá mới)
        var rates = (await context.RentalRates
                .Where(r => r.FacilityId == home.FacilityId && r.Status == "ACTIVE" && r.EffectiveFrom <= today)
                .ToListAsync())
            .GroupBy(r => r.UnitTypeId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.EffectiveFrom).First().MonthlyRate);

        void Log(long? userId, string action, string entityType, long entityId, object value, DateTime at) =>
            context.ActivityLogs.Add(new ActivityLog
            {
                UserId = userId, Action = action, EntityType = entityType, EntityId = entityId,
                NewValue = JsonSerializer.Serialize(value), LoggedAt = at
            });

        async Task<Reservation> ReserveAsync(User customer, UnitType type, DateOnly start, int months, string status, DateTime createdAt)
        {
            var rate = rates[type.UnitTypeId];
            var r = new Reservation
            {
                CustomerId = customer.UserId, FacilityId = home.FacilityId, UnitTypeId = type.UnitTypeId,
                StartDate = start, RentalPeriodMonths = months, ExpectedEndDate = start.AddMonths(months),
                CheckInAppointmentAt = Utc(start, 9), QuotedMonthlyRate = rate, EstimatedAmount = rate * months,
                RequiredDeposit = rate, Status = status, CreatedAt = createdAt,
                ExpiresAt = status == "PENDING_PAYMENT" ? nowUtc.AddHours(24) : createdAt.AddHours(24)
            };
            context.Reservations.Add(r);
            await context.SaveChangesAsync();
            return r;
        }

        // Thuê một ô: đơn đặt chỗ + phân bổ + hợp đồng + cọc và tiền thuê đã thu + biên bản bàn giao
        async Task<RentalContract> RentAsync(User customer, string code, UnitType type, DateOnly start, int months,
            string contractStatus, string unitStatus, User handoverStaff, bool handedOver)
        {
            var unit = units[code];
            var paidAt = Utc(start.AddDays(-2), 10);
            var reservation = await ReserveAsync(customer, type, start, months, handedOver ? "CHECKED_IN" : "UNIT_ASSIGNED", paidAt.AddHours(-1));
            context.UnitAssignments.Add(new UnitAssignment
            {
                ReservationId = reservation.ReservationId, UnitId = unit.UnitId, AssignedBy = manager.UserId,
                Status = "ACTIVE", AssignedAt = paidAt.AddHours(2)
            });
            var contract = new RentalContract
            {
                ReservationId = reservation.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
                StartDate = start, EndDate = start.AddMonths(months), AgreedMonthlyRate = reservation.QuotedMonthlyRate,
                DepositAmount = reservation.RequiredDeposit, Status = contractStatus, CreatedAt = paidAt.AddHours(2),
                ActivatedAt = handedOver ? Utc(start, 9) : null
            };
            context.RentalContracts.Add(contract);
            await context.SaveChangesAsync();

            var reference = $"SS-{reservation.CreatedAt.AddHours(7):yyyyMMdd}-{reservation.ReservationId:0000}";
            foreach (var (kind, amount) in new[] { ("DEPOSIT", reservation.RequiredDeposit), ("RENT", reservation.EstimatedAmount) })
            {
                context.Payments.Add(new Payment
                {
                    ContractId = contract.ContractId, PaymentType = kind, Amount = amount, Currency = "VND",
                    PaymentMethod = "BANK_TRANSFER", TransactionReference = reference, DueDate = start,
                    PaidAt = paidAt, Status = "PAID", CreatedAt = paidAt, UpdatedAt = paidAt
                });
            }
            Log(staff01.UserId, "PAYMENT_CONFIRMED", "RESERVATION", reservation.ReservationId,
                new { amount = reservation.EstimatedAmount + reservation.RequiredDeposit }, paidAt);

            context.HandoverRecords.Add(new HandoverRecord
            {
                ContractId = contract.ContractId, StaffId = handoverStaff.UserId, ScheduledAt = Utc(start, 9),
                VerifiedAt = handedOver ? Utc(start, 9) : null, HandoverAt = handedOver ? Utc(start, 9, 15) : null,
                InitialCondition = "Kho sạch, cửa cuốn và khoá hoạt động tốt",
                CustomerConfirmed = handedOver, StaffConfirmed = handedOver,
                Status = handedOver ? "HANDED_OVER" : "SCHEDULED", CreatedAt = paidAt.AddHours(2)
            });
            if (handedOver)
            {
                context.AccessCredentials.Add(new AccessCredential
                {
                    ContractId = contract.ContractId, UnitId = unit.UnitId, IssuedBy = handoverStaff.UserId,
                    CredentialType = "ACCESS_CARD", CredentialReference = $"CARD-{code}-{start:yyMMdd}",
                    IssuedAt = Utc(start, 9, 15), Status = "ACTIVE"
                });
            }
            unit.Status = unitStatus;
            unit.UpdatedAt = paidAt;
            await context.SaveChangesAsync();
            return contract;
        }

        // K01 · customer01 đang thuê + 1 yêu cầu hỗ trợ chưa phân công
        var k01 = await RentAsync(cust01, "K01", catalog.NormalM, today.AddDays(-15), 3, "ACTIVE", "OCCUPIED", staff01, true);
        context.SupportTickets.Add(new SupportTicket
        {
            CustomerId = cust01.UserId, ContractId = k01.ContractId, UnitId = units["K01"].UnitId, IssueType = "UNIT",
            Title = "Cửa cuốn kho kẹt khi mở", Description = "Cửa cuốn ô K01 kéo lên được nửa thì kẹt, nhờ cơ sở kiểm tra.",
            Priority = "NORMAL", Status = "OPEN", CreatedAt = Utc(today.AddDays(-1), 16, 20)
        });

        // K02 · sắp hết hạn, khách xin gia hạn 3 tháng
        var k02Start = today.AddDays(10).AddMonths(-3);
        var k02 = await RentAsync(cust03, "K02", catalog.NormalM, k02Start, 3, "ACTIVE", "OCCUPIED", staff01, true);
        context.ContractRenewals.Add(new ContractRenewal
        {
            ContractId = k02.ContractId, OldEndDate = k02.EndDate, NewEndDate = k02.EndDate.AddMonths(3), RenewalPeriodMonths = 3,
            OldMonthlyRate = k02.AgreedMonthlyRate, NewMonthlyRate = k02.AgreedMonthlyRate, RenewalAmount = k02.AgreedMonthlyRate * 3,
            Status = "PENDING", RequestedAt = Utc(today.AddDays(-1), 10, 5), CreatedAt = Utc(today.AddDays(-1), 10, 5)
        });

        // K03 · quá hạn 3 ngày, chưa thanh toán kỳ mới
        var k03Start = today.AddDays(-3).AddMonths(-1);
        var k03 = await RentAsync(cust04, "K03", catalog.NormalM, k03Start, 1, "OVERDUE", "OCCUPIED", staff01, true);
        context.Payments.Add(new Payment
        {
            ContractId = k03.ContractId, PaymentType = "RENT", Amount = k03.AgreedMonthlyRate, Currency = "VND",
            PaymentMethod = "BANK_TRANSFER", DueDate = k03.EndDate, Status = "PENDING",
            CreatedAt = Utc(k03.EndDate.AddDays(-7), 8), UpdatedAt = Utc(k03.EndDate.AddDays(-7), 8)
        });
        context.OverdueCases.Add(new OverdueCase
        {
            ContractId = k03.ContractId, OverdueFrom = k03.EndDate.AddDays(1), GraceDeadline = k03.EndDate.AddDays(8),
            OutstandingAmount = k03.AgreedMonthlyRate, Status = "OPEN", OpenedAt = Utc(k03.EndDate.AddDays(1), 8)
        });

        // K05 · kho lạnh M đã phân bổ, chờ khách đến xác minh + nhận kho (giao cho staff01)
        await RentAsync(cust05, "K05", catalog.ColdM, today.AddDays(1), 3, "DRAFT", "RESERVED", staff01, false);

        // K07 · khách đã đăng ký trả kho, chờ kiểm tra (chưa phân công nhân viên) + còn nợ phí vệ sinh
        var k07Start = today.AddDays(1).AddMonths(-3);
        var k07 = await RentAsync(cust06, "K07", catalog.NormalL, k07Start, 3, "RETURN_PENDING", "RETURN_PENDING", staff01, true);
        context.ReturnInspections.Add(new ReturnInspection
        {
            ContractId = k07.ContractId, StaffId = manager.UserId, ScheduledAt = Utc(today.AddDays(1), 10),
            Status = "SCHEDULED", CreatedAt = Utc(today.AddDays(-2), 9)
        });
        context.Payments.Add(new Payment
        {
            ContractId = k07.ContractId, PaymentType = "CLEANING_FEE", Amount = 200000m, Currency = "VND",
            PaymentMethod = "BANK_TRANSFER", DueDate = k07.EndDate, Status = "PENDING",
            CreatedAt = Utc(today.AddDays(-2), 9), UpdatedAt = Utc(today.AddDays(-2), 9)
        });

        // K09 · customer02 đang thuê dài hạn
        await RentAsync(cust02, "K09", catalog.NormalL, today.AddDays(-40), 6, "ACTIVE", "OCCUPIED", staff01, true);

        // K10 · bảo trì
        units["K10"].Status = "MAINTENANCE";
        units["K10"].UpdatedAt = nowUtc;

        // Khoản chờ đối soát (S09): khách đã bấm "Tôi đã chuyển khoản"
        var pv1 = await ReserveAsync(cust02, catalog.NormalM, today.AddDays(5), 3, "PENDING_VERIFICATION", nowUtc.AddMinutes(-50));
        Log(cust02.UserId, "TRANSFER_REPORTED", "RESERVATION", pv1.ReservationId, new { amount = pv1.EstimatedAmount + pv1.RequiredDeposit }, nowUtc.AddMinutes(-45));
        var pv2 = await ReserveAsync(cust01, catalog.ColdL, today.AddDays(3), 1, "PENDING_VERIFICATION", nowUtc.AddHours(-14));
        Log(cust01.UserId, "TRANSFER_REPORTED", "RESERVATION", pv2.ReservationId, new { amount = pv2.EstimatedAmount + pv2.RequiredDeposit }, nowUtc.AddHours(-13.9));

        // Đơn đã đối soát, chờ quản lý phân bổ ô (M05) — ô phù hợp: K06
        var confirmed = await ReserveAsync(cust06, catalog.ColdM, today.AddDays(6), 3, "CONFIRMED", nowUtc.AddDays(-1).AddHours(-3));
        Log(staff01.UserId, "PAYMENT_CONFIRMED", "RESERVATION", confirmed.ReservationId,
            new { amount = confirmed.EstimatedAmount + confirmed.RequiredDeposit }, nowUtc.AddDays(-1));

        // Đơn chờ chuyển khoản của customer01 — dùng để thử nút "Tôi đã chuyển khoản"
        await ReserveAsync(cust01, catalog.NormalL, today.AddDays(5), 1, "PENDING_PAYMENT", nowUtc);

        await context.SaveChangesAsync();
    }
}
