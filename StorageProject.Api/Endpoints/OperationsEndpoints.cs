using System.Security.Claims;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.Exceptions;
using StorageProject.Core.Interfaces;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Khu Quản lý vận hành kinh doanh (Business Operations Manager) — UC19–UC23.
/// Chỉ role OPERATIONS; sai vai trò trả 403.
/// </summary>
public static class OperationsEndpoints
{
    public static void MapOperationsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/operations")
            .WithTags("Business Operations")
            .RequireAuthorization(policy => policy.RequireRole("OPERATIONS"));

        // ==========================================
        // UC19 — Cơ sở toàn hệ thống
        // ==========================================
        group.MapGet("/facilities", (string? status, string? search, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetFacilitiesAsync(status, search, ct))))
            .WithSummary("Danh sách cơ sở toàn hệ thống kèm số kho, tỷ lệ sử dụng, số loại kho có giá, số nhân sự");

        group.MapGet("/facilities/{id:long}", (long id, IOperationsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var facility = await ops.GetFacilityAsync(id, ct);
                return facility != null ? Results.Ok(facility) : NotFound($"Không tìm thấy cơ sở với ID: {id}");
            }))
            .WithSummary("Chi tiết một cơ sở");

        group.MapPost("/facilities", (UpsertFacilityRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var result = await ops.CreateFacilityAsync(request, user.GetUserId(), ct);
                return Results.Created($"/api/operations/facilities/{result.Facility.FacilityId}", result);
            }))
            .WithSummary("Thêm cơ sở mới; trả kèm cảnh báo (tên gần giống, thiếu giá/ô kho/nhân sự)");

        group.MapPut("/facilities/{id:long}", (long id, UpsertFacilityRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.UpdateFacilityAsync(id, request, user.GetUserId(), ct))))
            .WithSummary("Cập nhật tên, địa chỉ, liên hệ, giờ hoạt động");

        group.MapPut("/facilities/{id:long}/status", (long id, ChangeFacilityStatusRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.ChangeFacilityStatusAsync(id, request, user.GetUserId(), ct))))
            .WithSummary("Đổi trạng thái: ACTIVE / TEMPORARILY_CLOSED (chặn đặt mới) / INACTIVE (chỉ khi không còn hợp đồng, đơn đang xử lý)");

        // ==========================================
        // UC20 / UC21 — Chính sách, khung giá, phí, giảm giá, miễn phí
        // ==========================================
        group.MapGet("/policies", (string? type, string? status, long? facilityId, long? unitTypeId, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetPoliciesAsync(new PolicyQuery(type, status, facilityId, unitTypeId), ct))))
            .WithSummary("Danh sách chính sách, lọc theo loại / trạng thái / cơ sở / loại kho");

        group.MapGet("/policies/{id:long}", (long id, IOperationsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var policy = await ops.GetPolicyAsync(id, ct);
                return policy != null ? Results.Ok(policy) : NotFound($"Không tìm thấy chính sách với ID: {id}");
            }))
            .WithSummary("Chi tiết chính sách");

        group.MapPost("/policies", (UpsertPolicyRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                var policy = await ops.CreatePolicyAsync(request, user.GetUserId(), ct);
                return Results.Created($"/api/operations/policies/{policy.PolicyId}", policy);
            }))
            .WithSummary("Tạo chính sách ở trạng thái Nháp (DRAFT)");

        group.MapPut("/policies/{id:long}", (long id, UpsertPolicyRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.UpdatePolicyAsync(id, request, user.GetUserId(), ct))))
            .WithSummary("Sửa chính sách Nháp");

        group.MapPost("/policies/{id:long}/activate", (long id, bool? replaceExisting, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.ActivatePolicyAsync(id, replaceExisting ?? false, user.GetUserId(), ct))))
            .WithSummary("Áp dụng chính sách; trùng phạm vi trả 409, gửi replaceExisting=true để kết thúc hiệu lực bản cũ");

        group.MapPost("/policies/{id:long}/deactivate", (long id, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.DeactivatePolicyAsync(id, user.GetUserId(), ct))))
            .WithSummary("Ngừng áp dụng chính sách (giữ lại để truy vết)");

        group.MapDelete("/policies/{id:long}", (long id, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () =>
            {
                await ops.DeleteDraftPolicyAsync(id, user.GetUserId(), ct);
                return Results.Ok(new { message = "Đã xoá chính sách nháp." });
            }))
            .WithSummary("Xoá chính sách Nháp chưa từng áp dụng");

        // ==========================================
        // UC21 — Bảng giá thuê
        // ==========================================
        group.MapGet("/rates", (long? facilityId, long? unitTypeId, bool? includeHistory, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.GetRatesAsync(facilityId, unitTypeId, includeHistory ?? false, ct))))
            .WithSummary("Giá đang áp dụng và đã lên lịch; includeHistory=true để xem cả giá cũ");

        group.MapPost("/rates", (SetRateRequest request, ClaimsPrincipal user, IOperationsService ops, CancellationToken ct) =>
            Run(async () => Results.Ok(await ops.SetRateAsync(request, user.GetUserId(), ct))))
            .WithSummary("Đặt giá mới cho cơ sở + loại kho; kiểm tra khung giá, tự kết thúc giá cũ, không sửa giá đã chốt");

        // ==========================================
        // UC22 / UC23 — Báo cáo toàn hệ thống
        // ==========================================
        group.MapGet("/reports/facilities", (DateOnly? from, DateOnly? to, long? facilityId, long? unitTypeId, IOperationsReportService reports, CancellationToken ct) =>
            Run(async () => Results.Ok(await reports.GetSystemReportAsync(Filter(from, to, facilityId, unitTypeId), ct))))
            .WithSummary("Doanh thu, tiền thu/hoàn, cọc, công nợ, tỷ lệ sử dụng, quá hạn theo từng cơ sở + tổng hệ thống");

        group.MapGet("/reports/unit-types", (DateOnly? from, DateOnly? to, long? facilityId, long? unitTypeId, IOperationsReportService reports, CancellationToken ct) =>
            Run(async () => Results.Ok(await reports.GetUnitTypeReportAsync(Filter(from, to, facilityId, unitTypeId), ct))))
            .WithSummary("Các chỉ tiêu trên theo loại kho");

        group.MapGet("/reports/revenue-trend", (int? months, long? facilityId, long? unitTypeId, IOperationsReportService reports, CancellationToken ct) =>
            Run(async () => Results.Ok(await reports.GetRevenueTrendAsync(months ?? 6, facilityId, unitTypeId, ct))))
            .WithSummary("Tiền thu theo tháng (mặc định 6 tháng gần nhất)");

        group.MapGet("/reports/rental-status", (long? facilityId, long? unitTypeId, IOperationsReportService reports, CancellationToken ct) =>
            Run(async () => Results.Ok(await reports.GetRentalStatusAsync(facilityId, unitTypeId, ct))))
            .WithSummary("Số hợp đồng, đơn đặt chỗ, ô kho theo trạng thái");

        group.MapGet("/reports/facilities/{id:long}/contracts", (long id, string? status, long? unitTypeId, IOperationsReportService reports, CancellationToken ct) =>
            Run(async () => Results.Ok(await reports.GetFacilityContractsAsync(id, status, unitTypeId, ct))))
            .WithSummary("Chi tiết một cơ sở: hợp đồng, công nợ, case quá hạn");

        group.MapGet("/reports/export", (string? view, DateOnly? from, DateOnly? to, long? facilityId, long? unitTypeId, int? months,
                ClaimsPrincipal user, IOperationsReportService reports, CancellationToken ct) =>
            Run(async () =>
            {
                var file = await reports.ExportCsvAsync(view ?? "facilities", Filter(from, to, facilityId, unitTypeId), months ?? 6, user.GetUserId(), ct);
                return Results.File(file.Content, "text/csv; charset=utf-8", file.FileName);
            }))
            .WithSummary("Xuất CSV UTF-8: view = facilities | unit-types | revenue-trend, cùng bộ lọc với màn xem");
    }

    /// <summary>Kỳ mặc định: từ đầu tháng hiện tại đến hôm nay (giờ Việt Nam).</summary>
    private static ReportFilter Filter(DateOnly? from, DateOnly? to, long? facilityId, long? unitTypeId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        return new ReportFilter(from ?? new DateOnly(today.Year, today.Month, 1), to ?? today, facilityId, unitTypeId);
    }

    private static IResult NotFound(string message) => Results.NotFound(new { error = message });

    /// <summary>Quy ước lỗi chung (docs/conventions.md): 400 { error }, 404 { error }, 409 { error, details }.</summary>
    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (OperationConflictException ex)
        {
            return Results.Conflict(new { error = ex.Message, details = ex.Details });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}
