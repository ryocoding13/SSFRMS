using System.Security.Claims;

namespace StorageProject.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static long GetUserId(this ClaimsPrincipal principal)
    {
        var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return long.TryParse(idClaim, out var id) ? id : 0;
    }
}
