using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using MimeKit;
using StorageProject.Api.Endpoints;
using StorageProject.Api.Extensions;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class ResetClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => Now;
    public void Advance(TimeSpan time) => Now += time;
}

public sealed class ResetMailbox : IPasswordResetEmailSender
{
    public List<(string Email, string Code)> Messages { get; } = [];
    public bool Fail { get; set; }
    public void ValidateConfiguration() { if (Fail) throw new PasswordResetDeliveryException(); }
    public Task SendAsync(string email, string code, CancellationToken ct = default)
    {
        ValidateConfiguration();
        Messages.Add((email, code));
        return Task.CompletedTask;
    }
}

// Kestrel/JWT/service thật và DB SQLite riêng. Mailbox chỉ được đọc từ test, không có endpoint lấy OTP.
public sealed class PasswordResetFixture : IAsyncDisposable
{
    private readonly string database = Path.Combine(Path.GetTempPath(), $"reset-{Guid.NewGuid():N}.db");
    private WebApplication app = null!;
    public string Address { get; private set; } = "";
    public ResetClock Clock { get; } = new();
    public ResetMailbox Mailbox { get; } = new();
    public IServiceScope Scope() => app.Services.CreateScope();
    public HttpClient Client() => new() { BaseAddress = new Uri(Address) };
    public async Task WithDb(Func<AppDbContext, Task> action)
    {
        using var scope = Scope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
    public static async Task<PasswordResetFixture> Create()
    {
        var f = new PasswordResetFixture();
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        const string secret = "password-reset-http-test-only-jwt-secret-at-least-32";
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> {
            ["JwtSettings:Secret"] = secret, ["PasswordReset:HashKey"] = "password-reset-test-only-hmac-key-more-than-32"
        });
        builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite($"Data Source={f.database}"), contextLifetime: ServiceLifetime.Scoped);
        // Leverage existing provider adaptation for SQL default expressions.
        builder.Services.AddScoped<AppDbContext>(_ => new AuthSupportHttpFixture.TestDb(
            new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={f.database}").Options));
        builder.Services.AddSingleton<TimeProvider>(f.Clock);
        builder.Services.AddSingleton<IPasswordResetEmailSender>(f.Mailbox);
        builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
        builder.Services.AddScoped<IAuthService, AuthService>();
        builder.Services.AddScoped<IFacilityService, FacilityService>();
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => {
            o.Events = new JwtBearerEvents { OnTokenValidated = AuthSessionValidation.ValidateAsync };
            o.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = true, ValidIssuer = "SSFRMSApi",
                ValidateAudience = true, ValidAudience = "SSFRMSClients", ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), ValidateLifetime = true };
        });
        builder.Services.AddAuthorization();
        builder.Services.AddRateLimiter(PasswordResetRateLimits.Configure);
        builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
        f.app = builder.Build();
        f.app.UseCors(); f.app.UseAuthentication(); f.app.UseAuthorization(); f.app.UseRateLimiter();
        f.app.MapAuthEndpoints(); f.app.MapPasswordResetEndpoints(); f.app.MapFacilityEndpoints();
        await f.WithDb(async db => {
            await db.Database.EnsureCreatedAsync();
            var role = new Role { RoleName = "CUSTOMER" };
            var user = new User { Username = "resetcustomer", Email = "Customer@Example.com", FullName = "Khách kiểm thử",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Customer@123", 4), Status = "ACTIVE", CreatedAt = DateTime.UtcNow };
            db.AddRange(role, user); await db.SaveChangesAsync();
            db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId, AssignedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        });
        await f.app.StartAsync();
        f.Address = f.app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        return f;
    }
    public async Task Request(string email = "customer@example.com")
    {
        using var c = Client(); (await c.PostAsJsonAsync("/api/auth/password-reset/request", new { email })).EnsureSuccessStatusCode();
    }
    public async Task<HttpResponseMessage> Confirm(string? code = null, string password = "NewCustomer@123", string email = "customer@example.com")
    {
        using var c = Client();
        return await c.PostAsJsonAsync("/api/auth/password-reset/confirm", new { email, code = code ?? Mailbox.Messages.Last().Code, newPassword = password });
    }
    public async ValueTask DisposeAsync()
    {
        await app.StopAsync(); await app.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-shm", "-wal" }) if (File.Exists(database + suffix)) File.Delete(database + suffix);
    }
}

