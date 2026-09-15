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

    public async Task<SupportTicketDetailDto?> GetTicketDetailAsync(long customerId, long ticketId, CancellationToken ct = default)
    {
        var t = await dbContext.SupportTickets
            .AsNoTracking()
            .Include(x => x.Contract)
                .ThenInclude(c => c!.Unit)
            .FirstOrDefaultAsync(x => x.TicketId == ticketId && x.CustomerId == customerId, ct);

        if (t == null) return null;

        var unitNumber = t.Contract?.Unit?.UnitNumber ?? "N/A";

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
            t.ClosedAt
        );
    }

    public async Task<SupportTicketDto> CreateTicketAsync(long customerId, CreateTicketRequest request, CancellationToken ct = default)
    {
        var contract = await dbContext.RentalContracts
            .FirstOrDefaultAsync(c => c.ContractId == request.ContractId && c.CustomerId == customerId, ct)
            ?? throw new InvalidOperationException("Hợp đồng liên quan không tồn tại hoặc không thuộc về khách hàng.");

        var ticket = new SupportTicket
        {
            CustomerId = customerId,
            ContractId = request.ContractId,
            UnitId = request.UnitId ?? contract.UnitId,
            IssueType = request.IssueType,
            Title = request.Title,
            Description = request.Description,
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "MEDIUM" : request.Priority,
            Status = "OPEN",
            CreatedAt = DateTime.UtcNow
        };

        dbContext.SupportTickets.Add(ticket);
        await dbContext.SaveChangesAsync(ct);

        return new SupportTicketDto(
            ticket.TicketId,
            ticket.ContractId.Value,
            ticket.UnitId,
            ticket.IssueType,
            ticket.Title,
            ticket.Priority,
            ticket.Status,
            ticket.CreatedAt,
            ticket.ResolvedAt,
            ticket.ClosedAt
        );
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
