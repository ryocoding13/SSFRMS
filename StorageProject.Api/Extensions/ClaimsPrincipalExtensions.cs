using System.Security.Claims;

namespace StorageProject.Api.Extensions;

/// <summary>
/// Các phương thức mở rộng tiện ích cho ClaimsPrincipal để trích xuất thông tin người dùng từ JWT Token.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Lấy định danh ID người dùng hiện tại từ claim NameIdentifier.
    /// </summary>
    /// <param name="principal">Đối tượng ClaimsPrincipal chứa thông tin người dùng xác thực.</param>
    /// <returns>Mã ID người dùng (long), trả về 0 nếu không tìm thấy hoặc parse thất bại.</returns>
    public static long GetUserId(this ClaimsPrincipal principal)
    {
        var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return long.TryParse(idClaim, out var id) ? id : 0;
    }

    /// <summary>
    /// Lấy vai trò (Role) của người dùng hiện tại từ claim Role hoặc "role".
    /// </summary>
    /// <param name="principal">Đối tượng ClaimsPrincipal chứa thông tin người dùng xác thực.</param>
    /// <returns>Tên vai trò (ví dụ: "CUSTOMER", "STAFF", "MANAGER", "ADMIN", "OPERATIONS").</returns>
    public static string GetUserRole(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Role)?.Value 
            ?? principal.FindFirst("role")?.Value 
            ?? "CUSTOMER";
    }
}
