using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Payment;
using StorageProject.Core.DTOs.Reservation;
using StorageProject.Core.Exceptions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// DTO tiếp nhận yêu cầu hủy đơn đặt chỗ của khách hàng (D40 / D42 / D44).
/// </summary>
/// <param name="Reason">Lý do hủy đơn đặt chỗ.</param>
/// <param name="BankName">Tên ngân hàng nhận hoàn tiền (hoặc "CASH" nếu chọn nhận tiền mặt).</param>
/// <param name="AccountNumber">Số tài khoản ngân hàng thụ hưởng chính chủ.</param>
/// <param name="AccountHolder">Tên chủ tài khoản thụ hưởng.</param>
/// <param name="RefundMethod">Phương thức nhận hoàn: "CASH" (tiền mặt tại quầy) hoặc "BANK_TRANSFER" (chuyển khoản ngân hàng).</param>
public record CancelReservationRequest(string Reason, string? BankName = null, string? AccountNumber = null, string? AccountHolder = null,
    string? RefundMethod = null);

/// <summary>
/// Định nghĩa các Minimal API Endpoints quản lý đơn đặt chỗ thuê kho trực tuyến (UC02 / UC03 / F02 / F03).
/// Quản lý tạo đơn, đếm ngược giữ chỗ, thanh toán PayOS/VietQR, hủy đơn hoàn tiền, và xác nhận chuyển khoản.
/// </summary>
public static class ReservationEndpoints
{
    /// <summary>
    /// Đăng ký các route đơn đặt chỗ (/api/reservations, /api/v1/reservations) vào ứng dụng.
    /// </summary>
    /// <param name="app">Builder đăng ký route.</param>
    /// <returns>Nhóm route /api/reservations đã cấu hình quyền xác thực.</returns>
    public static RouteGroupBuilder MapReservationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/reservations")
            .WithTags("Reservations")
            .RequireAuthorization();

        // GET /api/reservations: Xem danh sách các đơn đặt chỗ của khách hàng đăng nhập
        group.MapGet("/", async (ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var reservations = await reservationService.GetMyReservationsAsync(customerId, ct);
            return Results.Ok(reservations);
        });

        // GET /api/reservations/{id}: Xem thông tin chi tiết một đơn đặt chỗ
        group.MapGet("/{id:long}", async (long id, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            var customerId = user.GetUserId();
            var detail = await reservationService.GetReservationDetailAsync(customerId, id, ct);
            return detail is not null ? Results.Ok(detail) : Results.NotFound(new { error = "Không tìm thấy đơn đặt chỗ." });
        });

        // POST /api/reservations: Tạo đơn đặt chỗ mới ở trạng thái PENDING_PAYMENT
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

        // GET /api/reservations/{id}/cancel-preview: Xem trước các khoản khấu trừ và số tiền hoàn dự kiến khi hủy đơn (D40)
        group.MapGet("/{id:long}/cancel-preview", async (long id, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await reservationService.GetCancelPreviewAsync(user.GetUserId(), id, ct));
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/reservations/{id}/cancel: Thực hiện hủy đơn đặt chỗ, khấu trừ 5% cọc và tạo hồ sơ hoàn tiền (D40/D42)
        group.MapPost("/{id:long}/cancel", async (long id, CancelReservationRequest request, ClaimsPrincipal user, IReservationService reservationService, CancellationToken ct) =>
        {
            try
            {
                var customerId = user.GetUserId();
                var bank = request.BankName != null || request.AccountNumber != null || request.AccountHolder != null || request.RefundMethod != null
                    ? new StorageProject.Core.DTOs.Evidence.RefundBankInput(request.BankName, request.AccountNumber, request.AccountHolder, request.RefundMethod)
                    : null;
                await reservationService.CancelReservationAsync(customerId, id, request.Reason, bank, ct);
                return Results.Ok(new { message = "Đã hủy đơn đặt chỗ thành công." });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/reservations/{id}/confirm-transfer: Khách báo đã chuyển khoản thành công (C04 / F03: chuyển PENDING_VERIFICATION)
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

        // POST /api/reservations/{id}/pay-at-facility: Khách chọn giữ chỗ và thanh toán tại quầy cơ sở (PENDING_AT_FACILITY)
        group.MapPost("/{id:long}/pay-at-facility", async (long id, ClaimsPrincipal user, IPayOSService payOS, CancellationToken ct) =>
        {
            try {
                await payOS.PayAtFacilityAsync(user.GetUserId(), id, ct);
                return Results.Ok(new { message = "Đã giữ chỗ, thanh toán tại cửa hàng khi nhận kho." });
            } catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/reservations/create-payos-qr: Khởi tạo liên kết thanh toán và mã QR PayOS / VietQR cho đơn đặt chỗ
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

        // GET /api/reservations/{id}/status: Kiểm tra trạng thái thanh toán của đơn đặt chỗ (công khai cho polling thanh toán)
        group.MapGet("/{id:long}/status", async (long id, IPayOSService payOSService, CancellationToken ct) =>
        {
            var status = await payOSService.GetReservationPaymentStatusAsync(id, ct);
            return status is not null ? Results.Ok(status) : Results.NotFound(new { error = "Không tìm thấy thông tin đặt chỗ." });
        }).AllowAnonymous();

        // Định tuyến bổ sung nhóm /api/v1/reservations để tương thích ngược
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
