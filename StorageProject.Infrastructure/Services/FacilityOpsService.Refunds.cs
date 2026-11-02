using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>Phiên bản client gửi đã cũ (người khác vừa xử lý) → 409 để giao diện tải lại, không ghi đè.</summary>
public sealed class OpsConflictException(string message) : InvalidOperationException(message);

/// <summary>
/// Hoàn cọc sau trả kho (D32 / T07). Bước 1 ở M07 tạo khoản REFUND PENDING ("Chờ hoàn");
/// bước 2 quản lý ghi mã giao dịch → PAID ("Đã hoàn"). Mỗi khoản chỉ đổi trạng thái một lần nên version = 1 hoặc 2.
/// Khoản hoàn cọc là REFUND gắn hợp đồng, không gắn đơn đặt chỗ (hoàn đơn huỷ xem M08 / ConfirmReservationRefundAsync).
/// </summary>
public partial class FacilityOpsService
{
    private const string ConfirmDepositRefundAction = "CONFIRM_DEPOSIT_REFUND";

    private IQueryable<Payment> DepositRefundQuery() => dbContext.Payments
        .Include(p => p.Contract).ThenInclude(c => c.Unit)
        .Include(p => p.Contract).ThenInclude(c => c.Customer)
        .Include(p => p.Contract).ThenInclude(c => c.ReturnInspections)
        .Where(p => p.PaymentType == "REFUND" && p.ReservationId == null && p.ContractId != null);

    public async Task<IReadOnlyList<DepositRefundDto>> GetDepositRefundsAsync(OpsActor actor, CancellationToken ct = default)
    {
        var facility = await FacilityOfAsync(actor, ct);
        var since = NowUtc.AddDays(-60);
        var rows = await DepositRefundQuery().AsNoTracking().AsSplitQuery()
            .Where(p => p.Contract.Unit.FacilityId == facility.FacilityId && (p.Status == "PENDING" || p.CreatedAt >= since))
            .ToListAsync(ct);
        return await ToDepositRefundDtosAsync(rows, ct);
    }

    public async Task<IReadOnlyList<DepositRefundDto>> GetCustomerDepositRefundsAsync(long customerId, CancellationToken ct = default)
    {
        var rows = await DepositRefundQuery().AsNoTracking().AsSplitQuery()
            .Where(p => p.Contract.CustomerId == customerId)
            .ToListAsync(ct);
        return await ToDepositRefundDtosAsync(rows, ct);
    }

    public async Task<DepositRefundDto> ConfirmDepositRefundAsync(OpsActor actor, DepositRefundActionRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        if (!string.Equals((request.Action ?? string.Empty).Trim(), ConfirmDepositRefundAction, StringComparison.Ordinal))
        {
            throw new ArgumentException("Thao tác hoàn cọc không hợp lệ.");
        }
        var facility = await FacilityOfAsync(actor, ct);
        var paymentId = ParseCode(request.Id, "HC-", "khoản hoàn cọc");
        if (!request.Confirmed) throw new ArgumentException("Cần xác nhận đã chuyển đúng số tiền vào đúng tài khoản.");
        var reference = TransactionRefOf(request.TransactionRef);

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"deposit-refund:{paymentId}", ct);
        var p = await DepositRefundQuery().AsSplitQuery()
                    .FirstOrDefaultAsync(x => x.PaymentId == paymentId && x.Contract.Unit.FacilityId == facility.FacilityId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy khoản hoàn cọc tại cơ sở của bạn.");
        if (request.ExpectedVersion is not int expected || expected != VersionOf(p))
        {
            throw new OpsConflictException("Khoản hoàn đã thay đổi. Tải lại trước khi gửi tiếp; không chuyển tiền lần nữa.");
        }
        if (p.Status != "PENDING" || p.Amount <= 0) throw new InvalidOperationException("Khoản hoàn không còn chờ xử lý.");

        var incident = await dbContext.FacilityIncidents.AsNoTracking().FirstOrDefaultAsync(i => i.RefundPaymentId == p.PaymentId, ct);
        var account = AccountOf(p, incident);
        if (account == null || !RefundBank.IsComplete(account.BankName, account.AccountNumber, account.AccountHolder))
        {
            throw new InvalidOperationException("Khách chưa khai tài khoản nhận hoàn chính chủ. Liên hệ khách bổ sung trước khi chuyển tiền.");
        }
        if (RefundBank.NormalizeHolder(account.AccountHolder) != RefundBank.NormalizeHolder(p.Contract.Customer.FullName))
        {
            throw new InvalidOperationException("Tên chủ tài khoản không trùng tên trên hợp đồng. Không chuyển tiền.");
        }
        var paidAt = TransferTimeOf(request.TransferredAt, p.CreatedAt, "chốt đối soát");
        await EnsureUniqueTransactionRefAsync(reference, p.PaymentId, ct);

        p.Status = "PAID";
        p.PaidAt = paidAt;
        p.TransactionReference = reference;
        p.UpdatedAt = NowUtc;
        Log(actor.UserId, "DEPOSIT_REFUND_TRANSFERRED", LogEntity.Contract, p.Contract.ContractId,
            new { refund = p.Amount, payment = $"HC-{p.PaymentId:0000}", transactionRef = reference, transferredAt = paidAt });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return (await ToDepositRefundDtosAsync([p], ct))[0];
    }

