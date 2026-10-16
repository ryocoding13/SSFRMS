using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Exceptions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

public record CancelReservationRequest(string Reason);

public static class ReservationEndpoints
{
    public static RouteGroupBuilder MapReservationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/reservations")
            .WithTags("Reservations")
            .RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var reservations = await reservationService.GetMyReservationsAsync(customerId, ct);
            return Results.Ok(reservations);
        });

        group.MapGet("/{id:long}", async (long id, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var detail = await reservationService.GetReservationDetailAsync(customerId, id, ct);
            return detail is not null ? Results.Ok(detail) : Results.NotFound(new { error = "Không tìm thấy đơn đặt chỗ." });
        });

        group.MapPost("/", async (CreateReservationRequest request, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var reservation = await reservationService.CreateReservationAsync(customerId, request, ct);
                return Results.Created($"/api/reservations/{reservation.ReservationId}", reservation);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/{id:long}/cancel", async (long id, CancelReservationRequest request, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                await reservationService.CancelReservationAsync(customerId, id, request.Reason, ct);
                return Results.Ok(new { message = "Đã hủy đơn đặt chỗ thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // C04 / F03: khách báo đã chuyển khoản → PENDING_VERIFICATION (nhân viên đối soát ở S09)
        group.MapPost("/{id:long}/confirm-transfer", async (long id, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            try
            {
                var reservation = await reservationService.ConfirmTransferAsync(user.GetUserId(), id, ct);
                return Results.Ok(reservation);
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (ReservationExpiredException ex)
            {
                return Results.BadRequest(new { error = ex.Message, code = "EXPIRED" });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithSummary("Khách báo đã chuyển khoản: đơn chuyển sang chờ nhân viên đối soát (PENDING_VERIFICATION)");

        return group;
    }
}
