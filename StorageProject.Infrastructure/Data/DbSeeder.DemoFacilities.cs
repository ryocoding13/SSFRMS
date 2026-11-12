using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Data;

/// <summary>
/// #60 · Dữ liệu demo theo từng cơ sở (D48: chỉ thêm dữ liệu, không đổi bảng/cột).
/// Mỗi cơ sở đang hoạt động có:
/// - 1 nhân viên Staff_&lt;MÃ&gt; và 1 quản lý Manager_&lt;MÃ&gt; được phân công đúng cơ sở (mỗi quản lý 1 cơ sở).
/// - Customer&lt;MÃ&gt;01: hợp đồng đang thuê đã thanh toán, có QR/PIN — để thử gia hạn, trả kho, máy quét.
/// - Customer&lt;MÃ&gt;02: đơn chờ thanh toán tại quầy — để nhân viên thử thu tiền tại quầy.
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

            var staff = await EnsureUserAsync(context, $"Staff_{code}", $"staff.{lower}@safespace.vn", "Staff@123", $"Nhân viên {ShortName(facility.Name)}", "0900000100", "STAFF");
            var manager = await EnsureUserAsync(context, $"Manager_{code}", $"manager.{lower}@safespace.vn", "Manager@123", $"Quản lý {ShortName(facility.Name)}", "0900000200", "MANAGER");
            var renter = await EnsureUserAsync(context, $"Customer{code}01", $"customer{lower}01@example.com", "Customer@123", $"Khách {code} 01", "0900000301", "CUSTOMER");
            var payer = await EnsureUserAsync(context, $"Customer{code}02", $"customer{lower}02@example.com", "Customer@123", $"Khách {code} 02", "0900000302", "CUSTOMER");

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

            // 1. Customer<MÃ>01: hợp đồng đang thuê (bắt đầu 20 ngày trước, 3 tháng), đã thanh toán, có QR/PIN
            var hasRunning = await context.RentalContracts.AnyAsync(c => c.CustomerId == renter.UserId && DemoRunningContractStatuses.Contains(c.Status));
            if (!hasRunning && rates.ContainsKey(catalog.NormalM.UnitTypeId) && await FreeUnitAsync(catalog.NormalM.UnitTypeId) is StorageUnit unit)
            {
                var start = today.AddDays(-20);
                var paidAt = Utc(start.AddDays(-2), 10);
                var reservation = NewReservation(renter, catalog.NormalM, start, 3, "UNIT_ASSIGNED", paidAt.AddMinutes(-30));
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

            // 2. Customer<MÃ>02: một đơn chờ thu tiền tại quầy còn hiệu lực (hết hạn cuối ngày nhận kho, như PayAtFacilityAsync)
            var hasPending = await context.Reservations.AnyAsync(r => r.CustomerId == payer.UserId && r.FacilityId == facility.FacilityId
                && r.Status == "PENDING_AT_FACILITY" && r.ExpiresAt > nowUtc);
            if (!hasPending && rates.ContainsKey(catalog.NormalL.UnitTypeId) && await FreeUnitAsync(catalog.NormalL.UnitTypeId) is StorageUnit proposed)
            {
                var start = today.AddDays(3);
                var reservation = NewReservation(payer, catalog.NormalL, start, 1, "PENDING_AT_FACILITY", nowUtc);
                reservation.PaymentMethod = "AT_FACILITY";
                reservation.ExpiresAt = Services.OpsRules.CalculateCounterHoldDeadlineUtc(start);
                context.Reservations.Add(reservation);
                await context.SaveChangesAsync();
                Consent(payer, reservation, nowUtc);
                // #2: ô hệ thống đã bố trí cho đơn (activity_logs UNIT_PROPOSED)
                context.ActivityLogs.Add(new ActivityLog
                {
                    UserId = payer.UserId, Action = "UNIT_PROPOSED", EntityType = "RESERVATION", EntityId = reservation.ReservationId,
                    NewValue = JsonSerializer.Serialize(new { unitId = proposed.UnitId, unit = proposed.UnitNumber, reason = "Dữ liệu demo #60" }),
                    LoggedAt = nowUtc
                });
                await context.SaveChangesAsync();
            }
        }
    }

    /// <summary>"SafeSpace Nguyễn Lương Bằng" → "Nguyễn Lương Bằng".</summary>
    private static string ShortName(string facilityName) =>
        facilityName.StartsWith("SafeSpace ", StringComparison.Ordinal) ? facilityName["SafeSpace ".Length..] : facilityName;
}
