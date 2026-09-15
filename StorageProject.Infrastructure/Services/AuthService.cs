using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public class AuthService(AppDbContext dbContext, IConfiguration configuration) : IAuthService
{
    public async Task<AuthUserDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var existingUser = await dbContext.Users
            .AnyAsync(u => u.Username == request.Username || u.Email == request.Email, ct);

        if (existingUser)
        {
            throw new InvalidOperationException("Tên đăng nhập hoặc email đã tồn tại trong hệ thống.");
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = passwordHash,
            FullName = request.FullName,
            Phone = request.Phone,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(ct);

        // Assign CUSTOMER role
        var customerRole = await dbContext.Roles.FirstOrDefaultAsync(r => r.RoleName == "CUSTOMER", ct);
        if (customerRole == null)
        {
            customerRole = new Role
            {
                RoleName = "CUSTOMER",
                Description = "Khách hàng thuê kho tự quản"
            };
            dbContext.Roles.Add(customerRole);
            await dbContext.SaveChangesAsync(ct);
        }

        var userRole = new UserRole
        {
            UserId = user.UserId,
            RoleId = customerRole.RoleId,
            AssignedAt = DateTime.UtcNow
        };
        dbContext.UserRoles.Add(userRole);
        await dbContext.SaveChangesAsync(ct);

        return new AuthUserDto(
            user.UserId,
            user.Username,
            user.FullName,
            user.Email,
            user.Status
        );
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, string? ipAddress, string? deviceInfo, CancellationToken ct = default)
    {
        var user = await dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Username == request.Username, ct);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không chính xác.");
        }

        if (user.Status != "ACTIVE")
        {
            throw new InvalidOperationException("Tài khoản đang bị khóa hoặc ngưng hoạt động.");
        }

        // Record Login History
        var loginHistory = new LoginHistory
        {
            UserId = user.UserId,
            LoginAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            DeviceInfo = deviceInfo,
            LoginStatus = "SUCCESS"
        };
        dbContext.LoginHistories.Add(loginHistory);
        await dbContext.SaveChangesAsync(ct);

        // Generate JWT Token
        var secret = configuration["JwtSettings:Secret"] ?? "CHANGE_ME_TO_A_SECURE_256BIT_KEY_AT_LEAST_32_CHARS_LONG!!";
        var issuer = configuration["JwtSettings:Issuer"] ?? "SSFRMSApi";
        var audience = configuration["JwtSettings:Audience"] ?? "SSFRMSClients";
        var expiryMinutes = int.TryParse(configuration["JwtSettings:ExpiryMinutes"], out var mins) ? mins : 1440;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new("fullName", user.FullName),
            new("loginHistoryId", loginHistory.LoginHistoryId.ToString())
        };

        foreach (var userRole in user.UserRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, userRole.Role.RoleName));
        }

        var tokenDescriptor = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);

        var authUserDto = new AuthUserDto(
            user.UserId,
            user.Username,
            user.FullName,
            user.Email,
            user.Status
        );

        return new LoginResponse(tokenString, expiresAt, authUserDto);
    }

    public async Task LogoutAsync(long loginHistoryId, CancellationToken ct = default)
    {
        var history = await dbContext.LoginHistories.FindAsync([loginHistoryId], ct);
        if (history != null)
        {
            history.LogoutAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);
        }
    }
}
