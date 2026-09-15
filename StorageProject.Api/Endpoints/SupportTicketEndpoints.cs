using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public static class SupportTicketEndpoints
{
    public static RouteGroupBuilder MapSupportTicketEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tickets")
            .WithTags("Support Tickets")
            .RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var tickets = await ticketService.GetMyTicketsAsync(customerId, ct);
            return Results.Ok(tickets);
        });

        group.MapGet("/{id:long}", async (long id, ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var ticket = await ticketService.GetTicketDetailAsync(customerId, id, ct);
            return ticket is not null ? Results.Ok(ticket) : Results.NotFound(new { error = "Không tìm thấy yêu cầu hỗ trợ." });
        });

        group.MapPost("/", async (CreateTicketRequest request, ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var ticket = await ticketService.CreateTicketAsync(customerId, request, ct);
                return Results.Created($"/api/tickets/{ticket.TicketId}", ticket);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/{id:long}/cancel", async (long id, ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                await ticketService.CancelTicketAsync(customerId, id, ct);
                return Results.Ok(new { message = "Đã hủy yêu cầu hỗ trợ thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        return group;
    }
}
