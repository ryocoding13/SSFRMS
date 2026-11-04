namespace StorageProject.Core.DTOs.Auth;

public record PasswordResetRequest(string? Email);
public record PasswordResetConfirmRequest(string? Email, string? Code, string? NewPassword);
public record PasswordResetRequestedDto(string Message, int RetryAfterSeconds = 60, int ExpiresInSeconds = 600);
