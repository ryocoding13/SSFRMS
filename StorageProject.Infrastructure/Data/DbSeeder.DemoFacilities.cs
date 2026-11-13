using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// #60 · Dữ liệu demo theo từng cơ sở (D48: chỉ thêm dữ liệu, không đổi bảng/cột).
/// Mỗi cơ sở đang hoạt động có:
/// - 1 nhân viên Staff_&lt;MÃ&gt; và 1 quản lý Manager_&lt;MÃ&gt; được phân công đúng cơ sở (mỗi quản lý 1 cơ sở).
/// - Nhân viên / quản lý có họ tên thật (DemoStaffNames), không còn tên dạng "Quản lý &lt;cơ sở&gt;".
/// - customer01 là khách hàng duy nhất của toàn hệ thống: tại mỗi cơ sở thuê 1–6 hợp đồng đang hiệu lực (số lượng khác nhau
///   giữa các cơ sở để báo cáo vận hành thấy chênh lệch), ngày bắt đầu rải qua 5 tháng gần nhất để biểu đồ doanh thu không trống,
///   tất cả còn trong hạn. Mỗi cơ sở dùng tối đa 6/12 ô; các ô còn lại để tự demo đặt kho.
/// Chạy lại không tạo trùng, không ghi đè dữ liệu đã có; ô được chọn phải trống và không có hợp đồng/đơn giữ chỗ khác.
/// Mật khẩu chung (chỉ dùng cho database demo): Staff@123, Manager@123, Customer@123.
/// </summary>
public static partial class DbSeeder
{
    /// <summary>Mã viết tắt duy nhất của từng cơ sở (viết hoa, không dấu), dùng trong tên tài khoản demo.</summary>
    public static readonly IReadOnlyDictionary<string, string> DemoFacilityCodes = new Dictionary<string, string>
    {
        ["SafeSpace Nguyễn Lương Bằng"] = "NLB",
        ["SafeSpace Him Lam"] = "HL",
        ["SafeSpace Phú Xuân"] = "PX",
        ["SafeSpace Tân Thuận"] = "TT",
        ["SafeSpace Phú Mỹ Hưng"] = "PMH",
        ["SafeSpace Bình Thạnh"] = "BTH",
        ["SafeSpace Nhà Bè"] = "NB",
        ["SafeSpace Bình Chánh"] = "BC",
        ["SafeSpace Thủ Đức"] = "TD",
        ["SafeSpace Gò Vấp"] = "GV",
        ["SafeSpace Tân Bình"] = "TB",
        ["SafeSpace Bình Tân"] = "BTA",
    };

    /// <summary>Tài khoản khách hàng demo duy nhất, đứng tên mọi hợp đồng demo ở cả 12 cơ sở.</summary>
    public const string DemoCustomerUsername = "customer01";

    /// <summary>Họ tên nhân viên (Staff_&lt;MÃ&gt;) và quản lý (Manager_&lt;MÃ&gt;) của từng cơ sở.</summary>
    public static readonly IReadOnlyDictionary<string, (string Staff, string Manager)> DemoStaffNames = new Dictionary<string, (string, string)>
    {
        ["NLB"] = ("Võ Thanh Tùng", "Đỗ Ngọc Hân"),
        ["HL"] = ("Bùi Đức Thịnh", "Lý Thanh Hương"),
        ["PX"] = ("Huỳnh Gia Khang", "Mai Phương Thảo"),
        ["TT"] = ("Đặng Quốc Việt", "Tô Mỹ Linh"),
        ["PMH"] = ("Ngô Hoàng Phúc", "Trương Bảo Ngọc"),
        ["BTH"] = ("Phan Minh Nhật", "Hồ Thị Kim Oanh"),
        ["NB"] = ("Lâm Tấn Phát", "Dương Hải Yến"),
        ["BC"] = ("Châu Văn Lộc", "Vũ Thị Thanh Tâm"),
        ["TD"] = ("Kiều Anh Dũng", "Nguyễn Hoài Thương"),
        ["GV"] = ("Cao Thành Đạt", "Lê Ngọc Trâm"),
        ["TB"] = ("La Minh Khôi", "Phùng Thị Diễm"),
        ["BTA"] = ("Hà Đức Trọng", "Tạ Quỳnh Như"),
    };

