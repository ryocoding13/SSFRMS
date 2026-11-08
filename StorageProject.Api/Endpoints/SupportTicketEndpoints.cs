using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Định nghĩa các Minimal API Endpoints quản lý yêu cầu hỗ trợ và sự cố kỹ thuật trong kỳ thuê của khách hàng (C12 / UC07).
/// Cho phép xem danh sách ticket, xem chi tiết, tạo yêu cầu hỗ trợ mới (kèm ảnh và chủ đề KEY_PICKUP theo D35/D36) và hủy ticket.
/// </summary>
public static class SupportTicketEndpoints
{
    /// <summary>
    /// Đăng ký các route phiếu hỗ trợ (/api/tickets) vào ứng dụng.
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api/tickets đã cấu hình quyền xác thực.</returns>
    public static RouteGroupBuilder MapSupportTicketEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tickets")
            .WithTags("Support Tickets")
            .RequireAuthorization();

        // GET /api/tickets: Xem danh sách các yêu cầu hỗ trợ của khách hàng đăng nhập
        group.MapGet("/", async (ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var tickets = await ticketService.GetMyTicketsAsync(customerId, ct);
            return Results.Ok(tickets);
        });

        // GET /api/tickets/{id}: Xem chi tiết một phiếu yêu cầu hỗ trợ cụ thể
        group.MapGet("/{id:long}", async (long id, ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var ticket = await ticketService.GetTicketDetailAsync(customerId, id, ct);
            return ticket is not null ? Results.Ok(ticket) : Results.NotFound(new { error = "Không tìm thấy yêu cầu hỗ trợ." });
        });

        // POST /api/tickets: Tạo phiếu yêu cầu hỗ trợ kỹ thuật hoặc đặt lịch nhận chìa khóa (D35/D36)
        group.MapPost("/", async (CreateTicketRequest request, ClaimsPrincipal user, ISupportTicketService ticketService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var ticket = await ticketService.CreateTicketAsync(customerId, request, ct);
                return Results.Created($"/api/tickets/{ticket.TicketId}", ticket);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(StorageProject.Infrastructure.Services.EvidencePhotos.RequestBodyLimit));

        // POST /api/tickets/{id}/cancel: Khách hàng hủy yêu cầu hỗ trợ
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
