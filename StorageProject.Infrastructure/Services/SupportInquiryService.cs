using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Dịch vụ hỗ trợ tư vấn và giải đáp thắc mắc khách hàng chưa có hợp đồng (SupportInquiryService) thực thi ISupportInquiryService.
/// Triển khai theo T19: Khách hàng chọn cơ sở và gửi câu hỏi; nhân viên/quản lý đúng cơ sở trả lời; hỗ trợ cơ chế Idempotency với ClientRequestId.
/// </summary>
public sealed class SupportInquiryService(AppDbContext db) : ISupportInquiryService
{
    private sealed record Actor(bool Customer, long? FacilityId);
    private async Task<Actor> ActorAsync(long userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().Include(x => x.UserRoles).ThenInclude(x => x.Role)
            .SingleOrDefaultAsync(x => x.UserId == userId && x.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Tài khoản không được phép sử dụng hỗ trợ.");
        var roles = user.UserRoles.Select(x => x.Role.RoleName).ToList();
        if (roles.Contains("STAFF") || roles.Contains("MANAGER"))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
            var assignment = await db.UserFacilities.AsNoTracking().Where(x => x.UserId == userId &&
                x.Status == "ACTIVE" && x.AssignedFrom <= today && (x.AssignedTo == null || x.AssignedTo >= today))
                .OrderByDescending(x => x.AssignedFrom).Select(x => new { x.FacilityId }).FirstOrDefaultAsync(ct)
                ?? throw new UnauthorizedAccessException("Tài khoản chưa được phân công cơ sở hiện hành.");
            return new(false, assignment.FacilityId);
        }
        if (roles.Contains("CUSTOMER")) return new(true, null);
        throw new UnauthorizedAccessException("Chức năng dành cho khách hàng và nhân viên/quản lý cơ sở.");
    }
    private IQueryable<SupportInquiry> Query(long userId, Actor actor) => db.SupportInquiries
        .Include(x => x.Customer).Include(x => x.Replies).ThenInclude(x => x.Author)
        .Where(x => actor.Customer ? x.CustomerId == userId : x.FacilityId == actor.FacilityId);

