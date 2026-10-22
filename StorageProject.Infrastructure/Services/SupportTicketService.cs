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
            responses
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
    public async Task<SupportTicketDto> CreateTicketAsync(long customerId, CreateTicketRequest request, CancellationToken ct = default)
    {
        var contract = await dbContext.RentalContracts.AsNoTracking()
            .FirstOrDefaultAsync(c => c.ContractId == request.ContractId && c.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Hợp đồng liên quan không tồn tại hoặc không thuộc về khách hàng.");
        if (request.UnitId.HasValue && request.UnitId != contract.UnitId)
            throw new ArgumentException("Ô kho phải đúng ô trong hợp đồng đã chọn.");

        // C12 dùng tên nhóm gọn; lưu mã hợp lệ theo ràng buộc hiện có, giữ nguyên tiêu đề của khách.
        var type = (request.IssueType ?? "").Trim().ToUpperInvariant() switch
        {
            "ACCESS" => "ACCESS_CARD",
            "ITEMS" => "STORED_ITEM",
            "SCHEDULE" => "OTHER",
            var value => value
        };
        if (!new[] { "UNIT", "LOCK", "ACCESS_CODE", "ACCESS_CARD", "PAYMENT", "STORED_ITEM", "OTHER" }.Contains(type))
            throw new ArgumentException("Chủ đề hỗ trợ không hợp lệ.");
        var title = request.Title?.Trim() ?? "";
        var description = request.Description?.Trim() ?? "";
        var priority = string.IsNullOrWhiteSpace(request.Priority) ? "NORMAL" : request.Priority.Trim().ToUpperInvariant();
        if (title.Length is < 1 or > 150 || description.Length is < 1 or > 1000)
            throw new ArgumentException("Tiêu đề cần từ 1 đến 150 ký tự và nội dung từ 1 đến 1000 ký tự.");
        if (!new[] { "LOW", "NORMAL", "HIGH", "URGENT" }.Contains(priority))
            throw new ArgumentException("Mức ưu tiên hỗ trợ không hợp lệ.");

        var ticket = new SupportTicket
        {
            CustomerId = customerId, ContractId = contract.ContractId, UnitId = contract.UnitId,
            IssueType = type, Title = title, Description = description, Priority = priority,
            Status = "OPEN", CreatedAt = DateTime.UtcNow
        };
        dbContext.SupportTickets.Add(ticket);
        await dbContext.SaveChangesAsync(ct);
        return new SupportTicketDto(ticket.TicketId, contract.ContractId, ticket.UnitId, ticket.IssueType,
            ticket.Title, ticket.Priority, ticket.Status, ticket.CreatedAt, ticket.ResolvedAt, ticket.ClosedAt);
    }

    public async Task CancelTicketAsync(long customerId, long ticketId, CancellationToken ct = default)
    {
        var ticket = await dbContext.SupportTickets
            .FirstOrDefaultAsync(t => t.TicketId == ticketId && t.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Yêu cầu hỗ trợ không tồn tại.");

        if (ticket.Status != "OPEN")
        {
            throw new InvalidOperationException("Chỉ có thể hủy yêu cầu hỗ trợ khi ở trạng thái 'OPEN'.");
        }

        ticket.Status = "CLOSED";
        ticket.ClosedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
    }
}