public sealed class PasswordResetTests
{
    [Fact] public async Task ResetThroughHttpConsumesCodeChangesPasswordAndRevokesOldJwt()
    {
        await using var f = await PasswordResetFixture.Create();
        using var c = f.Client();
        var login = await c.PostAsJsonAsync("/api/auth/login", new { username = "resetcustomer", password = "Customer@123" });
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        c.DefaultRequestHeaders.Authorization = new("Bearer", token);
        (await c.GetAsync("/api/auth/profile")).EnsureSuccessStatusCode();
        await f.Request("  CUSTOMER@example.com  ");
        Assert.Matches("^[0-9]{6}$", Assert.Single(f.Mailbox.Messages).Code);
        await f.WithDb(async db => { var row = await db.PasswordResetChallenges.SingleAsync(); Assert.NotEqual(f.Mailbox.Messages[0].Code, row.CodeHash); Assert.Equal(64, row.CodeHash.Length); });
        (await f.Confirm()).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/auth/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm()).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new { username = "resetcustomer", password = "Customer@123" })).StatusCode);
        (await c.PostAsJsonAsync("/api/auth/login", new { username = "customer@example.com", password = "NewCustomer@123" })).EnsureSuccessStatusCode();
        await f.WithDb(async db => { Assert.NotNull((await db.PasswordResetChallenges.SingleAsync()).UsedAt); Assert.Equal("ACTIVE", (await db.Users.SingleAsync()).Status); Assert.Single(await db.UserRoles.ToListAsync()); });
    }
    [Theory]
    [InlineData("missing@example.com", "ACTIVE")]
    [InlineData("customer@example.com", "LOCKED")]
    [InlineData("customer@example.com", "INACTIVE")]
    [InlineData("customer@example.com", "SUSPENDED")]
    public async Task MissingOrInactiveEmailGetsSameGenericReplyAndNoMail(string email, string status)
    {
        await using var f = await PasswordResetFixture.Create();
        await f.WithDb(async db => { (await db.Users.SingleAsync()).Status = status; await db.SaveChangesAsync(); });
        using var c = f.Client(); var r = await c.PostAsJsonAsync("/api/auth/password-reset/request", new { email });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("Nếu email đã đăng ký", await r.Content.ReadAsStringAsync());
        Assert.DoesNotContain("demoCode", await r.Content.ReadAsStringAsync());
        Assert.Empty(f.Mailbox.Messages);
    }
    [Fact] public async Task ResendHonorsCooldownReplacesCodeAndPreservesHourlyLimit()
    {
        await using var f = await PasswordResetFixture.Create();
        await f.Request(); var old = f.Mailbox.Messages[0].Code;
        await f.Request(); Assert.Single(f.Mailbox.Messages);
        f.Clock.Advance(TimeSpan.FromSeconds(61)); await f.Request();
        Assert.Equal(2, f.Mailbox.Messages.Count);
        Assert.NotEqual(old, f.Mailbox.Messages[1].Code);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm(old)).StatusCode);
        await f.WithDb(async db => Assert.Equal(2, (await db.PasswordResetChallenges.SingleAsync()).RequestCount));
        for (var i = 0; i < 4; i++) { f.Clock.Advance(TimeSpan.FromSeconds(61)); await f.Request(); }
        Assert.Equal(5, f.Mailbox.Messages.Count);
        f.Clock.Advance(TimeSpan.FromHours(1)); await f.Request(); Assert.Equal(6, f.Mailbox.Messages.Count);
    }
    [Fact] public async Task WrongCodeIsCountedAndFiveFailuresBlockEvenCorrectCode()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        var wrong = f.Mailbox.Messages[0].Code == "000000" ? "111111" : "000000";
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm(wrong)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm()).StatusCode);
        await f.WithDb(async db => Assert.Equal(5, (await db.PasswordResetChallenges.SingleAsync()).FailedAttempts));
        f.Clock.Advance(TimeSpan.FromSeconds(61)); await f.Request(); (await f.Confirm()).EnsureSuccessStatusCode();
    }
    [Fact] public async Task CodeExpiresAtTenMinutes()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        f.Clock.Advance(TimeSpan.FromMinutes(10)); Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm()).StatusCode);
    }
    [Theory]
    [InlineData("")]
    [InlineData("not-email")]
    [InlineData("Name <customer@example.com>")]
    public async Task InvalidEmailsReturnBadRequest(string email)
    {
        await using var f = await PasswordResetFixture.Create(); using var c = f.Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/password-reset/request", new { email })).StatusCode);
        Assert.Empty(f.Mailbox.Messages);
    }
    [Theory]
    [InlineData("short")]
    [InlineData("        ")]
    [InlineData("Customer@123")]
    public async Task InvalidOrUnchangedPasswordDoesNotConsumeCorrectCode(string password)
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm(password: password)).StatusCode);
        (await f.Confirm()).EnsureSuccessStatusCode();
    }
    [Fact] public async Task PasswordUsesBcryptUtf8LimitAndPreservesSpaces()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm(password: new string('đ', 40))).StatusCode);
        (await f.Confirm(password: "  NewCustomer@123  ")).EnsureSuccessStatusCode();
        using var c = f.Client(); (await c.PostAsJsonAsync("/api/auth/login", new { username = "resetcustomer", password = "  NewCustomer@123  " })).EnsureSuccessStatusCode();
    }
    [Fact] public async Task PasswordChangeAfterRequestInvalidatesTheCode()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        await f.WithDb(async db => { (await db.Users.SingleAsync()).PasswordHash = BCrypt.Net.BCrypt.HashPassword("Different@123", 4); await db.SaveChangesAsync(); });
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm()).StatusCode);
    }
    [Fact] public async Task MailFailureReportsUnavailableAndKeepsPreviousChallenge()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        f.Clock.Advance(TimeSpan.FromSeconds(61)); f.Mailbox.Fail = true;
        using var c = f.Client(); Assert.Equal(HttpStatusCode.ServiceUnavailable, (await c.PostAsJsonAsync("/api/auth/password-reset/request", new { email = "customer@example.com" })).StatusCode);
        f.Mailbox.Fail = false; (await f.Confirm()).EnsureSuccessStatusCode();
    }
    [Fact] public async Task IpRateLimitReturnsJsonAndRetryAfter()
    {
        await using var f = await PasswordResetFixture.Create(); using var c = f.Client();
        for (var i = 0; i < 10; i++) (await c.PostAsJsonAsync("/api/auth/password-reset/request", new { email = "missing@example.com" })).EnsureSuccessStatusCode();
        var blocked = await c.PostAsJsonAsync("/api/auth/password-reset/request", new { email = "missing@example.com" });
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode); Assert.NotNull(blocked.Headers.RetryAfter);
        Assert.True((await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("retryAfterSeconds").GetInt32() > 0);
    }
    [Fact] public async Task AnotherEmailCannotUseTheCustomersCode()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm(email: "other@example.com")).StatusCode);
        (await f.Confirm()).EnsureSuccessStatusCode();
    }
    [Fact] public async Task MalformedCodeCountsAsFailure()
    {
        await using var f = await PasswordResetFixture.Create(); await f.Request();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Confirm("bad")).StatusCode);
        await f.WithDb(async db => Assert.Equal(1, (await db.PasswordResetChallenges.SingleAsync()).FailedAttempts));
    }
    [Fact] public void RemoteSmtpCannotDisableTls()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["Smtp:Host"] = "smtp.example.com", ["Smtp:FromEmail"] = "support@example.com", ["Smtp:Security"] = "None",
            ["Smtp:Username"] = "support@example.com", ["Smtp:Password"] = "test-only"
        }).Build();
        Assert.Throws<PasswordResetDeliveryException>(() => new SmtpPasswordResetEmailSender(config).ValidateConfiguration());
    }
}

