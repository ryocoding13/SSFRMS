using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using StorageProject.Api.Endpoints;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

// Kestrel + JWT + endpoint/service thật; SQLite file riêng, không chạm SQL Server của nhóm.
public sealed class AuthSupportHttpFixture : IAsyncDisposable
{
    public sealed class TestDb(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
                if (p.GetDefaultValueSql() != null) p.SetDefaultValueSql(null);
        }
    }
    private readonly string database = Path.Combine(Path.GetTempPath(), $"safespace-auth-{Guid.NewGuid():N}.db");
    private WebApplication app = null!;
    public string Address { get; private set; } = "";
    public long ContractId { get; private set; }
    public static async Task<AuthSupportHttpFixture> Create()
    {
        var f = new AuthSupportHttpFixture();
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        const string secret = "test-only-key-for-auth-support-http-at-least-32-characters";
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> {
            ["JwtSettings:Secret"] = secret, ["JwtSettings:Issuer"] = "SSFRMSApi", ["JwtSettings:Audience"] = "SSFRMSClients"
        });
        builder.Services.AddScoped<AppDbContext>(_ => new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={f.database}").Options));
        builder.Services.AddScoped<IAuthService, AuthService>();
        builder.Services.AddScoped<ISupportTicketService, SupportTicketService>();
        builder.Services.AddScoped<IStaffService, StaffService>();
        builder.Services.AddScoped<IFacilityOpsService, FacilityOpsService>();
        builder.Services.AddScoped<IFacilityService, FacilityService>();
        builder.Services.AddScoped<IContractService, ContractService>();
        builder.Services.AddScoped<IHandoverService, HandoverService>();
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => {
            o.TokenValidationParameters = new TokenValidationParameters {
                ValidateIssuer = true, ValidIssuer = "SSFRMSApi", ValidateAudience = true, ValidAudience = "SSFRMSClients",
                ValidateLifetime = true, ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret))
            };
        });
        builder.Services.AddAuthorization();
        builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));
        f.app = builder.Build();
        f.app.UseCors(); f.app.UseAuthentication(); f.app.UseAuthorization();
        f.app.MapAuthEndpoints(); f.app.MapSupportTicketEndpoints(); f.app.MapStaffEndpoints();
        f.app.MapFacilityOpsEndpoints(); f.app.MapFacilityEndpoints(); f.app.MapContractEndpoints();
        // C12/C13 không thao tác đặt chỗ. Danh sách trống chỉ dùng để khởi động app trong browser test.
        f.app.MapGet("/api/reservations", () => Array.Empty<object>()).RequireAuthorization();
        f.app.MapGet("/__auth-support-test", () => new { testOnly = true });
        await f.Seed();
        await f.app.StartAsync();
        f.Address = f.app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        return f;
    }
    private async Task Seed()
    {
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        var day = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var customerRole = new Role { RoleName = "CUSTOMER" }; var staffRole = new Role { RoleName = "STAFF" };
        User Make(string username, string role) => new() { Username = username, Email = $"{username}@example.com", FullName = username,
            Phone = "0901234567", PasswordHash = BCrypt.Net.BCrypt.HashPassword(role == "STAFF" ? "Staff@123" : "Customer@123", 4), Status = "ACTIVE", CreatedAt = DateTime.UtcNow };
        var customer = Make("customer01", "CUSTOMER"); var other = Make("customer02", "CUSTOMER");
        var staff = Make("staff01", "STAFF"); var wrongStaff = Make("staff02", "STAFF");
        var facility = new Facility { Name = "SafeSpace A", Address = "Quận 7, TP. Hồ Chí Minh", Status = "ACTIVE" };
        var otherFacility = new Facility { Name = "SafeSpace B", Address = "Quận 1, TP. Hồ Chí Minh", Status = "ACTIVE" };
        var type = new UnitType { TypeName = "Kho thường M", Area = 15, Status = "ACTIVE" };
        db.AddRange(customerRole, staffRole, customer, other, staff, wrongStaff, facility, otherFacility, type); await db.SaveChangesAsync();
        foreach (var u in new[] { customer, other, staff, wrongStaff }) db.Add(new UserRole { UserId = u.UserId, RoleId = u.Username.StartsWith("staff") ? staffRole.RoleId : customerRole.RoleId, AssignedAt = DateTime.UtcNow });
        db.AddRange(new UserFacility { UserId = staff.UserId, FacilityId = facility.FacilityId, AssignedBy = staff.UserId, AssignedFrom = day.AddDays(-1), Status = "ACTIVE" },
            new UserFacility { UserId = wrongStaff.UserId, FacilityId = otherFacility.FacilityId, AssignedBy = wrongStaff.UserId, AssignedFrom = day.AddDays(-1), Status = "ACTIVE" });
        var unit = new StorageUnit { UnitNumber = "K01", FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId, Status = "OCCUPIED" };
        var order = new Reservation { CustomerId = customer.UserId, FacilityId = facility.FacilityId, UnitTypeId = type.UnitTypeId,
            StartDate = day.AddDays(-10), ExpectedEndDate = day.AddMonths(1), RentalPeriodMonths = 1, EstimatedAmount = 1000000, RequiredDeposit = 1000000,
            QuotedMonthlyRate = 1000000, Status = "CHECKED_IN", CreatedAt = DateTime.UtcNow };
        db.AddRange(unit, order); await db.SaveChangesAsync();
        var contract = new RentalContract { ReservationId = order.ReservationId, CustomerId = customer.UserId, UnitId = unit.UnitId,
            StartDate = order.StartDate, EndDate = order.ExpectedEndDate, AgreedMonthlyRate = 1000000, DepositAmount = 1000000, Status = "ACTIVE", CreatedAt = DateTime.UtcNow };
        db.Add(contract); await db.SaveChangesAsync(); ContractId = contract.ContractId;
    }
    public HttpClient Client(string? token = null)
    {
        var client = new HttpClient { BaseAddress = new Uri(Address) };
        if (token != null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
    public async Task<string> Login(string username, string password)
    {
        using var c = Client(); var response = await c.PostAsJsonAsync("/api/auth/login", new { username, password });
        response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }
    public async ValueTask DisposeAsync()
    {
        await app.StopAsync(); await app.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-shm", "-wal" }) if (File.Exists(database + suffix)) File.Delete(database + suffix);
    }
}

public sealed class AuthSupportHttpTests
{
    [Fact] public async Task ProfileAndPasswordWorkThroughJwtHttpAndPersistAfterLogin()
    {
        await using var f = await AuthSupportHttpFixture.Create();
        using var anonymous = f.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/auth/profile")).StatusCode);
        using var customer = f.Client(await f.Login("customer01", "Customer@123"));
        using var other = f.Client(await f.Login("customer02", "Customer@123"));
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PutAsJsonAsync("/api/auth/profile", new { fullName = " " })).StatusCode);
        (await customer.PutAsJsonAsync("/api/auth/profile", new { fullName = "  Gia Thắng mới  " })).EnsureSuccessStatusCode();
        var profile = await customer.GetFromJsonAsync<JsonElement>("/api/auth/profile");
        Assert.Equal("Gia Thắng mới", profile.GetProperty("fullName").GetString());
        Assert.Equal("0901234567", profile.GetProperty("phone").GetString());
        Assert.Equal("customer02", (await other.GetFromJsonAsync<JsonElement>("/api/auth/profile")).GetProperty("fullName").GetString());
        var wrong = await customer.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "Wrong@123", newPassword = "NewPass@123" });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("BAD_PASSWORD", (await wrong.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        (await customer.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "Customer@123", newPassword = "NewPass@123" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/login", new { username = "customer01", password = "Customer@123" })).StatusCode);
        using var relogged = f.Client(await f.Login("customer01", "NewPass@123"));
        Assert.Equal("Gia Thắng mới", (await relogged.GetFromJsonAsync<JsonElement>("/api/auth/profile")).GetProperty("fullName").GetString());
    }

    [Fact] public async Task CustomerTicketStaffResponseAndReloadUseRealHttpWithOwnershipChecks()
    {
        await using var f = await AuthSupportHttpFixture.Create();
        using var customer = f.Client(await f.Login("customer01", "Customer@123"));
        using var other = f.Client(await f.Login("customer02", "Customer@123"));
        using var staff = f.Client(await f.Login("staff01", "Staff@123"));
        using var wrongStaff = f.Client(await f.Login("staff02", "Staff@123"));
        var create = await customer.PostAsJsonAsync("/api/tickets", new { contractId = f.ContractId, issueType = "LOCK", title = "Khóa bị kẹt", description = "Không mở được khóa", priority = "HIGH" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var id = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ticketId").GetInt64();
        var board = await staff.GetFromJsonAsync<JsonElement>("/api/ops/board");
        Assert.Single(board.GetProperty("tickets").EnumerateArray());
        Assert.Empty((await wrongStaff.GetFromJsonAsync<JsonElement>("/api/ops/board")).GetProperty("tickets").EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/tickets/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await wrongStaff.PostAsJsonAsync($"/api/ops/tickets/HT-{id:D4}/responses", new { note = "Không được sửa", nextStatus = "IN_PROGRESS" })).StatusCode);
        (await staff.PostAsJsonAsync($"/api/ops/tickets/HT-{id:D4}/responses", new { note = "Đã tiếp nhận", nextStatus = "IN_PROGRESS" })).EnsureSuccessStatusCode();
        (await staff.PostAsJsonAsync($"/api/staff/tickets/HT-{id:D4}/responses", new { note = "Đã thay khóa", nextStatus = "DONE" })).EnsureSuccessStatusCode();
        using var reload = f.Client(await f.Login("customer01", "Customer@123"));
        var detail = await reload.GetFromJsonAsync<JsonElement>($"/api/tickets/{id}");
        Assert.Equal(new[] { "Đã tiếp nhận", "Đã thay khóa" }, detail.GetProperty("responses").EnumerateArray().Select(x => x.GetProperty("message").GetString()));
        Assert.All(detail.GetProperty("responses").EnumerateArray(), r => Assert.Equal("staff01", r.GetProperty("staffName").GetString()));
    }
}