    /// <summary>Số hợp đồng demo của customer01 tại từng cơ sở (tối đa 6).</summary>
    public static readonly IReadOnlyDictionary<string, int> DemoFacilityOrderCounts = new Dictionary<string, int>
    {
        ["NLB"] = 4, ["HL"] = 6, ["PX"] = 5, ["TT"] = 2, ["PMH"] = 6, ["BTH"] = 4,
        ["NB"] = 1, ["BC"] = 3, ["TD"] = 5, ["GV"] = 2, ["TB"] = 4, ["BTA"] = 3,
    };

    /// <summary>
    /// Thứ tự hợp đồng demo: (loại kho, bắt đầu cách hôm nay bao nhiêu ngày, số tháng). Cơ sở có N hợp đồng lấy N dòng đầu.
    /// Mọi kỳ thuê đều còn hiệu lực; dòng 3 hết hạn trong khoảng 12 ngày để thử mốc "Sắp hết hạn" (14 ngày).
    /// </summary>
    private static readonly (string Type, int DaysAgo, int Months)[] DemoOrderSlots =
    [
        ("NormalL", 8, 6),     // tháng này
        ("ColdM", 120, 6),     // 4 tháng trước
        ("ColdL", 80, 3),      // ~2,5 tháng trước, sắp hết hạn
        ("NormalM", 155, 9),   // 5 tháng trước
        ("NormalM", 60, 12),   // 2 tháng trước
        ("NormalL", 35, 6),    // tháng trước
    ];

