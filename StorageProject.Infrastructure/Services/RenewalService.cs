using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Renewal;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ quản lý vòng đời gia hạn hợp đồng thuê (RenewalService) thực thi IRenewalService.
/// Xử lý gửi yêu cầu gia hạn, chọn thanh toán tại quầy, duyệt/từ chối, huỷ yêu cầu, thu tiền mặt tại quầy và quét hết hạn thanh toán.
/// </summary>
public class RenewalService(AppDbContext dbContext, IPayOSGateway gateway) : IRenewalService
{
    /// <summary>
    /// Lấy danh sách lịch sử các đợt gia hạn của một hợp đồng thuê thuộc quyền sở hữu của khách hàng.
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="contractId">ID hợp đồng.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Danh sách các đợt gia hạn.</returns>
    public async Task<IReadOnlyList<RenewalDto>> GetContractRenewalsAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var ownsContract = await dbContext.RentalContracts
            .AnyAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct);

        if (!ownsContract)
        {
            return [];
        }

        return await dbContext.ContractRenewals
            .AsNoTracking()
            .Where(r => r.ContractId == contractId)
            .OrderByDescending(r => r.RequestedAt)
            .Select(r => new RenewalDto(
                r.RenewalId,
                r.ContractId,
                r.OldEndDate,
                r.NewEndDate,
                r.RenewalPeriodMonths,
                r.OldMonthlyRate,
                r.NewMonthlyRate,
                r.RenewalAmount,
                r.Status,
                r.RequestedAt,
                r.ApprovedAt,
                r.PaymentDeadlineAt,
                r.AppliedAt,
                r.ExpiredAt,
                r.Payments.Where(p => p.PaymentType == "RENEWAL").Select(p => (long?)p.PaymentId).FirstOrDefault(),
                r.PolicyVersion,
                r.AcceptedAt
            ))
            .ToListAsync(ct);
    }

    /// <summary>
    /// Khách hàng gửi yêu cầu gia hạn hợp đồng thuê (phải chấp thuận chính sách hiện hành và ô chưa bị khách mới đặt trước D41).
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="contractId">ID hợp đồng cần gia hạn.</param>
    /// <param name="request">Yêu cầu gia hạn gồm số tháng và phiên bản chính sách đồng ý.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Bản ghi gia hạn mới tạo ở trạng thái PENDING.</returns>
    public async Task<RenewalDto> RequestRenewalAsync(long customerId, long contractId, CreateRenewalRequest request, CancellationToken ct = default)
    {
        if (request.RenewalPeriodMonths <= 0)
        {
            throw new ArgumentException("Thời gian gia hạn phải lớn hơn 0 tháng.");
        }

        var contract = await dbContext.RentalContracts
            .Include(c => c.Unit)
            .Where(c => c.ContractId == contractId && c.CustomerId == customerId)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Không tìm thấy hợp đồng hợp lệ.");

        if (contract.Status != "ACTIVE" && contract.Status != "EXPIRING")
        {
            throw new InvalidOperationException($"Chỉ hợp đồng ở trạng thái 'ACTIVE' mới có thể gia hạn. Trạng thái hiện tại: {contract.Status}");
        }

        // Vietnam time now
        var vnToday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        if (contract.EndDate <= vnToday)
        {
            throw new InvalidOperationException("Hợp đồng đã đến hoặc quá ngày hết hạn, không thể gửi yêu cầu gia hạn.");
        }

        // D46: gia hạn sang ô khác — kiểm ô khách chọn còn trống (cùng loại, hoặc loại đã đặt ban đầu sau nâng cấp D41).
        RenewalUnitOptionDto? targetOption = null;
        if (request.TargetUnitId is long targetUnitId)
        {
            if (await RenewalUnitMove.HasPendingMoveAsync(dbContext, contractId, ct))
                throw new InvalidOperationException("Hợp đồng đang chuyển sang ô mới. Gửi gia hạn tiếp sau khi chuyển đồ xong.");
            targetOption = await RenewalUnitMove.ValidateAsync(dbContext, contract, targetUnitId, ct);
        }
        // D41: ô đã có khách mới đặt trước từ ngày hết hạn → khoá gia hạn ô này (khách có thể chuyển sang ô khác còn trống)
        else if (await UnitAvailability.NextBookingAsync(dbContext, contract, ct) is DateOnly bookedFrom)
        {
            throw new InvalidOperationException($"Ô đã có khách đặt từ {bookedFrom:dd/MM/yyyy}, không gia hạn được ô này. Liên hệ cơ sở để chuyển sang ô khác còn trống.");
        }

        // Check if there is already a pending or approved renewal open
        var hasOpenRenewal = await dbContext.ContractRenewals
            .AnyAsync(r => r.ContractId == contractId && (r.Status == "PENDING" || r.Status == "APPROVED"), ct);

        if (hasOpenRenewal)
        {
            throw new InvalidOperationException("Hợp đồng đã có yêu cầu gia hạn đang chờ xử lý hoặc chờ thanh toán.");
        }

        // Policy consent verification (D32 / BO07: bắt buộc accepted/policyVersion khi gửi gia hạn)
        if (!request.PolicyVersion.HasValue || request.Accepted != true)
        {
            throw new ArgumentException("Bạn phải đồng ý với chính sách cho thuê hiện hành để gửi yêu cầu gia hạn.");
        }

        var currentPolicy = await dbContext.RentalPolicyVersions
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(v => v.IsCurrent, ct);

        var expectedVersion = currentPolicy?.Version ?? 1;
        if (request.PolicyVersion.Value != expectedVersion)
        {
            throw new InvalidOperationException("Phiên bản chính sách không còn hiệu lực. Vui lòng tải lại trang để chấp thuận bản mới nhất.");
        }

        int? consentVersion = expectedVersion;
        DateTime? consentAcceptedAt = DateTime.UtcNow;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var activeRate = await dbContext.RentalRates
            .Where(r => r.FacilityId == contract.Unit.FacilityId 
                     && r.UnitTypeId == contract.Unit.UnitTypeId 
                     && r.EffectiveFrom <= today 
                     && (r.EffectiveTo == null || r.EffectiveTo >= today))
            .OrderByDescending(r => r.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var newRate = targetOption?.MonthlyRate ?? activeRate?.MonthlyRate ?? contract.AgreedMonthlyRate;
        var oldEndDate = contract.EndDate;
        var newEndDate = oldEndDate.AddMonths(request.RenewalPeriodMonths);
        var renewalAmount = newRate * request.RenewalPeriodMonths;

        var renewal = new ContractRenewal
        {
            ContractId = contract.ContractId,
            OldEndDate = oldEndDate,
            NewEndDate = newEndDate,
            RenewalPeriodMonths = request.RenewalPeriodMonths,
            OldMonthlyRate = contract.AgreedMonthlyRate,
            NewMonthlyRate = newRate,
            RenewalAmount = renewalAmount,
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow,
            PolicyVersion = consentVersion,
            AcceptedAt = consentAcceptedAt,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ContractRenewals.Add(renewal);
        await dbContext.SaveChangesAsync(ct);
        if (targetOption != null)
        {
            RenewalUnitMove.Record(dbContext, contract, renewal, targetOption);
            await dbContext.SaveChangesAsync(ct);
        }

        if (consentVersion.HasValue)
        {
            var policyVer = await dbContext.RentalPolicyVersions
                .FirstOrDefaultAsync(v => v.Version == consentVersion.Value, ct);

            dbContext.PolicyConsents.Add(new PolicyConsent
            {
                CustomerId = customerId,
                PolicyVersionId = policyVer?.PolicyVersionId ?? 1,
                RenewalId = renewal.RenewalId,
                ContractId = contract.ContractId,
                AcceptedAt = consentAcceptedAt!.Value,
                Channel = "WEB_CUSTOMER"
            });
            await dbContext.SaveChangesAsync(ct);
        }

        return new RenewalDto(
            renewal.RenewalId,
            renewal.ContractId,
            renewal.OldEndDate,
            renewal.NewEndDate,
            renewal.RenewalPeriodMonths,
            renewal.OldMonthlyRate,
            renewal.NewMonthlyRate,
            renewal.RenewalAmount,
            renewal.Status,
            renewal.RequestedAt,
            renewal.ApprovedAt,
            renewal.PaymentDeadlineAt,
            renewal.AppliedAt,
            renewal.ExpiredAt,
            null,
            renewal.PolicyVersion,
            renewal.AcceptedAt
        );
    }

    /// <summary>
    /// Khách hàng chọn phương thức thanh toán tiền mặt tại quầy cho khoản gia hạn đã duyệt (S02).
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="renewalId">ID yêu cầu gia hạn.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thông tin yêu cầu gia hạn đã chuyển phương thức thanh toán sang CASH.</returns>
    public async Task<RenewalDto> SelectCounterPaymentAsync(long customerId, long renewalId, CancellationToken ct = default)
    {
        // S02 (Phiên 3): khoá theo hợp đồng như lúc nhân viên thu tiền / PayOS ghi nhận, tránh đổi sang quầy giữa chừng.
        var contractId = await dbContext.ContractRenewals.AsNoTracking()
            .Where(r => r.RenewalId == renewalId && r.Contract.CustomerId == customerId)
            .Select(r => (long?)r.ContractId)
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn của bạn.");
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{contractId}", ct);

        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract)
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId && r.Contract.CustomerId == customerId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn của bạn.");

        if (renewal.Status != "APPROVED")
        {
            throw new InvalidOperationException($"Chỉ yêu cầu gia hạn ở trạng thái 'APPROVED' mới có thể chọn thanh toán tại quầy. Trạng thái hiện tại: {renewal.Status}");
        }

        // BO07: Kiểm tra khách hàng đã có bằng chứng đồng ý chính sách trước khi cho phép chọn trả tại quầy
        var hasConsent = await dbContext.PolicyConsents
            .AnyAsync(c => (c.RenewalId == renewal.RenewalId || c.ContractId == renewal.ContractId) && c.CustomerId == customerId, ct);
        if (!hasConsent && renewal.PolicyVersion.HasValue)
        {
            var policyVer = await dbContext.RentalPolicyVersions.FirstOrDefaultAsync(v => v.Version == renewal.PolicyVersion.Value, ct);
            dbContext.PolicyConsents.Add(new PolicyConsent
            {
                CustomerId = customerId,
                PolicyVersionId = policyVer?.PolicyVersionId ?? 1,
                RenewalId = renewal.RenewalId,
                ContractId = renewal.ContractId,
                AcceptedAt = renewal.AcceptedAt ?? DateTime.UtcNow,
                Channel = "WEB_CUSTOMER"
            });
        }

        var now = DateTime.UtcNow;
        if (renewal.PaymentDeadlineAt.HasValue && now >= renewal.PaymentDeadlineAt.Value)
        {
            throw new InvalidOperationException("Yêu cầu gia hạn đã hết hạn thanh toán.");
        }

        // Cancel any open PayOS link
        var payment = renewal.Payments.FirstOrDefault(p => p.PaymentType == "RENEWAL" && p.Status == "PENDING")
            ?? throw new InvalidOperationException("Không tìm thấy khoản thanh toán gia hạn chờ xử lý.");

        var openCheckouts = await dbContext.PaymentCheckouts
            .Where(c => c.PaymentId == payment.PaymentId && c.Status == "PENDING")
            .ToListAsync(ct);

        foreach (var c in openCheckouts)
        {
            try
            {
                await gateway.CancelAsync(c.OrderCode);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Chưa xác nhận huỷ được link PayOS. Vui lòng thử lại trước khi đổi sang thanh toán tại quầy.", ex);
            }
            c.Status = "CANCELLED";
            c.UpdatedAt = now;
        }

        payment.PaymentMethod = "CASH";
        payment.UpdatedAt = now;

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = customerId,
            EntityType = "RENEWAL",
            EntityId = renewal.RenewalId,
            Action = "COUNTER_PAYMENT_SELECTED",
            NewValue = JsonSerializer.Serialize(new { renewal.RenewalId, payment.PaymentId, payment.Amount }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new RenewalDto(
            renewal.RenewalId,
            renewal.ContractId,
            renewal.OldEndDate,
            renewal.NewEndDate,
            renewal.RenewalPeriodMonths,
            renewal.OldMonthlyRate,
            renewal.NewMonthlyRate,
            renewal.RenewalAmount,
            renewal.Status,
            renewal.RequestedAt,
            renewal.ApprovedAt,
            renewal.PaymentDeadlineAt,
            renewal.AppliedAt,
            renewal.ExpiredAt,
            payment.PaymentId,
            renewal.PolicyVersion,
            renewal.AcceptedAt
        );
    }

    /// <summary>
    /// Lấy danh sách các khoản gia hạn chờ thu tiền mặt tại quầy của cơ sở được phân công (S02).
    /// </summary>
    /// <param name="userId">ID nhân viên hoặc quản lý cơ sở.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Danh sách khoản gia hạn chờ thu tại quầy.</returns>
    public async Task<IReadOnlyList<CounterRenewalDto>> GetCounterRenewalsAsync(long userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .Where(uf => uf.UserId == userId && uf.Status == "ACTIVE"
                         && uf.AssignedFrom <= today
                         && (uf.AssignedTo == null || uf.AssignedTo >= today))
            .OrderByDescending(uf => uf.AssignedFrom)
            .FirstOrDefaultAsync(ct)
            ?? await dbContext.UserFacilities
                .AsNoTracking()
                .Where(uf => uf.UserId == userId && uf.Status == "ACTIVE")
                .OrderByDescending(uf => uf.AssignedFrom)
                .FirstOrDefaultAsync(ct);

        if (userFacility == null) return [];

        var facilityId = userFacility.FacilityId;
        var now = DateTime.UtcNow;

        var renewals = await dbContext.ContractRenewals
            .AsNoTracking()
            .Include(r => r.Contract).ThenInclude(c => c.Customer)
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .Include(r => r.Payments)
            .Where(r => r.Contract.Unit.FacilityId == facilityId
                     && (r.Status == "APPROVED" || (r.Status == "PAID" && r.AppliedAt >= now.AddDays(-1)))
                     && r.Payments.Any(p => p.PaymentType == "RENEWAL" && p.PaymentMethod == "CASH"))
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);

        var list = new List<CounterRenewalDto>();
        foreach (var r in renewals)
        {
            var p = r.Payments.FirstOrDefault(x => x.PaymentType == "RENEWAL" && x.PaymentMethod == "CASH")
                ?? r.Payments.FirstOrDefault(x => x.PaymentType == "RENEWAL");
            if (p == null) continue;

            // Only show if not expired
            if (r.Status == "APPROVED" && r.PaymentDeadlineAt.HasValue && r.PaymentDeadlineAt.Value <= now)
            {
                continue;
            }

            var contractCode = FacilityOpsService.ContractCode(r.Contract);
            list.Add(new CounterRenewalDto(
                Id: $"GHQ-{r.RenewalId:D4}",
                RenewalId: r.RenewalId,
                PaymentId: p.PaymentId,
                ContractId: contractCode,
                ContractCode: contractCode,
                FacilityId: facilityId,
                Unit: r.Contract.Unit?.UnitNumber ?? "—",
                Customer: r.Contract.Customer?.FullName ?? "—",
                Amount: r.RenewalAmount,
                Months: r.RenewalPeriodMonths,
                PaymentDeadlineAt: r.PaymentDeadlineAt,
                Status: r.Status == "PAID" ? "PAID" : "PENDING"
            ));
        }

        return list;
    }

    /// <summary>
    /// Nhân viên cơ sở xác nhận thu tiền mặt cho khoản gia hạn tại quầy (S02).
    /// </summary>
    /// <param name="userId">ID nhân viên thu tiền.</param>
    /// <param name="id">Mã khoản gia hạn.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task CollectCounterRenewalAsync(long userId, string id, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .Where(uf => uf.UserId == userId && uf.Status == "ACTIVE"
                         && uf.AssignedFrom <= today
                         && (uf.AssignedTo == null || uf.AssignedTo >= today))
            .OrderByDescending(uf => uf.AssignedFrom)
            .FirstOrDefaultAsync(ct)
            ?? await dbContext.UserFacilities
                .AsNoTracking()
                .Where(uf => uf.UserId == userId && uf.Status == "ACTIVE")
                .OrderByDescending(uf => uf.AssignedFrom)
                .FirstOrDefaultAsync(ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.");

        var renewalId = FacilityOpsStateStore.ParseIdNumber(id);
        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");

        if (renewal.Contract.Unit.FacilityId != userFacility.FacilityId)
        {
            throw new UnauthorizedAccessException("Yêu cầu gia hạn không thuộc cơ sở do bạn phụ trách.");
        }

        // BO07: Nhân viên không tự đồng ý thay khách khi thu tiền mặt; bắt buộc có consent từ phía khách
        // S02 / C11: consent phải của chính khách, đúng phiên bản chính sách khách đã đồng ý khi gửi gia hạn.
        var hasCustomerConsent = await dbContext.PolicyConsents
            .AnyAsync(c => (c.RenewalId == renewal.RenewalId || c.ContractId == renewal.ContractId)
                        && c.CustomerId == renewal.Contract.CustomerId, ct);
        if (!hasCustomerConsent && renewal.PolicyVersion.HasValue)
        {
            throw new InvalidOperationException("Khách hàng chưa hoàn tất chấp thuận chính sách cho thuê cho kỳ gia hạn này. Nhân viên không được thu tiền khi chưa có xác nhận từ khách.");
        }

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{renewal.ContractId}", ct);

        // S02 (Phiên 3): không thu tiền mặt hai lần tại quầy. Đọc lại trong khoá; chỉ thu khoản khách đã chọn trả tại quầy.
        var counterPayment = await dbContext.Payments
            .Where(p => p.RenewalId == renewal.RenewalId && p.PaymentType == "RENEWAL")
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);
        var currentStatus = await dbContext.ContractRenewals
            .Where(r => r.RenewalId == renewal.RenewalId).Select(r => r.Status).FirstAsync(ct);
        if (currentStatus == "PAID" || counterPayment?.Status == "PAID")
        {
            // Idempotent: Gửi lại cùng yêu cầu không đổi kết quả và không báo lỗi 500
            await tx.CommitAsync(ct);
            return;
        }
        if (counterPayment == null || counterPayment.Status != "PENDING" || counterPayment.PaymentMethod != "CASH")
        {
            throw new InvalidOperationException("Khách chưa chọn thanh toán gia hạn tại quầy.");
        }

        var success = await RenewalSettlement.RecordAsync(
            dbContext,
            renewal.ContractId,
            renewal.RenewalId,
            "CASH",
            $"CASH-RENEWAL:{renewal.RenewalId}", // tham chiếu cố định: gửi lặp chỉ là idempotent, không tạo khoản thu thứ hai
            userId,
            ct
        );

        if (!success)
        {
            throw new InvalidOperationException("Không thể xác nhận thu tiền (đã thanh toán hoặc quá hạn thanh toán).");
        }

        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Phê duyệt yêu cầu gia hạn (M01 / M03): tạo khoản thanh toán RENEWAL PENDING và đặt thời hạn thanh toán 24 giờ.
    /// </summary>
    /// <param name="userId">ID Quản lý phê duyệt.</param>
    /// <param name="renewalId">ID yêu cầu gia hạn.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Thông tin gia hạn sau phê duyệt.</returns>
    public async Task<RenewalDto> ApproveRenewalAsync(long userId, long renewalId, CancellationToken ct = default)
    {
        var userFacility = await dbContext.UserFacilities.AsNoTracking()
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.");
        var facilityOfRenewal = await dbContext.ContractRenewals.AsNoTracking()
            .Where(r => r.RenewalId == renewalId).Select(r => (long?)r.Contract.Unit.FacilityId).FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");
        if (facilityOfRenewal != userFacility.FacilityId)
            throw new UnauthorizedAccessException("Yêu cầu gia hạn không thuộc cơ sở do bạn phụ trách.");

        // M01: một đường duyệt chuẩn cho mọi route.
        var (renewal, payment) = await RenewalApproval.ApproveAsync(dbContext, userId, renewalId, userFacility.FacilityId, ct);
        return new RenewalDto(
            renewal.RenewalId, renewal.ContractId, renewal.OldEndDate, renewal.NewEndDate, renewal.RenewalPeriodMonths,
            renewal.OldMonthlyRate, renewal.NewMonthlyRate, renewal.RenewalAmount, renewal.Status, renewal.RequestedAt,
            renewal.ApprovedAt, renewal.PaymentDeadlineAt, renewal.AppliedAt, renewal.ExpiredAt, payment.PaymentId,
            renewal.PolicyVersion, renewal.AcceptedAt);
    }

    /// <summary>
    /// Từ chối yêu cầu gia hạn hợp đồng (M03) kèm lý do.
    /// </summary>
    /// <param name="userId">ID Quản lý thực hiện.</param>
    /// <param name="renewalId">ID yêu cầu gia hạn.</param>
    /// <param name="reason">Lý do từ chối gửi cho khách.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task RejectRenewalAsync(long userId, long renewalId, string reason, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Nhập lý do từ chối để gửi cho khách hàng.");
        }

        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract).ThenInclude(c => c.Unit)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn.");

        var userFacility = await dbContext.UserFacilities
            .AsNoTracking()
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.");

        if (renewal.Contract.Unit.FacilityId != userFacility.FacilityId)
        {
            throw new UnauthorizedAccessException("Yêu cầu gia hạn không thuộc cơ sở do bạn phụ trách.");
        }

        if (renewal.Status != "PENDING")
        {
            throw new InvalidOperationException("Yêu cầu này đã được xử lý.");
        }

        var now = DateTime.UtcNow;
        renewal.Status = "REJECTED";
        renewal.ApprovedBy = userId;
        renewal.ApprovedAt = now;

        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            EntityType = "RENEWAL",
            EntityId = renewal.RenewalId,
            Action = "RENEWAL_REJECTED",
            NewValue = JsonSerializer.Serialize(new { renewal.RenewalId, reason }),
            LoggedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Khách hàng tự huỷ yêu cầu gia hạn khi yêu cầu vẫn còn ở trạng thái PENDING chờ duyệt (L5).
    /// </summary>
    /// <param name="customerId">ID khách hàng.</param>
    /// <param name="renewalId">ID yêu cầu gia hạn.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task CancelRenewalAsync(long customerId, long renewalId, CancellationToken ct = default)
    {
        var renewal = await dbContext.ContractRenewals
            .Include(r => r.Contract)
            .FirstOrDefaultAsync(r => r.RenewalId == renewalId && r.Contract.CustomerId == customerId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu gia hạn của bạn.");
        // Chỉ huỷ khi còn chờ duyệt. Đã duyệt thì khoản RENEWAL đang chờ thanh toán; để hết hạn 24 giờ hoặc thanh toán.
        if (renewal.Status != "PENDING")
            throw new InvalidOperationException("Chỉ huỷ được yêu cầu gia hạn đang chờ duyệt.");

        var now = DateTime.UtcNow;
        renewal.Status = "CANCELLED";
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = customerId,
            EntityType = "RENEWAL",
            EntityId = renewal.RenewalId,
            Action = "RENEWAL_CANCELLED",
            NewValue = JsonSerializer.Serialize(new { renewal.RenewalId, by = "CUSTOMER" }),
            LoggedAt = now
        });
        await dbContext.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Quét và xử lý các yêu cầu gia hạn APPROVED đã quá hạn thanh toán (PaymentDeadlineAt) chuyển sang EXPIRED (T02).
    /// </summary>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    public async Task ExpirePendingRenewalsAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var expiredRenewals = await dbContext.ContractRenewals
            .Include(r => r.Payments)
            .Where(r => r.Status == "APPROVED" && r.PaymentDeadlineAt.HasValue && r.PaymentDeadlineAt.Value <= now)
            .ToListAsync(ct);

        foreach (var r in expiredRenewals)
        {
            await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract:{r.ContractId}", ct);

            r.Status = "EXPIRED";
            r.ExpiredAt = now;

            foreach (var p in r.Payments.Where(p => p.PaymentType == "RENEWAL" && p.Status == "PENDING"))
            {
                p.Status = "FAILED";
                p.UpdatedAt = now;

                var checkouts = await dbContext.PaymentCheckouts
                    .Where(c => c.PaymentId == p.PaymentId && c.Status == "PENDING")
                    .ToListAsync(ct);

                foreach (var c in checkouts)
                {
                    c.Status = "EXPIRED";
                    c.UpdatedAt = now;
                }
            }

            await RenewalUnitMove.ReleaseAsync(dbContext, r.RenewalId, null, $"Hết hạn thanh toán gia hạn GH-{r.RenewalId:0000} · trả ô giữ", ct);
            dbContext.ActivityLogs.Add(new ActivityLog
            {
                EntityType = "RENEWAL",
                EntityId = r.RenewalId,
                Action = "RENEWAL_EXPIRED",
                NewValue = JsonSerializer.Serialize(new { r.RenewalId, r.ContractId, reason = "PAYMENT_DEADLINE_EXCEEDED" }),
                LoggedAt = now
            });

            await dbContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
    }

    // ===== D46 · Gia hạn sang ô khác =====
    public async Task<RenewalUnitOptionsDto> GetRenewalUnitOptionsAsync(long customerId, long contractId, CancellationToken ct = default)
    {
        var contract = await dbContext.RentalContracts.Include(c => c.Unit)
            .FirstOrDefaultAsync(c => c.ContractId == contractId && c.CustomerId == customerId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
        return await RenewalUnitMove.OptionsAsync(dbContext, contract, ct);
    }

    public Task<UnitMoveDto?> GetUnitMoveAsync(long customerId, long contractId, CancellationToken ct = default) =>
        RenewalUnitMove.CurrentForContractAsync(dbContext, customerId, contractId, ct);

    public Task<UnitMoveDto> MarkUnitMovedAsync(long customerId, long contractId, CancellationToken ct = default) =>
        RenewalUnitMove.MarkMovedAsync(dbContext, customerId, contractId, ct);

    private async Task<long> FacilityOfAsync(long userId, CancellationToken ct) =>
        (await dbContext.UserFacilities.AsNoTracking().FirstOrDefaultAsync(uf => uf.UserId == userId && uf.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa được phân công phụ trách cơ sở.")).FacilityId;

    public async Task<IReadOnlyList<UnitMoveDto>> GetOldUnitInspectionsAsync(long userId, CancellationToken ct = default) =>
        await RenewalUnitMove.PendingInspectionsAsync(dbContext, await FacilityOfAsync(userId, ct), ct);

    public async Task<UnitMoveDto> InspectOldUnitAsync(long userId, long renewalId, UnitMoveInspectionRequest request, CancellationToken ct = default) =>
        await RenewalUnitMove.InspectAsync(dbContext, userId, await FacilityOfAsync(userId, ct), renewalId, request, ct);
}
