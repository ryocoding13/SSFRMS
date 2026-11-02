using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Ảnh bằng chứng (D32 / T05, T08): kiểm ảnh tải lên, lưu riêng tư trong DB và cấp URL có chữ ký hết hạn.
/// Không tin MIME, đuôi tệp hay kiểm tra phía giao diện: tự kiểm chữ ký JPG/PNG và kích thước sau giải mã.
/// </summary>
public static class EvidencePhotos
{
    public const int MaxPhotos = 5;
    public const int MaxBytes = 5 * 1024 * 1024;
    public const string MoveOut = "MOVE_OUT";
    public const string ReturnInspection = "RETURN_INSPECTION";

    /// <summary>Giới hạn thân request cho endpoint nhận ảnh: 5 ảnh × 5 MiB base64 (~6,7 MiB/ảnh) + phần JSON khác.</summary>
    public const long RequestBodyLimit = 40L * 1024 * 1024;

    private static readonly TimeSpan UrlLifetime = TimeSpan.FromHours(1);
    private static byte[] signingKey = RandomNumberGenerator.GetBytes(32); // thay bằng khoá cấu hình khi khởi động
    private static string publicBaseUrl = "";

    /// <summary>Gọi một lần ở Program.cs: khoá ký lấy từ JwtSettings:Secret; baseUrl để link ảnh mở được khi FE khác origin (dev).</summary>
    public static void Configure(string? secret, string? baseUrl)
    {
        if (!string.IsNullOrWhiteSpace(secret))
            signingKey = SHA256.HashData(Encoding.UTF8.GetBytes("evidence-photo:" + secret));
        publicBaseUrl = (baseUrl ?? "").Trim().TrimEnd('/');
    }

    public sealed record Decoded(string FileName, string ContentType, byte[] Data);

    /// <summary>Kiểm toàn bộ ảnh trước khi ghi bất cứ thứ gì; lỗi → ArgumentException (400).</summary>
    public static List<Decoded> Decode(IReadOnlyList<EvidencePhotoUpload>? uploads, bool required, string what)
    {
        var list = uploads ?? [];
        if (required && list.Count == 0) throw new ArgumentException($"Vui lòng tải ít nhất một ảnh {what}.");
        if (list.Count > MaxPhotos) throw new ArgumentException($"Chỉ được tải tối đa {MaxPhotos} ảnh {what}.");

        // Độ dài base64 tối đa của 5 MiB (kèm padding) — chặn trước khi cấp phát bộ nhớ giải mã.
        const int maxEncoded = (MaxBytes + 2) / 3 * 4;
        var result = new List<Decoded>(list.Count);
        for (var i = 0; i < list.Count; i++)
        {
            var p = list[i] ?? throw new ArgumentException("Ảnh không hợp lệ.");
            var type = (p.ContentType ?? "").Trim().ToLowerInvariant();
            if (type is not ("image/jpeg" or "image/png"))
                throw new ArgumentException("Ảnh phải là JPG hoặc PNG.");
            var text = (p.DataBase64 ?? "").Trim();
            var comma = text.IndexOf(',');
            if (text.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && comma > 0) text = text[(comma + 1)..];
            if (text.Length == 0 || text.Length > maxEncoded)
                throw new ArgumentException($"Mỗi ảnh không quá {MaxBytes / 1024 / 1024} MB.");
            var buffer = new byte[text.Length / 4 * 3 + 3];
            if (!Convert.TryFromBase64String(text, buffer, out var size) || size == 0)
                throw new ArgumentException("Không đọc được nội dung ảnh. Vui lòng chọn lại.");
            if (size > MaxBytes) throw new ArgumentException($"Mỗi ảnh không quá {MaxBytes / 1024 / 1024} MB.");
            var data = buffer.AsSpan(0, size).ToArray();
            if (!SignatureMatches(type, data))
                throw new ArgumentException("Nội dung ảnh không đúng định dạng JPG/PNG. Vui lòng chọn ảnh khác.");
            result.Add(new Decoded(SafeName(p.FileName, i, type), type, data));
        }
        return result;
    }

    public static bool SignatureMatches(string contentType, ReadOnlySpan<byte> data) => contentType switch
    {
        "image/jpeg" => data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF,
        "image/png" => data.Length >= 8 && data[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        _ => false
    };

    /// <summary>Tên tệp chỉ để hiển thị: bỏ đường dẫn, ký tự điều khiển; thiếu thì đặt tên mặc định.</summary>
    public static string SafeName(string? fileName, int index, string contentType)
    {
        var name = Path.GetFileName((fileName ?? "").Replace('\\', '/'));
        name = new string(name.Where(c => !char.IsControl(c) && c is not ('<' or '>' or '"')).ToArray()).Trim();
        if (name.Length == 0) name = $"anh-{index + 1}{(contentType == "image/png" ? ".png" : ".jpg")}";
        return name.Length > 200 ? name[^200..] : name;
    }

    /// <summary>Thêm ảnh đã kiểm vào DbContext (lưu cùng SaveChanges của nghiệp vụ).</summary>
    public static void Attach(AppDbContext db, IEnumerable<Decoded> photos, string ownerType, long ownerId, long uploadedBy, DateTime now)
    {
        foreach (var p in photos)
        {
            db.EvidencePhotos.Add(new EvidencePhoto
            {
                OwnerType = ownerType, OwnerId = ownerId, FileName = p.FileName, ContentType = p.ContentType,
                SizeBytes = p.Data.Length, Data = p.Data, UploadedBy = uploadedBy, CreatedAt = now
            });
        }
    }

    /// <summary>URL ảnh (id, tên) theo chủ sở hữu, không tải nội dung ảnh.</summary>
    public static async Task<Dictionary<long, List<EvidencePhotoDto>>> UrlsAsync(AppDbContext db, string ownerType, ICollection<long> ownerIds, CancellationToken ct)
    {
        if (ownerIds.Count == 0) return new Dictionary<long, List<EvidencePhotoDto>>();
        var rows = await db.EvidencePhotos.AsNoTracking()
            .Where(p => p.OwnerType == ownerType && ownerIds.Contains(p.OwnerId))
            .OrderBy(p => p.PhotoId)
            .Select(p => new { p.PhotoId, p.OwnerId, p.FileName })
            .ToListAsync(ct);
        return rows.GroupBy(r => r.OwnerId)
            .ToDictionary(g => g.Key, g => g.Select(r => new EvidencePhotoDto(Url(r.PhotoId), r.FileName)).ToList());
    }

    public static string Url(long photoId, DateTime? nowUtc = null)
    {
        var exp = new DateTimeOffset((nowUtc ?? DateTime.UtcNow) + UrlLifetime).ToUnixTimeSeconds();
        return $"{publicBaseUrl}/api/evidence-photos/{photoId}?exp={exp}&sig={Sign(photoId, exp)}";
    }

    /// <summary>Kiểm chữ ký và hạn của URL ảnh (so sánh thời gian hằng).</summary>
    public static bool Verify(long photoId, long exp, string? sig, DateTime? nowUtc = null)
    {
        if (string.IsNullOrEmpty(sig) || exp < new DateTimeOffset(nowUtc ?? DateTime.UtcNow).ToUnixTimeSeconds()) return false;
        var expected = Encoding.ASCII.GetBytes(Sign(photoId, exp));
        var actual = Encoding.ASCII.GetBytes(sig);
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    private static string Sign(long photoId, long exp)
    {
        var mac = HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(string.Create(CultureInfo.InvariantCulture, $"{photoId}:{exp}")));
        return Convert.ToBase64String(mac).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