    private static int VersionOf(Payment p) => p.Status == "PENDING" ? 1 : 2;

    /// <summary>Tài khoản nhận hoàn: khai khi kết thúc do sự cố cơ sở (T13) hoặc khi gửi trả kho (T08).</summary>
    private static RefundBank.Account? AccountOf(Payment p, FacilityIncident? incident)
    {
        if (incident?.RefundBankName != null)
            return new RefundBank.Account(incident.RefundBankName, incident.RefundAccountNumber ?? "", incident.RefundAccountHolder ?? "");
        var i = LatestInspection(p.Contract);
        return i?.RefundBankName == null ? null : new RefundBank.Account(i.RefundBankName, i.RefundAccountNumber ?? "", i.RefundAccountHolder ?? "");
    }

    private static ReturnInspection? LatestInspection(RentalContract c) =>
        c.ReturnInspections.Where(i => i.Status == "COMPLETED").OrderByDescending(i => i.InspectedAt ?? i.CreatedAt).FirstOrDefault();

    private static IReadOnlyList<EvidencePhotoDto> PhotosOf(Dictionary<long, List<EvidencePhotoDto>> photos, long? ownerId) =>
        ownerId.HasValue && photos.TryGetValue(ownerId.Value, out var list) ? (IReadOnlyList<EvidencePhotoDto>)list : Array.Empty<EvidencePhotoDto>();

    private static DateTime? Utc(DateTime? value) => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

    private async Task<IReadOnlyList<DepositRefundDto>> ToDepositRefundDtosAsync(List<Payment> rows, CancellationToken ct)
    {
        var logs = await LogsAsync(LogEntity.Contract, rows.Select(p => p.Contract.ContractId).Distinct().ToList(), ct);
        var paymentIds = rows.Select(p => p.PaymentId).ToList();
        var incidents = await dbContext.FacilityIncidents.AsNoTracking()
            .Where(i => i.RefundPaymentId != null && paymentIds.Contains(i.RefundPaymentId.Value))
            .ToDictionaryAsync(i => i.RefundPaymentId!.Value, ct);
        var inspections = rows.Select(p => LatestInspection(p.Contract)).Where(i => i != null).Select(i => i!.InspectionId).Distinct().ToList();
        var photos = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.ReturnInspection, inspections, ct);

        decimal Number(ActivityLog? log, string field) =>
            log != null && decimal.TryParse(Read(log, field), System.Globalization.NumberStyles.Number, Invariant, out var v) ? v : 0m;

        return rows
            .OrderBy(p => p.Status == "PENDING" ? 0 : 1).ThenByDescending(p => p.CreatedAt)
            .Select(p =>
            {
                var c = p.Contract;
                var i = LatestInspection(c);
                var settled = logs.LastOrDefault(l => l.EntityId == c.ContractId && l.Action == LogAction.DepositRefunded);
                var damage = settled != null ? Number(settled, "damage") : i?.DamageFee ?? 0m;
                var cleaning = settled != null ? Number(settled, "fixedDeduction") : i?.CleaningFee ?? 0m;
                var overdue = Number(settled, "overdue");
                var paid = p.Status == "PAID";
                incidents.TryGetValue(p.PaymentId, out var incident);
                var account = AccountOf(p, incident);
                return new DepositRefundDto(
                    $"HC-{p.PaymentId:0000}", c.Unit.FacilityId, c.CustomerId, ContractCode(c), c.Unit.UnitNumber, c.Customer.FullName,
                    VersionOf(p), c.DepositAmount, overdue, cleaning, damage, p.Amount, paid ? "PAID" : p.Status,
                    Utc(i?.CreatedAt), Utc(p.CreatedAt), Utc(p.CreatedAt), paid ? Utc(p.PaidAt) : null, p.DueDate,
                    paid ? p.TransactionReference : null, account?.BankName, account?.AccountNumber, account?.AccountHolder,
                    incident != null ? $"Kết thúc do sự cố cơ sở ({incident.CaseCode}): {incident.Description}" : i?.Notes,
                    incident != null ? Array.Empty<EvidencePhotoDto>() : PhotosOf(photos, i?.InspectionId));
            })
            .ToList();
    }
}
