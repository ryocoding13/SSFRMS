using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Services;

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

        // D42: bỏ báo cáo sai lệch chuyển khoản (POST /payments/{id}/mismatch đã gỡ).

        group.MapPost("/verifications/{id}", (string id, OpsVerifyRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.VerifyCustomerAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("S02 · Xác minh khách nhận kho; chỉ lưu 4 số cuối giấy tờ");

        group.MapPost("/keys/{id}/receipt", (string id, OpsKeyReceiptRequest? request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.RecordKeyReceiptAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("Ghi nhận khách nhận chìa khóa vật lý (checklist 3 mục nếu gửi); không kích hoạt hợp đồng");

        group.MapPost("/returns/{id}/inspection", (string id, OpsReturnInspectionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.SubmitReturnInspectionAsync(Actor(user), id, request, ct); return Done(); }))
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(EvidencePhotos.RequestBodyLimit))
            .WithSummary("S04 · Biên bản kiểm kê trả kho: 4 mục, phí hư hỏng, vệ sinh 10% cọc, lý do, ảnh (D32 / T05)");

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

        group.MapPost("/contracts/{id}/refund", (string id, OpsNoteRequest? request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var result = await ops.ConfirmRefundAsync(Actor(user), id, request?.Note, ct);
                return Results.Ok(new { message = "Đã cập nhật.", refund = result.Refund, refundStatus = result.RefundStatus });
            }))
            .WithSummary("M07 · Chốt quyết toán trả kho (D32): tạo khoản hoàn PENDING, đóng hợp đồng; ô cần vệ sinh giữ MAINTENANCE");

        group.MapPost("/reservations/{id}/refund", (string id, OpsReservationRefundRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var refund = await ops.ConfirmReservationRefundAsync(Actor(user), id, request, ct);
                return Results.Ok(new { message = "Đã cập nhật.", refund });
            }))
            .WithSummary("M08 · Ghi bằng chứng đã chuyển khoản hoàn cho đơn huỷ: mã giao dịch, thời điểm chuyển, xác nhận (D32)");

        // ---- Hoàn cọc sau trả kho (D32 / T07)
        group.MapGet("/deposit-refunds", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetDepositRefundsAsync(Actor(user), ct))))
            .WithSummary("Danh sách khoản hoàn cọc của cơ sở: chờ hoàn và đã hoàn gần đây");

        group.MapPost("/deposit-refunds/actions", (DepositRefundActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await ops.ConfirmDepositRefundAsync(Actor(user), request, ct) })))
            .WithSummary("CONFIRM_DEPOSIT_REFUND: quản lý ghi mã giao dịch → PAID; expectedVersion cũ trả 409");

        // ---- D39 · Kiểm tra lại phương án khách tự dọn / tự thay / khiếu nại
        group.MapPost("/returns/{id}/recheck", (string id, ReturnRecheckRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => { await ops.RecheckReturnAsync(Actor(user), id, request, ct); return Done(); }))
            .WithSummary("D39 · Cơ sở kiểm tra lại: cleaningPassed / replacementPassed đạt thì không trừ khoản tương ứng; note bắt buộc");

        // ---- D42 · Hoàn tiền mặt tại quầy
        group.MapGet("/cash-refunds", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetCashRefundsAsync(Actor(user), ct))))
            .WithSummary("D42 · Khoản hoàn tiền mặt của cơ sở: chờ duyệt, chờ khách nhận, cần gọi nhắc (ngày 10/20/25), đã hẹn, quá 30 ngày, đã chi");

        group.MapPost("/cash-refunds/{id}/approve", (string id, OpsAssignRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await ops.ApproveCashRefundAsync(Actor(user), id, request, ct) })))
            .WithSummary("D42 · Quản lý duyệt chi tiền mặt và giao việc cho nhân viên (staffId \"NV-xx\"); gọi lại để giao người khác");

        group.MapPost("/cash-refunds/{id}/calls", (string id, CashRefundCallRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await ops.RecordCashRefundCallAsync(Actor(user), id, request, ct) })))
            .WithSummary("D42/D43 · S10b ghi kết quả gọi nhắc: APPOINTMENT (kèm appointmentDate) · NO_ANSWER · SWITCH_TO_BANK · WRONG_NUMBER");

        group.MapPost("/cash-refunds/{id}/pay", (string id, CashRefundPayRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await ops.PayCashRefundAsync(Actor(user), id, request, ct) })))
            .WithSummary("D42 · S10 nhân viên tick đủ 4 mục rồi xác nhận đã chi; không lưu ảnh / số phiếu chi");

        // ---- D41 · Danh sách xung đột ô (đề xuất đổi kho) của cơ sở
        group.MapGet("/unit-conflicts", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetUnitConflictsAsync(Actor(user), ct))))
            .WithSummary("D41 · Đề xuất đổi kho do khách cũ chưa trả / chưa kiểm tra đạt: OPEN và đã xử lý 30 ngày gần đây");

        // ---- D42 · Báo cáo cuối ngày cho quản lý
        group.MapGet("/daily-report", (DateOnly? date, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetDailyReportAsync(Actor(user), date, ct))))
            .WithSummary("D42 · M04-cuối ngày: tên nhân viên, số việc chưa xong (FIFO), chi tiết và lịch sử việc đã làm trong ngày");

        // ---- T12 · Hồ sơ quá hạn ngày 20 và biên bản xử lý đồ (D32)
        group.MapGet("/overdue-cases", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetOverdueCasesAsync(Actor(user), ct))))
            .WithSummary("Danh sách hồ sơ quá hạn của cơ sở phụ trách (mốc ngày 20 xử lý đồ)");

        group.MapPost("/overdue-cases/actions", (OverdueCaseActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(new { item = await ops.HandleOverdueCaseActionAsync(Actor(user), request, ct) })))
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(EvidencePhotos.RequestBodyLimit))
            .WithSummary("ASSIGN_REMOVAL (quản lý phân công) / RECORD_REMOVAL (nhân viên/quản lý lưu biên bản xử lý đồ ngày 20 kèm ảnh)");

        // ---- T13 · Sự cố do cơ sở (quản lý)
        group.MapGet("/incidents", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetIncidentsAsync(Actor(user), ct))))
            .WithSummary("Hồ sơ sự cố của cơ sở + nháp cho hợp đồng đủ điều kiện (mã/phiên bản do server cấp) và ô tương đương");

        group.MapPost("/incidents", (IncidentActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.SaveIncidentAsync(Actor(user), request, ct))))
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(EvidencePhotos.RequestBodyLimit))
            .WithSummary("SAVE_INCIDENT (giữ nháp) / SEND_INCIDENT_PROPOSAL (gửi khách, giữ ô thay thế); expectedVersion cũ trả 409");

        group.MapPost("/incidents/{id}/complete-transfer", (string id, IncidentActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.CompleteIncidentTransferAsync(Actor(user), id, request, ct))))
            .WithSummary("Hoàn tất chuyển ô: ô cũ MAINTENANCE, ô mới OCCUPIED, mã ô cũ hết hiệu lực, cấp QR/PIN ô mới, không phụ phí");

        group.MapPost("/incidents/{id}/terminate", (string id, IncidentActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.FinalizeIncidentTerminationAsync(Actor(user), id, request, ct))))
            .WithSummary("Chốt kết thúc theo lựa chọn khách: hợp đồng kết thúc, khoản hoàn PENDING = tháng đang thuê + tháng chưa dùng + 100% cọc");

        // ---- M02 · Hồ sơ phản hồi & tự khắc phục hư hỏng (B10 / D32 / D34)
        group.MapGet("/damage-cases", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetDamageCasesAsync(Actor(user), ct))))
            .WithSummary("Danh sách hồ sơ hư hỏng của cơ sở");

        group.MapPost("/damage-cases/actions", (DamageCaseActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.HandleDamageActionAsync(Actor(user), request, ct))))
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(EvidencePhotos.RequestBodyLimit))
            .WithSummary("DECIDE_DAMAGE_RESPONSE (quản lý cho phép/từ chối khắc phục) / INSPECT_DAMAGE_REMEDIATION (kiểm tra sau khắc phục)");

        // ---- T13 · Khách xem và tự chọn phương án
        routes.MapGet("/api/incidents", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetCustomerIncidentsAsync(user.GetUserId(), ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("Khách xem hồ sơ sự cố đã gửi của hợp đồng mình");

        routes.MapPost("/api/contracts/{contractId}/incident-choice", (string contractId, IncidentActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.ChooseIncidentOptionAsync(user.GetUserId(), contractId, request, ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("CHOOSE_INCIDENT_OPTION: khách tự chọn đổi ô (TRANSFER) hoặc kết thúc + tài khoản chính chủ (TERMINATE)");

// ---- M02 · Khách xem và thao tác hồ sơ hư hỏng của mình
        routes.MapGet("/api/damage-cases", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetCustomerDamageCasesAsync(user.GetUserId(), ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("Khách theo dõi hồ sơ hư hỏng (chỉ của mình)");

        routes.MapPost("/api/damage-cases/actions", (DamageCaseActionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.HandleCustomerDamageActionAsync(user.GetUserId(), request, ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(EvidencePhotos.RequestBodyLimit))
            .WithSummary("RESPOND_DAMAGE (đồng ý/đề xuất tự sửa/khiếu nại) / REPORT_DAMAGE_REMEDIATION (báo đã khắc phục xong)");

// ---- D39 · Khách xem và xác nhận khấu trừ trả kho (48 giờ)
        routes.MapGet("/api/contracts/{contractId}/return-deduction", (string contractId, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetReturnDeductionAsync(user.GetUserId(), contractId, ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("D39 · Khoản khấu trừ trên biên bản trả kho, hạn xác nhận 48 giờ và lựa chọn của khách");

        routes.MapPost("/api/contracts/{contractId}/return-deduction", (string contractId, ReturnDeductionDecisionRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.DecideReturnDeductionAsync(user.GetUserId(), contractId, request, ct))))
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(EvidencePhotos.RequestBodyLimit))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("D39 · AGREE · SELF_CLEAN (có phí vệ sinh) · SELF_REPLACE (có phí hư hỏng) · DISPUTE (note bắt buộc); một lần, trong 48 giờ");

        // ---- D41 · Khách xem và chọn phương án đổi kho
        routes.MapGet("/api/unit-conflicts", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetCustomerUnitConflictsAsync(user.GetUserId(), ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("D41 · Đề xuất đổi kho của khách (đổi ngang / nâng cấp miễn phí / không còn ô), hạn trả lời 48 giờ");

        routes.MapPost("/api/contracts/{contractId}/unit-conflict", (string contractId, UnitConflictChoiceRequest request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(new { item = await ops.ChooseUnitConflictAsync(user.GetUserId(), contractId, request, ct) })))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("D41 · ACCEPT (nhận ô đề xuất) · RESCHEDULE { newStartDate } · CANCEL { refundBank } hoàn 100%, không phí huỷ");

        // ---- D44 · Khách xem khoản hoàn tiền mặt, đổi sang chuyển khoản trong 30 ngày
        routes.MapGet("/api/cash-refunds", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetCustomerCashRefundsAsync(user.GetUserId(), ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("D44 · Khoản hoàn tiền mặt của khách: hạn nhận 30 ngày, ngày hẹn, đã nhận / FORFEITED (quá hạn)");

        routes.MapPost("/api/cash-refunds/{id}/switch-to-bank", (string id, StorageProject.Core.DTOs.Evidence.RefundBankInput request, ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(new { item = await ops.SwitchCashRefundToBankAsync(user.GetUserId(), id, request, ct) })))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("D44 · Trong 30 ngày đổi khoản tiền mặt sang chuyển khoản { bankName, accountNumber, accountHolder } (chính chủ)");

        // ---- Khách xem khoản hoàn cọc của chính mình
        routes.MapGet("/api/deposit-refunds", (ClaimsPrincipal user, IFacilityOpsService ops, CancellationToken ct) =>
                Run(async () => Results.Ok(await ops.GetCustomerDepositRefundsAsync(user.GetUserId(), ct))))
            .WithTags("Facility Operations")
            .RequireAuthorization(policy => policy.RequireRole("CUSTOMER"))
            .WithSummary("Khách theo dõi hoàn cọc sau trả kho (chỉ hồ sơ của mình)");
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
        if (b.Refunds != null) json["refunds"] = b.Refunds;

        // Khả năng server đã triển khai thật (BACKEND-TODO Batch08). Giao diện chỉ mở thao tác khi cờ = true.
        json["verificationChecklistSupported"] = true; // S02: lưu checklist 4 mục, không cần số giấy tờ
        json["inspectionEvidenceSupported"] = true;    // S04: lưu phí, vệ sinh 10% cọc, lý do, hạng mục, ảnh (T05)
        json["refundEvidenceSupported"] = true;        // M08: tài khoản chính chủ + mã giao dịch/thời điểm chuyển (T08)
        json["returnPolicyVersion"] = "D32";           // M07: khấu trừ tối đa bằng cọc, hoàn hai bước (T06, T07, T09)
        json["deductionConfirmationSupported"] = true; // D39/D40: khách xác nhận khấu trừ 48 giờ, kiểm tra lại phương án
        json["cashRefundSupported"] = true;            // D42: hoàn tiền mặt tại quầy (/api/ops/cash-refunds)
        json["keyPickupOnRequest"] = true;             // D36: lịch nhận chìa khóa chỉ tạo khi khách gửi yêu cầu
        json["dailyReportSupported"] = true;           // D42: báo cáo cuối ngày (/api/ops/daily-report)
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
        catch (OpsConflictException ex)
        {
            return Results.Conflict(new { error = ex.Message });
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}
