using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class SupportTicketService(AppDbContext dbContext) : ISupportTicketService
{
    public async Task<IReadOnlyList<SupportTicketDto>> GetMyTicketsAsync(long customerId, CancellationToken ct = default)
    {
        return await dbContext.SupportTickets
            .AsNoTracking()
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new SupportTicketDto(
                t.TicketId,
                t.ContractId ?? 0,
                t.UnitId,
                t.IssueType,
                t.Title,
                t.Priority,
                t.Status,
                t.CreatedAt,
                t.ResolvedAt,
                t.ClosedAt
            ))
            .ToListAsync(ct);
    }

    // Code cũ được giữ để đối chiếu.
    // public async Task<SupportTicketDetailDto?> GetTicketDetailAsync(long customerId, long ticketId, CancellationToken ct = default)
    // {
    //     var t = await dbContext.SupportTickets
    //         .AsNoTracking()
    //         .Include(x => x.Contract)
    //             .ThenInclude(c => c!.Unit)
    //         .FirstOrDefaultAsync(x => x.TicketId == ticketId && x.CustomerId == customerId, ct);
    //
    //     if (t == null) return null;
    //
    //     var unitNumber = t.Contract?.Unit?.UnitNumber ?? "N/A";
    //
    //     return new SupportTicketDetailDto(
    //         t.TicketId,
    //         t.ContractId ?? 0,
    //         unitNumber,
    //         t.UnitId,
    //         t.IssueType,
    //         t.Title,
    //         t.Description,
    //         t.Priority,
    //         t.Status,
    //         t.CreatedAt,
    //         t.AssignedAt,
    //         t.ResolvedAt,
    //         t.ClosedAt
    //     );
    // }
    // Chỉ đọc phản hồi của ticket thuộc khách hiện tại, sắp theo thời gian và không trả nhật ký nội bộ khác.
    public async Task<SupportTicketDetailDto?> GetTicketDetailAsync(long customerId, long ticketId, CancellationToken ct = default)
    {
        var t = await dbContext.SupportTickets
            .AsNoTracking()
            .Include(x => x.Contract)
                .ThenInclude(c => c!.Unit)
            .FirstOrDefaultAsync(x => x.TicketId == ticketId && x.CustomerId == customerId, ct);

        if (t == null) return null;

        var unitNumber = t.Contract?.Unit?.UnitNumber ?? "N/A";
        var logs = await dbContext.ActivityLogs.AsNoTracking().Include(l => l.User)
            .Where(l => l.EntityType == "SUPPORT_TICKET" && l.EntityId == ticketId && l.Action == "TICKET_RESPONSE")
            .OrderBy(l => l.LoggedAt).ThenBy(l => l.LogId).ToListAsync(ct);
        var responses = new List<TicketResponseDto>();
        foreach (var log in logs)
        {
            if (string.IsNullOrWhiteSpace(log.NewValue)) continue;
            try
            {
                using var json = JsonDocument.Parse(log.NewValue);
                if (json.RootElement.ValueKind != JsonValueKind.Object
                    || !json.RootElement.TryGetProperty("note", out var note)
                    || note.ValueKind != JsonValueKind.String) continue;
                var message = note.GetString();
                if (!string.IsNullOrWhiteSpace(message))
                    responses.Add(new(message, log.User?.FullName ?? "Nhân viên cơ sở", log.LoggedAt));
            }
            catch (JsonException)
            {
                // Bản ghi cũ không phải JSON hợp lệ không được làm hỏng trang hỗ trợ.
            }
        }

        var photoDict = await EvidencePhotos.UrlsAsync(dbContext, EvidencePhotos.SupportTicket, [ticketId], ct);
        var photos = photoDict.GetValueOrDefault(ticketId, []);

        return new SupportTicketDetailDto(
            t.TicketId,
            t.ContractId ?? 0,
            unitNumber,
            t.UnitId,
            t.IssueType,
            t.Title,
            t.Description,
            t.Priority,
            t.Status,
            t.CreatedAt,
            t.AssignedAt,
            t.ResolvedAt,
            t.ClosedAt,
            responses,
            photos
        );
    }

    // Code cũ được giữ để đối chiếu.
    // public async Task<SupportTicketDto> CreateTicketAsync(long customerId, CreateTicketRequest request, CancellationToken ct = default)
    // {
    //     var contract = await dbContext.RentalContracts
    //         .FirstOrDefaultAsync(c => c.ContractId == request.ContractId && c.CustomerId == customerId, ct)
    //         ?? throw new InvalidOperationException("Hợp đồng liên quan không tồn tại hoặc không thuộc về khách hàng.");
    //
    //     var ticket = new SupportTicket
    //     {
    //         CustomerId = customerId,
    //         ContractId = request.ContractId,
    //         UnitId = request.UnitId ?? contract.UnitId,
    //         IssueType = request.IssueType,
    //         Title = request.Title,
    //         Description = request.Description,
    //         Priority = string.IsNullOrWhiteSpace(request.Priority) ? "MEDIUM" : request.Priority,
    //         Status = "OPEN",
    //         CreatedAt = DateTime.UtcNow
    //     };
    //
    //     dbContext.SupportTickets.Add(ticket);
    //     await dbContext.SaveChangesAsync(ct);
    //
    //     return new SupportTicketDto(
    //         ticket.TicketId,
    //         ticket.ContractId.Value,
    //         ticket.UnitId,
    //         ticket.IssueType,
    //         ticket.Title,
    //         ticket.Priority,
    //         ticket.Status,
    //         ticket.CreatedAt,
    //         ticket.ResolvedAt,
    //         ticket.ClosedAt
    //     );
    // }
    // C12 kiểm tra chủ hợp đồng, ô kho, chủ đề và ưu tiên trước khi ghi để tránh lỗi ràng buộc database.
    public const string KeyPickupTopic = "KEY_PICKUP";
    public const string KeyPickupTitle = "Nhận chìa khóa · lần đầu nhận kho";

    /// <summary>
    /// D36 / S01: tạo (hoặc mở lại lịch đã huỷ) HandoverRecord SCHEDULED cho hợp đồng. Mỗi hợp đồng một lịch;
    /// đã nhận chìa khóa hoặc đang có lịch chờ thì không tạo trùng.
    /// </summary>
    private async Task ValidateKeyPickupAsync(long contractId, DateOnly? preferredDate, DateTime? preferredLocal, DateTime now, CancellationToken ct)
    {
        var contract = await dbContext.RentalContracts.AsNoTracking().Include(c => c.HandoverRecord)
            .SingleAsync(c => c.ContractId == contractId, ct);
        if (contract.Status is not ("ACTIVE" or "EXPIRING"))
            throw new InvalidOperationException("Chỉ hợp đồng đã thanh toán còn hiệu lực mới đặt lịch nhận chìa khóa.");
        var h = contract.HandoverRecord;
        if (h?.Status == "HANDED_OVER") throw new InvalidOperationException("Bạn đã nhận chìa khóa cho kho này. Cần chìa mới thì chọn chủ đề Ra vào kho.");
        if (h?.Status is "SCHEDULED" or "VERIFIED") throw new InvalidOperationException("Đã có lịch nhận chìa khóa đang chờ. Nhân viên sẽ liên hệ theo ngày đã hẹn.");
        var todayVn = DateOnly.FromDateTime(now.AddHours(7));
        var chosenDate = preferredDate ?? (preferredLocal.HasValue ? DateOnly.FromDateTime(preferredLocal.Value) : (DateOnly?)null);
        if (chosenDate.HasValue && chosenDate.Value < todayVn)
            throw new ArgumentException("Ngày muốn nhận chìa khóa phải từ hôm nay trở đi.");
        if (chosenDate.HasValue && chosenDate.Value < contract.StartDate)
            throw new ArgumentException($"Ngày muốn nhận chìa khóa phải từ ngày bắt đầu thuê {contract.StartDate:dd/MM/yyyy}.");
        var lastKeyDay = OpsRules.LastVisitDay(contract.EndDate, todayVn);
        if (chosenDate.HasValue && chosenDate.Value > lastKeyDay)
            throw new ArgumentException($"Ngày muốn nhận chìa khóa phải trước ngày hết hạn hợp đồng (chậm nhất {lastKeyDay:dd/MM/yyyy}).");
    }

    private async Task ScheduleKeyPickupAsync(long contractId, long ticketId, DateOnly? preferredDate, DateTime? preferredLocal, DateTime now, CancellationToken ct)
    {
        var contract = await dbContext.RentalContracts.Include(c => c.HandoverRecord).Include(c => c.Unit)
            .SingleAsync(c => c.ContractId == contractId, ct);
        var h = contract.HandoverRecord;
        var todayVn = DateOnly.FromDateTime(now.AddHours(7));
        var chosenDate = preferredDate ?? (preferredLocal.HasValue ? DateOnly.FromDateTime(preferredLocal.Value) : (DateOnly?)null);

        var effectiveDate = chosenDate ?? (contract.StartDate > todayVn ? contract.StartDate : todayVn);
        var scheduled = DateTime.SpecifyKind(effectiveDate.ToDateTime(new TimeOnly(9, 0)).AddHours(-7), DateTimeKind.Utc);
        var staffId = await dbContext.UserFacilities.AsNoTracking()
            .Where(f => f.FacilityId == contract.Unit.FacilityId && f.Status == "ACTIVE")
            .OrderBy(f => f.UserId).Select(f => (long?)f.UserId).FirstOrDefaultAsync(ct) ?? contract.CustomerId;
        var notes = $"Khách yêu cầu nhận chìa khóa ngày {effectiveDate:dd/MM/yyyy} · HT-{ticketId:0000}";
        if (h == null)
        {
            contract.HandoverRecord = new HandoverRecord { StaffId = staffId, CreatedAt = now, ScheduledAt = scheduled, Status = "SCHEDULED", Notes = notes };
        }
        else
        {
            h.Status = "SCHEDULED"; h.ScheduledAt = scheduled; h.VerifiedAt = null; h.CreatedAt = now; h.Notes = notes;
        }
        dbContext.ActivityLogs.Add(new ActivityLog
        {
            UserId = contract.CustomerId, Action = "KEY_PICKUP_REQUESTED", EntityType = "SUPPORT_TICKET", EntityId = ticketId,
            NewValue = System.Text.Json.JsonSerializer.Serialize(new { contractId, scheduledDate = effectiveDate.ToString("yyyy-MM-dd") }), LoggedAt = now
        });
    }

    public static readonly string[] ClosedContractStatuses = ["DRAFT", "CANCELLED", "COMPLETED", "TERMINATED"];

    public async Task<SupportTicketDto> CreateTicketAsync(long customerId, CreateTicketRequest request, CancellationToken ct = default)
    {
        var contract = await dbContext.RentalContracts.AsNoTracking()
            .FirstOrDefaultAsync(c => c.ContractId == request.ContractId && c.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Hợp đồng liên quan không tồn tại hoặc không thuộc về khách hàng.");
        // L14 theo D40: hợp đồng đã thanh toán (kể cả chưa tới ngày bắt đầu) được gửi hỗ trợ; hợp đồng chưa thanh toán
        // hoặc đã kết thúc thì không — khách dùng hỗ trợ chung (support inquiries).
        if (ClosedContractStatuses.Contains(contract.Status))
            throw new InvalidOperationException(contract.Status == "DRAFT"
                ? "Hợp đồng chưa thanh toán nên chưa gửi hỗ trợ theo kho được. Dùng mục hỗ trợ chung."
                : "Hợp đồng đã kết thúc nên không gửi hỗ trợ theo kho được. Dùng mục hỗ trợ chung.");
        if (request.UnitId.HasValue && request.UnitId != contract.UnitId)
            throw new ArgumentException("Ô kho phải đúng ô trong hợp đồng đã chọn.");

        // D36: chủ đề "Nhận chìa khóa · lần đầu nhận kho" tạo lịch nhận chìa khóa cho nhân viên xác minh rồi giao.
        var keyPickup = string.Equals((request.IssueType ?? "").Trim(), KeyPickupTopic, StringComparison.OrdinalIgnoreCase);
        // C12 dùng tên nhóm gọn; lưu mã hợp lệ theo ràng buộc hiện có, giữ nguyên tiêu đề của khách.
        var type = keyPickup ? "ACCESS_CARD" : (request.IssueType ?? "").Trim().ToUpperInvariant() switch
        {
            "ACCESS" => "ACCESS_CARD",
            "ITEMS" => "STORED_ITEM",
            "SCHEDULE" => "OTHER",
            var value => value
        };
        if (!new[] { "UNIT", "LOCK", "ACCESS_CODE", "ACCESS_CARD", "PAYMENT", "STORED_ITEM", "OTHER" }.Contains(type))
            throw new ArgumentException("Chủ đề hỗ trợ không hợp lệ.");
        var title = keyPickup ? KeyPickupTitle : request.Title?.Trim() ?? "";
        var keyDate = keyPickup
            ? (request.PreferredDate ?? (request.PreferredAt.HasValue ? DateOnly.FromDateTime(request.PreferredAt.Value) : (DateOnly?)null))
            : null;
        var description = !string.IsNullOrWhiteSpace(request.Description)
            ? request.Description.Trim()
            : keyPickup && keyDate.HasValue
                ? $"Ngày muốn nhận chìa khóa: {keyDate.Value:dd/MM/yyyy}"
                : "";
        var priority = string.IsNullOrWhiteSpace(request.Priority) ? "NORMAL" : request.Priority.Trim().ToUpperInvariant();
        if (title.Length is < 1 or > 150 || description.Length > 1000)
            throw new ArgumentException("Tiêu đề cần từ 1 đến 150 ký tự và nội dung tối đa 1000 ký tự.");
        if (!new[] { "LOW", "NORMAL", "HIGH", "URGENT" }.Contains(priority))
            throw new ArgumentException("Mức ưu tiên hỗ trợ không hợp lệ.");

        // D35: kiểm ảnh trước khi ghi (không bắt buộc, tối đa 3 ảnh như C12).
        if (request.Photos is { Count: > 3 }) throw new ArgumentException("Tối đa 3 ảnh cho một yêu cầu hỗ trợ.");
        var photos = EvidencePhotos.Decode(request.Photos, required: false, what: "đính kèm hỗ trợ");

        await using var tx = await CheckoutTransaction.BeginAsync(dbContext, $"move-out:{contract.ContractId}", ct);
        var now = DateTime.UtcNow;
        if (keyPickup) await ValidateKeyPickupAsync(contract.ContractId, request.PreferredDate, request.PreferredAt, now, ct);
        var ticket = new SupportTicket
        {
            CustomerId = customerId, ContractId = contract.ContractId, UnitId = contract.UnitId,
            IssueType = type, Title = title, Description = description, Priority = priority,
            Status = "OPEN", CreatedAt = now
        };
        dbContext.SupportTickets.Add(ticket);
        await dbContext.SaveChangesAsync(ct);
        if (photos.Count > 0) EvidencePhotos.Attach(dbContext, photos, EvidencePhotos.SupportTicket, ticket.TicketId, customerId, now);
        if (keyPickup) await ScheduleKeyPickupAsync(contract.ContractId, ticket.TicketId, request.PreferredDate, request.PreferredAt, now, ct);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new SupportTicketDto(ticket.TicketId, contract.ContractId, ticket.UnitId, ticket.IssueType,
            ticket.Title, ticket.Priority, ticket.Status, ticket.CreatedAt, ticket.ResolvedAt, ticket.ClosedAt);
    }

}
