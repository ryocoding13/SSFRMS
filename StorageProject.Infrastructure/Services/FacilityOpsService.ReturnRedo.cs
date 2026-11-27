using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D71 · Quản lý trả biên bản trả kho về cho nhân viên kiểm tra lại (trước khi chốt đối soát).
/// Biên bản cũ chuyển CANCELLED (giữ để đối chiếu), hệ thống tạo lịch kiểm tra mới cùng ngày hẹn để nhân viên lập biên bản mới.
/// Khách không được thông báo. Khi nhân viên gửi lại: khấu trừ không đổi thì giữ phản hồi cũ của khách; đổi thì khách xác nhận lại (D39/D40).
/// </summary>
public partial class FacilityOpsService
{
    /// <summary>Nhật ký trên biên bản mới: ghi chú của quản lý và mã biên bản bị trả lại.</summary>
    internal const string ReturnRedoRequested = "RETURN_INSPECTION_REDO_REQUESTED";
    /// <summary>Nhật ký trên biên bản cũ: đã bị quản lý trả lại.</summary>
    internal const string ReturnReportSentBack = "RETURN_INSPECTION_SENT_BACK";

    /// <summary>Quản lý yêu cầu nhân viên kiểm tra lại và lập biên bản trả kho mới, kèm ghi chú bắt buộc.</summary>
    public async Task RedoReturnInspectionAsync(OpsActor actor, string id, OpsNoteRequest request, CancellationToken ct = default)
    {
        RequireManager(actor);
        var facility = await FacilityOfAsync(actor, ct);
        var note = Clip(request.Note, 1000);
        if (note.Length == 0) throw new ArgumentException("Ghi rõ điều nhân viên cần kiểm tra lại.");

        var contractId = (await InspectionAsync(facility.FacilityId, id, ct)).ContractId;
        // Cùng khoá với bước chốt đối soát (và hệ thống tự chốt) để không trả lại đúng lúc hợp đồng đang được chốt.
        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"contract-settlement:{contractId}", ct);
        await CheckoutTransaction.LockAsync(dbContext, $"return-inspection:{facility.FacilityId}:{id}", ct);
        dbContext.ChangeTracker.Clear();
        var old = await InspectionAsync(facility.FacilityId, id, ct);
        if (old.Status != "COMPLETED") throw new InvalidOperationException("Biên bản chưa được gửi hoặc đã được trả lại cho nhân viên.");
        if (old.Contract.Status != "RETURN_PENDING")
            throw new InvalidOperationException("Hợp đồng đã chốt đối soát, không trả lại biên bản được.");
        if (await dbContext.Payments.AnyAsync(p => p.ContractId == contractId && p.PaymentType == "REFUND", ct))
            throw new InvalidOperationException("Hoàn cọc đã được chốt, không trả lại biên bản được.");

        var now = NowUtc;
        old.Status = "CANCELLED";
        var redo = new ReturnInspection
        {
            ContractId = old.ContractId,
            StaffId = old.StaffId,
            ScheduledAt = old.ScheduledAt,
            // Giữ thời điểm khách gửi trả kho: phí quá hạn và hạn 3 ngày của nhân viên vẫn tính từ lúc đó.
            CreatedAt = old.CreatedAt,
            Status = "SCHEDULED",
            RefundBankName = old.RefundBankName,
            RefundAccountNumber = old.RefundAccountNumber,
            RefundAccountHolder = old.RefundAccountHolder,
        };
        dbContext.ReturnInspections.Add(redo);
        await dbContext.SaveChangesAsync(ct);

        // Ảnh khách gửi khi yêu cầu trả kho thuộc về lịch trả kho, chép sang lịch mới để nhân viên vẫn xem được.
        await CopyPhotosAsync(EvidencePhotos.MoveOut, old.InspectionId, redo.InspectionId, ct);
        Log(actor.UserId, ReturnRedoRequested, LogEntity.Return, redo.InspectionId, new
        {
            note, previous = ReturnCode(old.InspectionId), previousInspectionId = old.InspectionId, at = Local(now)
        });
        Log(actor.UserId, ReturnReportSentBack, LogEntity.Return, old.InspectionId, new { note, redo = ReturnCode(redo.InspectionId) });
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Gọi khi nhân viên gửi biên bản mới của một lịch kiểm tra lại: khấu trừ (vệ sinh, hư hỏng) giống biên bản cũ thì
    /// giữ phản hồi / kiểm tra lại / tự chốt 48 giờ cũ của khách; khác thì để khách xác nhận lại như biên bản mới.
    /// </summary>
    private async Task CarryOverDeductionAsync(ReturnInspection redo, CancellationToken ct)
    {
        var request = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == LogEntity.Return && l.EntityId == redo.InspectionId && l.Action == ReturnRedoRequested)
            .OrderByDescending(l => l.LoggedAt).FirstOrDefaultAsync(ct);
        if (request == null || !long.TryParse(Read(request, "previousInspectionId"), out var previousId)) return;
        var previous = await dbContext.ReturnInspections.AsNoTracking().FirstOrDefaultAsync(i => i.InspectionId == previousId, ct);
        if (previous == null || !SameDeduction(previous, redo)) return;

        var logs = await dbContext.ActivityLogs.AsNoTracking()
            .Where(l => l.EntityType == LogEntity.Return && l.EntityId == previousId
                        && (l.Action == FlowAction.DeductionDecision || l.Action == FlowAction.DeductionRecheck || l.Action == FlowAction.DeductionAutoAgreed))
            .OrderBy(l => l.LoggedAt).ToListAsync(ct);
        foreach (var l in logs)
        {
            dbContext.ActivityLogs.Add(new ActivityLog
            {
                UserId = l.UserId, Action = l.Action, EntityType = l.EntityType, EntityId = redo.InspectionId,
                OldValue = l.OldValue, NewValue = l.NewValue, IpAddress = l.IpAddress, LoggedAt = l.LoggedAt
            });
        }
        if (logs.Count > 0) await CopyPhotosAsync(EvidencePhotos.ReturnDeduction, previousId, redo.InspectionId, ct);
    }

    /// <summary>Hai biên bản có cùng các khoản khấu trừ vào cọc (vệ sinh, hư hỏng).</summary>
    internal static bool SameDeduction(ReturnInspection a, ReturnInspection b) =>
        a.DamageFee == b.DamageFee && a.CleaningFee == b.CleaningFee && a.CleaningRequired == b.CleaningRequired;

    private async Task CopyPhotosAsync(string ownerType, long fromId, long toId, CancellationToken ct)
    {
        var photos = await dbContext.EvidencePhotos.AsNoTracking()
            .Where(p => p.OwnerType == ownerType && p.OwnerId == fromId).ToListAsync(ct);
        foreach (var p in photos)
        {
            dbContext.EvidencePhotos.Add(new EvidencePhoto
            {
                OwnerType = p.OwnerType, OwnerId = toId, FileName = p.FileName, ContentType = p.ContentType,
                SizeBytes = p.SizeBytes, Data = p.Data, UploadedBy = p.UploadedBy, CreatedAt = p.CreatedAt
            });
        }
    }
}
