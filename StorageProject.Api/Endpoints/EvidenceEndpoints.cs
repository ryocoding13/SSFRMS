using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;

namespace StorageProject.Api.Endpoints;

/// <summary>
/// Ảnh bằng chứng (trả kho, kiểm kê). Không cần token vì link mở trong tab mới; thay vào đó URL do server cấp
/// kèm chữ ký HMAC và hạn 1 giờ (EvidencePhotos.Url) — chỉ người vừa được API trả link (đúng quyền) mới có.
/// Sai chữ ký / hết hạn → 404 để không lộ ảnh có tồn tại hay không.
/// </summary>
public static class EvidenceEndpoints
{
    public static void MapEvidenceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/evidence-photos/{id:long}", async (long id, long? exp, string? sig, AppDbContext db, HttpContext http, CancellationToken ct) =>
            {
                if (exp is not long expires || !EvidencePhotos.Verify(id, expires, sig)) return Results.NotFound();
                var photo = await db.EvidencePhotos.AsNoTracking()
                    .Where(p => p.PhotoId == id)
                    .Select(p => new { p.Data, p.ContentType })
                    .FirstOrDefaultAsync(ct);
                if (photo == null) return Results.NotFound();
                http.Response.Headers.CacheControl = "private, max-age=600";
                http.Response.Headers["X-Content-Type-Options"] = "nosniff";
                return Results.File(photo.Data, photo.ContentType);
            })
            .AllowAnonymous()
            .WithTags("Evidence")
            .WithSummary("Ảnh bằng chứng qua URL có chữ ký, hết hạn sau 1 giờ");
    }
}
