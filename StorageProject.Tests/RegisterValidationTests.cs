using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class RegisterValidationTests
{
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        public AuthSupportHttpFixture.TestDb Db { get; private set; } = null!;
        public AuthService Service { get; private set; } = null!;

        public static async Task<Fixture> Create()
        {
            var f = new Fixture();
            await f.connection.OpenAsync();
            f.Db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            var role = new Role { RoleName = "CUSTOMER", Description = "Khách hàng" };
            var existingUser = new User
            {
                Username = "existinguser",
                Email = "existing@example.com",
                FullName = "Người dùng cũ",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Test@123", 4),
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            f.Db.AddRange(role, existingUser);
            await f.Db.SaveChangesAsync();

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:Secret"] = "register-validation-tests-secret-key-at-least-32-chars!!"
            }).Build();
            f.Service = new(f.Db, config);
            return f;
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    [Theory]
    [InlineData("user@name")]
    [InlineData("customer@safespace.vn")]
    [InlineData("@invalid")]
    public async Task Register_WithAtSign_ThrowsArgumentException(string username)
    {
        await using var f = await Fixture.Create();
        var req = new RegisterRequest(username, "test@example.com", "Password@123", "Nguyễn Văn A", "0901234567");

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => f.Service.RegisterAsync(req));
        Assert.Contains("@", ex.Message);
    }

    [Theory]
    [InlineData("user name")]
    [InlineData(" user")]
    [InlineData("user ")]
    [InlineData("user\tname")]
    public async Task Register_WithWhitespace_ThrowsArgumentException(string username)
    {
        await using var f = await Fixture.Create();
        var req = new RegisterRequest(username, "test@example.com", "Password@123", "Nguyễn Văn A", "0901234567");

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => f.Service.RegisterAsync(req));
        Assert.Contains("khoảng trắng", ex.Message);
    }

    [Fact]
    public async Task Register_Exceeding50Characters_ThrowsArgumentException()
    {
        await using var f = await Fixture.Create();
        var longUsername = new string('a', 51);
        var req = new RegisterRequest(longUsername, "test@example.com", "Password@123", "Nguyễn Văn A", "0901234567");

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => f.Service.RegisterAsync(req));
        Assert.Contains("50 ký tự", ex.Message);
    }

    [Fact]
    public async Task Register_Exactly50Characters_Succeeds()
    {
        await using var f = await Fixture.Create();
        var maxUsername = new string('a', 50);
        var req = new RegisterRequest(maxUsername, "test@example.com", "Password@123", "Nguyễn Văn A", "0901234567");

        var user = await f.Service.RegisterAsync(req);
        Assert.NotNull(user);
        Assert.Equal(maxUsername, user.Username);

        // Can log in with username
        var loginRes = await f.Service.LoginAsync(new LoginRequest(maxUsername, "Password@123"), null, null);
        Assert.NotNull(loginRes);
        Assert.Equal(user.UserId, loginRes.User.UserId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Register_EmptyOrNullUsername_ThrowsArgumentException(string? username)
    {
        await using var f = await Fixture.Create();
        var req = new RegisterRequest(username!, "test@example.com", "Password@123", "Nguyễn Văn A", "0901234567");

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => f.Service.RegisterAsync(req));
        Assert.Contains("trống", ex.Message);
    }

    [Fact]
    public async Task Register_ExistingUsernameOrEmail_ThrowsInvalidOperationException()
    {
        await using var f = await Fixture.Create();
        var dupUsernameReq = new RegisterRequest("existinguser", "unique@example.com", "Password@123", "Người dùng", null);
        var ex1 = await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.RegisterAsync(dupUsernameReq));
        Assert.Contains("tồn tại", ex1.Message);

        var dupEmailReq = new RegisterRequest("uniquename", "EXISTING@example.com", "Password@123", "Người dùng", null);
        var ex2 = await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.RegisterAsync(dupEmailReq));
        Assert.Contains("tồn tại", ex2.Message);
    }

    [Fact]
    public async Task Register_ValidCustomer_CanLoginWithUsernameOrEmail()
    {
        await using var f = await Fixture.Create();
        var req = new RegisterRequest("newcustomer", "newcustomer@gmail.com", "SecurePass@123", "Trần Thị B", "0912345678");

        var created = await f.Service.RegisterAsync(req);
        Assert.NotNull(created);
        Assert.Equal("newcustomer", created.Username);
        Assert.Equal("newcustomer@gmail.com", created.Email);
        Assert.Equal("ACTIVE", created.Status);

        // Verify CUSTOMER role assigned
        var userRole = await f.Db.UserRoles
            .Include(ur => ur.Role)
            .FirstOrDefaultAsync(ur => ur.UserId == created.UserId);
        Assert.NotNull(userRole);
        Assert.Equal("CUSTOMER", userRole.Role.RoleName);

        // Login with username
        var loginByUsername = await f.Service.LoginAsync(new LoginRequest("newcustomer", "SecurePass@123"), null, null);
        Assert.NotNull(loginByUsername.Token);

        // Login with email
        var loginByEmail = await f.Service.LoginAsync(new LoginRequest("NEWCUSTOMER@GMAIL.COM", "SecurePass@123"), null, null);
        Assert.NotNull(loginByEmail.Token);
    }
}