    private static readonly string[] DemoLiveReservationStatuses = ["PENDING_PAYMENT", "PENDING_AT_FACILITY", "PENDING_VERIFICATION", "CONFIRMED", "UNIT_ASSIGNED"];
    private static readonly string[] DemoRunningContractStatuses = ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];

    /// <summary>Tạo (nếu chưa có) tài khoản, phân công và đơn/hợp đồng demo cho mọi cơ sở trong danh sách.</summary>
    private static async Task EnsureDemoFacilityDataAsync(AppDbContext context, SeedCatalog catalog, long adminId)
    {
        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc.AddHours(7));
        DateTime Utc(DateOnly d, int hour, int minute = 0) =>
            DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(hour, minute)).AddHours(-7), DateTimeKind.Utc);

        var policyVersion = await context.RentalPolicyVersions.OrderByDescending(v => v.Version).FirstOrDefaultAsync();
        var facilities = await context.Facilities.Where(f => f.Status == "ACTIVE").ToListAsync();

        foreach (var facility in facilities)
        {
            if (!DemoFacilityCodes.TryGetValue(facility.Name, out var code)) continue;
            var lower = code.ToLowerInvariant();

            var (staffName, managerName) = DemoStaffNames.TryGetValue(code, out var names)
                ? names : ($"Nhân viên {ShortName(facility.Name)}", $"Quản lý {ShortName(facility.Name)}");
            var staff = await EnsureUserAsync(context, $"Staff_{code}", $"staff.{lower}@safespace.vn", "Staff@123", staffName, "0900000100", "STAFF");
            var manager = await EnsureUserAsync(context, $"Manager_{code}", $"manager.{lower}@safespace.vn", "Manager@123", managerName, "0900000200", "MANAGER");
            // DB cũ còn tên tạm "Nhân viên/Quản lý <cơ sở>" thì đổi sang họ tên thật (không đè tên admin đã sửa)
            RenamePlaceholder(staff, $"Nhân viên {ShortName(facility.Name)}", staffName);
            RenamePlaceholder(manager, $"Quản lý {ShortName(facility.Name)}", managerName);
            var renter = await EnsureUserAsync(context, DemoCustomerUsername, "an.nguyen@example.com", "Customer@123", "Nguyễn Văn An", "0901234567", "CUSTOMER");

            // Phân công: chỉ gán khi tài khoản chưa có cơ sở nào đang hiệu lực (không đè phân công admin đã đổi)
            foreach (var user in new[] { staff, manager })
            {
                if (await context.UserFacilities.AnyAsync(uf => uf.UserId == user.UserId && uf.Status == "ACTIVE")) continue;
                context.UserFacilities.Add(new UserFacility
                {
                    UserId = user.UserId, FacilityId = facility.FacilityId, AssignedBy = adminId,
                    AssignedFrom = today.AddDays(-30), Status = "ACTIVE", CreatedAt = nowUtc
                });
            }
            await context.SaveChangesAsync();

            var rates = (await context.RentalRates
                    .Where(r => r.FacilityId == facility.FacilityId && r.Status == "ACTIVE" && r.EffectiveFrom <= today)
                    .ToListAsync())
                .GroupBy(r => r.UnitTypeId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.EffectiveFrom).First().MonthlyRate);

            // Ô trống thật: AVAILABLE, không có hợp đồng đang giữ và không có phân bổ của đơn còn hiệu lực
            async Task<StorageUnit?> FreeUnitAsync(long unitTypeId) =>
                await context.StorageUnits
                    .Where(u => u.FacilityId == facility.FacilityId && u.UnitTypeId == unitTypeId && u.Status == "AVAILABLE")
                    .Where(u => !context.RentalContracts.Any(c => c.UnitId == u.UnitId && (c.Status == "DRAFT" || DemoRunningContractStatuses.Contains(c.Status))))
                    .Where(u => !context.UnitAssignments.Any(a => a.UnitId == u.UnitId && a.Status == "ACTIVE"
                                                                  && DemoLiveReservationStatuses.Contains(a.Reservation.Status)))
                    .OrderBy(u => u.UnitNumber)
                    .FirstOrDefaultAsync();

            Reservation NewReservation(User customer, UnitType type, DateOnly start, int months, string status, DateTime createdAt)
            {
                var rate = rates.TryGetValue(type.UnitTypeId, out var r) ? r : 0m;
                return new Reservation
                {
                    CustomerId = customer.UserId, FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId,
                    StartDate = start, RentalPeriodMonths = months, ExpectedEndDate = start.AddMonths(months),
                    CheckInAppointmentAt = Utc(start, 9), QuotedMonthlyRate = rate, EstimatedAmount = rate * months,
                    RequiredDeposit = rate, // D27/D42: cọc = 1 tháng tiền thuê
                    Status = status, CreatedAt = createdAt
                };
            }

            void Consent(User customer, Reservation r, DateTime at)
            {
                if (policyVersion == null) return;
                context.PolicyConsents.Add(new PolicyConsent
                {
                    CustomerId = customer.UserId, PolicyVersionId = policyVersion.PolicyVersionId,
                    ReservationId = r.ReservationId, AcceptedAt = at, Channel = "WEB_CUSTOMER"
                });
            }

            // customer01 là khách duy nhất: N hợp đồng đang thuê (N khác nhau giữa các cơ sở, tối đa 6),
            // đã thanh toán trước cả kỳ, có QR/PIN. Đếm theo số hợp đồng đã có nên chạy lại không tạo thêm.
            var target = DemoFacilityOrderCounts.TryGetValue(code, out var n) ? n : 1;
            var existing = await context.RentalContracts.CountAsync(c => c.CustomerId == renter.UserId && c.Unit.FacilityId == facility.FacilityId);
            for (var slot = existing; slot < Math.Min(target, DemoOrderSlots.Length); slot++)
            {
                var (typeKey, daysAgo, months) = DemoOrderSlots[slot];
                var type = typeKey switch { "NormalL" => catalog.NormalL, "ColdM" => catalog.ColdM, "ColdL" => catalog.ColdL, _ => catalog.NormalM };
                if (!rates.ContainsKey(type.UnitTypeId) || await FreeUnitAsync(type.UnitTypeId) is not StorageUnit unit) continue;

                var start = today.AddDays(-daysAgo);
                var paidAt = Utc(start.AddDays(-2), 10);
                var reservation = NewReservation(renter, type, start, months, "UNIT_ASSIGNED", paidAt.AddMinutes(-30));
                reservation.PaidAt = paidAt;
                reservation.ExpiresAt = paidAt;
                context.Reservations.Add(reservation);
                await context.SaveChangesAsync();
                Consent(renter, reservation, paidAt.AddMinutes(-20));

                context.UnitAssignments.Add(new UnitAssignment
                {
                    ReservationId = reservation.ReservationId, UnitId = unit.UnitId, AssignedAt = paidAt,
                    Status = "ACTIVE", Reason = "Dữ liệu demo #60"
                });
                var contract = new RentalContract
                {
                    ReservationId = reservation.ReservationId, CustomerId = renter.UserId, UnitId = unit.UnitId,
                    StartDate = start, EndDate = reservation.ExpectedEndDate, AgreedMonthlyRate = reservation.QuotedMonthlyRate,
                    DepositAmount = reservation.RequiredDeposit, Status = "ACTIVE", CreatedAt = paidAt, ActivatedAt = paidAt
                };
                context.RentalContracts.Add(contract);
                await context.SaveChangesAsync();

                foreach (var (kind, amount) in new[] { ("DEPOSIT", reservation.RequiredDeposit), ("RENT", reservation.EstimatedAmount) })
                {
                    context.Payments.Add(new Payment
                    {
                        ContractId = contract.ContractId, ReservationId = reservation.ReservationId, PaymentType = kind, Amount = amount,
                        Currency = "VND", PaymentMethod = "PAYMENT_GATEWAY",
                        // Mã giao dịch là UNIQUE: mỗi khoản một mã, giống ReservationSettlement ("{mã đơn}:{loại}")
                        TransactionReference = $"SS-{reservation.CreatedAt.AddHours(7):yyyyMMdd}-{reservation.ReservationId:0000}:{kind}",
                        DueDate = start, PaidAt = paidAt, Status = "PAID", CreatedAt = paidAt, UpdatedAt = paidAt
                    });
                }
                // D26: QR và PIN là hai mã riêng, cấp ngay sau thanh toán
                foreach (var kind in new[] { "QR", "PIN" })
                {
                    context.AccessCredentials.Add(new AccessCredential
                    {
                        ContractId = contract.ContractId, UnitId = unit.UnitId, IssuedBy = adminId, CredentialType = "ACCESS_CODE",
                        CredentialReference = $"{kind}-{reservation.ReservationId}", IssuedAt = paidAt, Status = "ACTIVE"
                    });
                }
                context.UnitStatusHistories.Add(new UnitStatusHistory
                {
                    UnitId = unit.UnitId, ChangedBy = adminId, OldStatus = unit.Status, NewStatus = "OCCUPIED",
                    ChangedAt = paidAt, Reason = "Dữ liệu demo #60: hợp đồng đang thuê"
                });
                unit.Status = "OCCUPIED";
                unit.UpdatedAt = paidAt;
                context.ActivityLogs.Add(new ActivityLog
                {
                    UserId = null, Action = "CONTRACT_AUTO_ISSUED", EntityType = "CONTRACT", EntityId = contract.ContractId,
                    NewValue = JsonSerializer.Serialize(new { unit = unit.UnitNumber, demo = true }), LoggedAt = paidAt
                });
                await context.SaveChangesAsync();
            }
        }
    }

    /// <summary>Đổi họ tên khi tài khoản còn giữ đúng tên tạm cũ (chạy lại không đổi gì thêm).</summary>
    private static void RenamePlaceholder(User user, string placeholder, string fullName)
    {
        if (user.FullName != placeholder || placeholder == fullName) return;
        user.FullName = fullName;
        user.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>"SafeSpace Nguyễn Lương Bằng" → "Nguyễn Lương Bằng".</summary>
    private static string ShortName(string facilityName) =>
        facilityName.StartsWith("SafeSpace ", StringComparison.Ordinal) ? facilityName["SafeSpace ".Length..] : facilityName;
}
