using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Khu Nhân viên cơ sở (Figma S01–S09) và Quản lý cơ sở (M01–M08) — BACKEND-TODO.md mục A2, A3.
/// Role STAFF hoặc MANAGER; thao tác của quản lý trả 403 với nhân viên. Chỉ dữ liệu cơ sở được phân công (SRS A06).
/// Lỗi: 400 { error } · 403 { error } · 404 { error }.
/// </summary>
public static class FacilityOpsEndpoints
{
    public static void MapFacilityOpsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/ops")
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("STAFF", "MANAGER"));

        group.MapGet("/board", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(ToJson(await ops.GetBoardAsync(Actor(user), ct)))))
            .WithSummary("Dữ liệu vận hành của cơ sở được phân công (nhân viên: S01–S09; quản lý: thêm M01–M08)");

        // ---- Nhân viên (quản lý cũng làm được)
        group.MapPost("/payments/{id}/confirm", (string id, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.ConfirmPaymentAsync(Actor(user), id, ct); return Done(); }))
            .WithSummary("S09 · Xác nhận đã thu: đơn PENDING_VERIFICATION → CONFIRMED, chuyển quản lý phân bổ ô");

        group.MapPost("/payments/{id}/mismatch", (string id, OpsNoteRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.ReportMismatchAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("S09 · Báo sai lệch chuyển khoản (note bắt buộc)");

        group.MapPost("/verifications/{id}", (string id, OpsVerifyRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.VerifyCustomerAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("S02 · Xác minh khách nhận kho; chỉ lưu 4 số cuối giấy tờ");

        group.MapPost("/keys/{id}/receipt", (string id, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.RecordKeyReceiptAsync(Actor(user), id, ct); return Done(); }))
            .WithSummary("Ghi nhận khách nhận chìa khóa vật lý; không kích hoạt hợp đồng");

        group.MapPost("/returns/{id}/inspection", (string id, OpsReturnInspectionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.SubmitReturnInspectionAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("S04 · Biên bản kiểm tra trả kho; ô → INSPECTION, chờ quản lý hoàn cọc");

        group.MapPost("/tickets/{id}/responses", (string id, OpsTicketResponseRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.RespondTicketAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("S05 · Phản hồi yêu cầu hỗ trợ: IN_PROGRESS / WAITING_CUSTOMER / DONE");

        // ---- Chỉ quản lý cơ sở
        group.MapPost("/allocations/{id}", (string id, OpsAllocateRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.AllocateAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("M05 · Phân bổ ô trống đúng loại cho đơn đã đối soát → hợp đồng nháp + lịch bàn giao");

        group.MapPut("/assignments/{id}", (string id, OpsAssignRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.AssignAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("M06 · Giao việc bàn giao / trả kho / hỗ trợ cho nhân viên cùng cơ sở");

        group.MapPost("/renewals/{id}/approve", (string id, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.ApproveRenewalAsync(Actor(user), id, ct); return Done(); }))
            .WithSummary("M03 · Duyệt gia hạn: cập nhật ngày hết hạn, tạo khoản gia hạn chờ thanh toán");

        group.MapPost("/renewals/{id}/reject", (string id, OpsRejectRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.RejectRenewalAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("M03 · Từ chối gia hạn (reason bắt buộc)");

        group.MapPost("/contracts/{id}/reminders", (string id, OpsNoteRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.RemindAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("M07 · Ghi lần nhắc khách (quá hạn / còn nợ)");

        group.MapPost("/contracts/{id}/refund", (string id, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var refund = await ops.ConfirmRefundAsync(Actor(user), id, ct);
                return Results.Ok(new { message = "Đã cập nhật.", refund });
            }))
            .WithSummary("M07 · Xác nhận hoàn cọc sau biên bản trả kho: cọc − khoản còn nợ, đóng hợp đồng, ô trống lại");
    }

    private static OpsActor Actor(ClaimsPrincipal user) => new(user.GetUserId(), user.IsInRole("MANAGER"));

    private static IResult Done() => Results.Ok(new { message = "Đã cập nhật." });

    /// <summary>
    /// Nhân viên không nhận các phần của quản lý — bỏ hẳn khoá thay vì trả null,
    /// vì giao diện gộp kết quả vào giá trị mặc định (src/ops/api.js loadBoard).
    /// </summary>
    private static Dictionary<string, object?> ToJson(OpsBoardDto b)
    {
        var json = new Dictionary<string, object?>
        {
            ["facility"] = b.Facility,
            ["me"] = b.Me,
            ["staff"] = b.Staff,
            ["units"] = b.Units,
            ["payments"] = b.Payments,
            ["verifications"] = b.Verifications,
            ["handovers"] = b.Handovers,
            ["returns"] = b.Returns,
            ["tickets"] = b.Tickets,
        };
        if (b.Allocations != null) json["allocations"] = b.Allocations;
        if (b.Renewals != null) json["renewals"] = b.Renewals;
        if (b.Contracts != null) json["contracts"] = b.Contracts;
        if (b.Assignments != null) json["assignments"] = b.Assignments;
        if (b.Revenue != null) json["revenue"] = b.Revenue;
        return json;
    }

    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}