    /// <summary>
    /// Lấy danh sách các yêu cầu hỗ trợ tư vấn trong phạm vi người dùng (khách hàng xem của mình; nhân viên/quản lý xem của cơ sở phụ trách).
    /// </summary>
    /// <param name="userId">ID người dùng.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Danh sách các yêu cầu tư vấn.</returns>
    public async Task<IReadOnlyList<InquiryDto>> ListAsync(long userId, CancellationToken ct = default)
    {
        var actor = await ActorAsync(userId, ct);
        return (await Query(userId, actor).AsNoTracking().OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.InquiryId)
            .ToListAsync(ct)).Select(ToDto).ToList();
    }

    /// <summary>
    /// Lấy thông tin chi tiết một yêu cầu tư vấn kèm toàn bộ lịch sử trao đổi phản hồi.
    /// </summary>
    /// <param name="userId">ID người dùng.</param>
    /// <param name="id">Mã yêu cầu tư vấn (dạng "TV-xxxx").</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Chi tiết yêu cầu tư vấn.</returns>
    public async Task<InquiryDto> GetAsync(long userId, string id, CancellationToken ct = default)
    {
        var actor = await ActorAsync(userId, ct);
        var number = Number(id);
        var item = await Query(userId, actor).AsNoTracking().SingleOrDefaultAsync(x => x.InquiryId == number, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu hỗ trợ thuộc phạm vi của bạn.");
        return ToDto(item);
    }

    /// <summary>
    /// Thực hiện hành động tạo mới (CREATE_INQUIRY) hoặc gửi phản hồi (REPLY_INQUIRY) cho yêu cầu tư vấn.
    /// Đảm bảo Idempotency qua ClientRequestId và kiểm soát xung đột phiên bản qua ExpectedVersion.
    /// </summary>
    /// <param name="userId">ID người dùng.</param>
    /// <param name="request">Yêu cầu hành động.</param>
    /// <param name="ct">CancellationToken kiểm soát huỷ bỏ tác vụ.</param>
    /// <returns>Dữ liệu yêu cầu tư vấn sau khi cập nhật.</returns>
    public async Task<InquiryDto> ActAsync(long userId, InquiryActionRequest request, CancellationToken ct = default)
    {
        var actor = await ActorAsync(userId, ct);
        if (request.ClientRequestId is not Guid requestId || requestId == Guid.Empty)
            throw new ArgumentException("Yêu cầu thiếu mã gửi. Tải lại biểu mẫu và thử lại.");
        if (request.Action == "CREATE_INQUIRY")
        {
            if (!actor.Customer) throw new UnauthorizedAccessException("Chỉ khách hàng được gửi yêu cầu tư vấn mới.");
            var title = Text(request.Title, 100, "chủ đề");
            var description = Text(request.Description, 1000, "nội dung");
            if (request.FacilityId is not long facilityId || facilityId <= 0) throw new ArgumentException("Chọn cơ sở cần hỗ trợ.");
            await using var tx = await CheckoutTransaction.BeginAsync(db, $"inquiry-create:{userId}", ct);
            var prior = await Query(userId, actor).SingleOrDefaultAsync(x => x.ClientRequestId == requestId, ct);
            if (prior != null)
            {
                if (prior.FacilityId != facilityId || prior.Title != title || prior.Description != description)
                    throw new OpsConflictException("Mã gửi đã dùng cho nội dung khác. Tải lại trước khi gửi.");
                return ToDto(prior);
            }
            if (!await db.Facilities.AnyAsync(x => x.FacilityId == facilityId && x.Status == "ACTIVE", ct))
                throw new ArgumentException("Cơ sở không còn tiếp nhận yêu cầu tư vấn mới.");
            var now = DateTime.UtcNow;
            var item = new SupportInquiry { CustomerId = userId, FacilityId = facilityId, Title = title,
                Description = description, ClientRequestId = requestId, CreatedAt = now, UpdatedAt = now };
            db.SupportInquiries.Add(item);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            return await GetAsync(userId, $"TV-{item.InquiryId:0000}", ct);
        }
        if (request.Action != "REPLY_INQUIRY") throw new ArgumentException("Thao tác hỗ trợ không hợp lệ.");
        var id = Number(request.Id); var note = Text(request.Note, 1000, "phản hồi");
        if (actor.Customer && request.Close) throw new UnauthorizedAccessException("Chỉ cơ sở được đóng yêu cầu khi phản hồi.");
        await using var replyTx = await CheckoutTransaction.BeginAsync(db, $"inquiry:{id}", ct);
        var inquiry = await Query(userId, actor).SingleOrDefaultAsync(x => x.InquiryId == id, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu hỗ trợ thuộc phạm vi của bạn.");
        var previous = inquiry.Replies.SingleOrDefault(x => x.AuthorId == userId && x.ClientRequestId == requestId);
        if (previous != null)
        {
            if (previous.Note != note || previous.CloseRequested != request.Close)
                throw new OpsConflictException("Mã gửi đã dùng cho phản hồi khác. Tải lại trước khi gửi.");
            return ToDto(inquiry);
        }
        if (request.ExpectedVersion != inquiry.Version)
            throw new OpsConflictException("Yêu cầu đã có phản hồi mới. Tải lại trước khi gửi tiếp.");
        // D43: hỗ trợ là cuộc trò chuyện, không có thao tác đóng. Dữ liệu CLOSED cũ vẫn trả lời tiếp được.
        var at = DateTime.UtcNow;
        inquiry.Replies.Add(new SupportInquiryReply { AuthorId = userId, Note = note, ClientRequestId = requestId,
            CloseRequested = request.Close, CreatedAt = at });
        inquiry.Status = actor.Customer ? "OPEN" : "WAITING_CUSTOMER"; // cờ close (giao diện cũ) bỏ qua — D43
        inquiry.Version++; inquiry.UpdatedAt = at;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new OpsConflictException("Yêu cầu vừa thay đổi. Tải lại trước khi gửi."); }
        await replyTx.CommitAsync(ct);
        return await GetAsync(userId, request.Id!, ct);
    }
    private static long Number(string? id) => id != null && id.StartsWith("TV-", StringComparison.Ordinal) &&
        long.TryParse(id[3..], out var number) && number > 0 ? number : throw new KeyNotFoundException("Không tìm thấy yêu cầu hỗ trợ.");
    private static string Text(string? value, int max, string label)
    {
        var s = (value ?? "").Trim();
        if (s.Length is < 1 || s.Length > max) throw new ArgumentException($"Nhập {label} từ 1 đến {max} ký tự.");
        return s;
    }
    private static InquiryDto ToDto(SupportInquiry i) => new($"TV-{i.InquiryId:0000}", i.CustomerId, i.FacilityId,
        i.Customer.FullName, i.Title, i.Description, i.Status, i.Version, DateTime.SpecifyKind(i.CreatedAt, DateTimeKind.Utc),
        i.Replies.OrderBy(x => x.CreatedAt).ThenBy(x => x.ReplyId)
            .Select(x => new InquiryReplyDto(x.Author.FullName, x.Note, DateTime.SpecifyKind(x.CreatedAt, DateTimeKind.Utc), x.AuthorId)).ToList());
}
