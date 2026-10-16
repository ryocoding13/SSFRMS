namespace StorageProject.Core.DTOs.Auth;

public record RegisterRequest(
    string Username,
    string Email,
    string Password,
    string FullName,
    string? Phone
);

public record LoginRequest(
    string Username,
    string Password
);

public record LoginResponse(
    string Token,
    DateTime ExpiresAt,
    AuthUserDto User
);

public record AuthUserDto(
    long UserId,
    string Username,
    string FullName,
    string Email,
    string Status
);

public record UserProfileDto(
    long UserId,
    string Username,
    string FullName,
    string Email,
    string? Phone,
    string Status,
    IReadOnlyList<string> Roles
);

public record UpdateProfileRequest(
    string FullName,
    string? Phone
);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword
);
