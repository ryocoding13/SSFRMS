using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Reservation;
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

        group.MapPost("/{id:long}/confirm-transfer", async (long id, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                await reservationService.ConfirmTransferAsync(customerId, id, ct);
                return Results.Ok(new { message = "Xác nhận đã chuyển khoản thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // PayOS integration endpoints: create QR and check payment status
        group.MapPost("/create-payos-qr", async (CreatePayOSQrRequest request, ClaimsPrincipal user, IPayOSService payOSService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var response = await payOSService.CreatePaymentQrAsync(customerId, request, ct);
                return Results.Ok(response);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapGet("/{id:long}/status", async (long id, IPayOSService payOSService, CancellationToken ct) =>
        {
            var status = await payOSService.GetReservationPaymentStatusAsync(id, ct);
            return status is not null ? Results.Ok(status) : Results.NotFound(new { error = "Không tìm thấy thông tin đặt chỗ." });
        }).AllowAnonymous();

        // Also map /api/v1/reservations endpoints for compatibility
        var v1Group = app.MapGroup("/api/v1/reservations")
            .WithTags("Reservations (v1)");

        v1Group.MapPost("/create-payos-qr", async (CreatePayOSQrRequest request, ClaimsPrincipal user, IPayOSService payOSService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var response = await payOSService.CreatePaymentQrAsync(customerId, request, ct);
                return Results.Ok(response);
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        v1Group.MapGet("/{id:long}/status", async (long id, IPayOSService payOSService, CancellationToken ct) =>
        {
            var status = await payOSService.GetReservationPaymentStatusAsync(id, ct);
            return status is not null ? Results.Ok(status) : Results.NotFound(new { error = "Không tìm thấy thông tin đặt chỗ." });
        }).AllowAnonymous();

        return group;
    }
}
