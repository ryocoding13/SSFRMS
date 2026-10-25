using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class EmailLoginTests
{
    private const string Password = "Customer@123";

    // Database riêng cho từng ca; email cố ý khác username và có chữ hoa.
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        public AuthSupportHttpFixture.TestDb Db { get; private set; } = null!;
        public User Customer { get; private set; } = null!;
        public AuthService Service { get; private set; } = null!;

        public static async Task<Fixture> Create()
        {
            var f = new Fixture();
            await f.connection.OpenAsync();
            f.Db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.connection).Options);
            await f.Db.Database.EnsureCreatedAsync();
            f.Customer = new User
            {
                Username = "customer01", Email = "Customer@Example.com", FullName = "Khách kiểm thử",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password, 4), Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            var role = new Role { RoleName = "CUSTOMER" };
            f.Db.AddRange(f.Customer, role);
            await f.Db.SaveChangesAsync();
            f.Db.Add(new UserRole { UserId = f.Customer.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow });
            await f.Db.SaveChangesAsync();
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:Secret"] = "email-login-tests-only-key-at-least-thirty-two-characters"
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
    [InlineData("customer01")]
    [InlineData("  customer01  ")]
    [InlineData("customer@example.com")]
    [InlineData("CUSTOMER@EXAMPLE.COM")]
    [InlineData("  Customer@Example.com  ")]
    public async Task UsernameAndEmailIdentifyTheSameUserAndKeepRolesAndHistory(string identifier)
    {
        await using var f = await Fixture.Create();
        var response = await f.Service.LoginAsync(new(identifier, Password), "127.0.0.1", "email-login-test");
        Assert.Equal(f.Customer.UserId, response.User.UserId);
        Assert.Equal("customer01", response.User.Username);
        Assert.Equal("Customer@Example.com", response.User.Email);
        Assert.Contains(new JwtSecurityTokenHandler().ReadJwtToken(response.Token).Claims,
            c => c.Value == "CUSTOMER");
        var history = await f.Db.LoginHistories.SingleAsync();
        Assert.Equal(f.Customer.UserId, history.UserId);
        Assert.Equal("SUCCESS", history.LoginStatus);
        Assert.Equal("127.0.0.1", history.IpAddress);
    }

    [Theory]
    [InlineData(null, Password)]
    [InlineData("", Password)]
    [InlineData("  ", Password)]
    [InlineData("missing@example.com", Password)]
    [InlineData("customer@example.com", "Wrong@123")]
    [InlineData("customer01", "Wrong@123")]
    [InlineData("customer@example.com", null)]
    [InlineData("customer@example.com", "")]
    public async Task InvalidCredentialsDoNotCreateASuccessHistory(string? identifier, string? password)
    {
        await using var f = await Fixture.Create();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            f.Service.LoginAsync(new(identifier!, password!), null, null));
        Assert.Empty(await f.Db.LoginHistories.ToListAsync());
    }

    [Theory]
    [InlineData("LOCKED")]
    [InlineData("INACTIVE")]
    [InlineData("SUSPENDED")]
    public async Task EmailLoginStillRejectsAnAccountThatIsNotActive(string status)
    {
        await using var f = await Fixture.Create();
        f.Customer.Status = status;
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Service.LoginAsync(new("customer@example.com", Password), null, null));
        Assert.Empty(await f.Db.LoginHistories.ToListAsync());
    }

    [Theory]
    [InlineData("Customer@123")]
    [InlineData("Other@123")]
    public async Task UsernameMatchingAnotherUsersEmailIsRejectedRatherThanChoosingAnAccount(string password)
    {
        await using var f = await Fixture.Create();
        f.Db.Add(new User
        {
            Username = "customer@example.com", Email = "other@example.com", FullName = "Tài khoản khác",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Other@123", 4), Status = "ACTIVE"
        });
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            f.Service.LoginAsync(new("customer@example.com", password), null, null));
        Assert.Empty(await f.Db.LoginHistories.ToListAsync());
    }

    [Fact]
    public async Task EmailsDifferingOnlyByCaseAreRejectedIfTheyBelongToDifferentUsers()
    {
        await using var f = await Fixture.Create();
        f.Db.Add(new User
        {
            Username = "other", Email = "CUSTOMER@EXAMPLE.COM", FullName = "Tài khoản khác",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password, 4), Status = "ACTIVE"
        });
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            f.Service.LoginAsync(new("customer@example.com", Password), null, null));
        Assert.Empty(await f.Db.LoginHistories.ToListAsync());
    }

    [Fact]
    public async Task EmailUsedAsUsernameForTheSameAccountIsNotAmbiguous()
    {
        await using var f = await Fixture.Create();
        f.Customer.Username = "customer@example.com";
        await f.Db.SaveChangesAsync();
        Assert.Equal(f.Customer.UserId,
            (await f.Service.LoginAsync(new("customer@example.com", Password), null, null)).User.UserId);
    }

    [Fact]
    public async Task PasswordWhitespaceIsNotTrimmed()
    {
        await using var f = await Fixture.Create();
        f.Customer.PasswordHash = BCrypt.Net.BCrypt.HashPassword("  Secret@123  ", 4);
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            f.Service.LoginAsync(new("customer@example.com", "Secret@123"), null, null));
        Assert.Equal(f.Customer.UserId,
            (await f.Service.LoginAsync(new("customer@example.com", "  Secret@123  "), null, null)).User.UserId);
    }

    [Theory]
    [InlineData("customer01", "Customer@123", "CUSTOMER")]
    [InlineData("  CUSTOMER01@EXAMPLE.COM  ", "Customer@123", "CUSTOMER")]
    [InlineData("staff01@example.com", "Staff@123", "STAFF")]
    public async Task ExistingLoginJsonAcceptsEmailAndReturnsAJwtThatCanReadTheCorrectProfile(
        string identifier, string password, string role)
    {
        await using var host = await AuthSupportHttpFixture.Create();
        using var client = host.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { username = identifier, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.Content.ReadFromJsonAsync<JsonElement>();
        using var authed = host.Client(login.GetProperty("token").GetString());
        var profile = await authed.GetFromJsonAsync<JsonElement>("/api/auth/profile");
        Assert.Equal(login.GetProperty("user").GetProperty("userId").GetInt64(), profile.GetProperty("userId").GetInt64());
        Assert.Contains(role, profile.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task WrongEmailPasswordKeepsTheExistingUnauthorizedHttpContract()
    {
        await using var host = await AuthSupportHttpFixture.Create();
        using var client = host.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/login",
            new { username = "customer01@example.com", password = "Wrong@123" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/profile")).StatusCode);
    }
}