// Máy nhận SMTP chạy loopback, không gửi thư ra Internet và không dùng trong API sản phẩm.
public sealed class ResetSmtpServer : IAsyncDisposable
{
    private readonly TcpListener listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource stopped = new();
    private readonly Task loop;
    public string? LastMessage { get; private set; }
    public int Port => ((IPEndPoint)listener.LocalEndpoint).Port;
    public ResetSmtpServer() { listener.Start(); loop = Run(); }
    private async Task Run()
    {
        try
        {
            while (!stopped.IsCancellationRequested)
            {
                using var socket = await listener.AcceptTcpClientAsync(stopped.Token);
                using var stream = socket.GetStream();
                using var reader = new StreamReader(stream, Encoding.UTF8, leaveOpen: true);
                using var writer = new StreamWriter(stream, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true, NewLine = "\r\n" };
                await writer.WriteLineAsync("220 localhost SMTP test");
                while (await reader.ReadLineAsync(stopped.Token) is string line)
                {
                    if (line.StartsWith("EHLO") || line.StartsWith("HELO")) await writer.WriteLineAsync("250 localhost");
                    else if (line.StartsWith("DATA"))
                    {
                        await writer.WriteLineAsync("354 End with dot");
                        var body = new StringBuilder();
                        while (await reader.ReadLineAsync(stopped.Token) is string data && data != ".") body.AppendLine(data.StartsWith("..") ? data[1..] : data);
                        LastMessage = body.ToString();
                        await writer.WriteLineAsync("250 queued");
                    }
                    else if (line.StartsWith("QUIT")) { await writer.WriteLineAsync("221 bye"); break; }
                    else await writer.WriteLineAsync("250 OK");
                }
            }
        }
        catch (OperationCanceledException) { }
    }
    public IConfiguration Configuration() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
        ["Smtp:Host"] = "127.0.0.1", ["Smtp:Port"] = Port.ToString(), ["Smtp:Security"] = "None", ["Smtp:FromEmail"] = "support@example.com"
    }).Build();
    public async ValueTask DisposeAsync() { stopped.Cancel(); listener.Stop(); await loop; stopped.Dispose(); }
}

public sealed class PasswordResetSmtpTests
{
    [Fact] public async Task MailKitSendsVietnameseMailWithTheActualCodeOverSmtp()
    {
        await using var smtp = new ResetSmtpServer();
        await new SmtpPasswordResetEmailSender(smtp.Configuration()).SendAsync("customer@example.com", "031527");
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(smtp.LastMessage!));
        var mail = MimeMessage.Load(stream);
        Assert.Equal("customer@example.com", Assert.Single(mail.To.Mailboxes).Address);
        Assert.Contains("031527", mail.TextBody);
        Assert.Contains("10 phút", mail.TextBody);
        Assert.Contains("đặt lại mật khẩu", mail.Subject);
    }
    [Fact] public async Task CodeReceivedOverSmtpResetsTheSameAccountThroughHttp()
    {
        await using var f = await PasswordResetFixture.Create();
        await using var smtp = new ResetSmtpServer();
        var config = new ConfigurationBuilder().AddConfiguration(smtp.Configuration())
            .AddInMemoryCollection(new Dictionary<string, string?> {
                ["PasswordReset:HashKey"] = "password-reset-test-only-hmac-key-more-than-32"
            }).Build();
        await f.WithDb(async db => await new PasswordResetService(db,
            new SmtpPasswordResetEmailSender(config), config, f.Clock).RequestAsync(new("customer@example.com")));
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(smtp.LastMessage!));
        var body = MimeMessage.Load(stream).TextBody;
        Assert.NotNull(body);
        var code = Regex.Match(body, @"\b[0-9]{6}\b").Value;
        Assert.Matches("^[0-9]{6}$", code);
        (await f.Confirm(code)).EnsureSuccessStatusCode();
        Assert.Empty(f.Mailbox.Messages);
    }
    [Fact] public async Task SmtpDisconnectIsReportedAsDeliveryFailure()
    {
        var socket = new TcpListener(IPAddress.Loopback, 0); socket.Start();
        var port = ((IPEndPoint)socket.LocalEndpoint).Port; socket.Stop();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["Smtp:Host"] = "127.0.0.1", ["Smtp:Port"] = port.ToString(), ["Smtp:Security"] = "None", ["Smtp:FromEmail"] = "support@example.com"
        }).Build();
        await Assert.ThrowsAsync<PasswordResetDeliveryException>(() => new SmtpPasswordResetEmailSender(configuration).SendAsync("customer@example.com", "123456"));
    }
}
