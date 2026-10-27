using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using System.Text;
using Microsoft.AspNetCore.HttpOverrides;
using StorageProject.Api.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using StorageProject.Api.Endpoints;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Context & Validation
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
}
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// 2. JWT Authentication & Authorization with Environment Validation
var jwtSecret = builder.Configuration["JwtSettings:Secret"];
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "SSFRMSApi";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "SSFRMSClients";

const string defaultDevSecret = "CHANGE_ME_TO_A_SECURE_256BIT_KEY_AT_LEAST_32_CHARS_LONG!!";
string[] weakPlaceholders = [
    defaultDevSecret,
    "YOUR_JWT_SECRET",
    "CHANGE_ME",
    "secret",
    "12345678901234567890123456789012"
];

if (string.IsNullOrWhiteSpace(jwtSecret) ||
    weakPlaceholders.Any(p => string.Equals(jwtSecret.Trim(), p, StringComparison.OrdinalIgnoreCase)) ||
    jwtSecret.Length < 32)
{
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "JwtSettings:Secret is not securely configured. In Staging/Production environments, a strong secret key of at least 32 characters (256-bit) must be provided via environment variables or secret configuration, and cannot be a default placeholder.");
    }
    jwtSecret = defaultDevSecret;
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("access-scan", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// 3. Swagger / OpenAPI Configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SSFRMS Customer API",
        Version = "v1",
        Description = "Self-Storage Facility Rental Management System - Customer, Admin & Business Operations API"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer {token}'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer"),
            new List<string>()
        }
    });
});

// 4. Reverse Proxy Forwarded Headers & CORS Configuration
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();

    // Trust loopback and private/container network ranges (RFC 1918)
    options.KnownIPNetworks.Add(new System.Net.IPNetwork(System.Net.IPAddress.Loopback, 8));
    options.KnownIPNetworks.Add(new System.Net.IPNetwork(System.Net.IPAddress.IPv6Loopback, 128));
    options.KnownIPNetworks.Add(new System.Net.IPNetwork(System.Net.IPAddress.Parse("10.0.0.0"), 8));
    options.KnownIPNetworks.Add(new System.Net.IPNetwork(System.Net.IPAddress.Parse("172.16.0.0"), 12));
    options.KnownIPNetworks.Add(new System.Net.IPNetwork(System.Net.IPAddress.Parse("192.168.0.0"), 16));
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        else if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            // Same-origin only: in Staging/Production without explicit cross-origins, do not allow arbitrary origins
            policy.AllowAnyHeader()
                  .AllowAnyMethod();
        }
    });
});

// 5. Dependency Injection - Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IFacilityService, FacilityService>();
builder.Services.AddScoped<IReservationService, ReservationService>();
builder.Services.AddScoped<IContractService, ContractService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IRenewalService, RenewalService>();
builder.Services.AddScoped<ISupportTicketService, SupportTicketService>();
builder.Services.AddScoped<IHandoverService, HandoverService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IOperationsService, OperationsService>();
builder.Services.AddScoped<IOperationsReportService, OperationsReportService>();
builder.Services.AddScoped<IFacilityOpsService, FacilityOpsService>();
builder.Services.AddScoped<IPayOSGateway, SdkPayOSGateway>();
builder.Services.AddScoped<IRentalPolicyService, RentalPolicyService>();
if (builder.Configuration.GetValue<bool>("Worker:EnableExpiredCashHold", true))
{
    builder.Services.AddHostedService<ExpiredCashHoldWorker>();
}
builder.Services.AddHostedService<ExpiredRenewalWorker>();
builder.Services.AddScoped<IPayOSService, PayOSService>();
builder.Services.AddSingleton(new AccessQrOptions(
    builder.Configuration["AccessQr:Secret"] ?? jwtSecret,
    !bool.TryParse(builder.Configuration["AccessQr:DenyOverdue"], out var denyOverdue) || denyOverdue));
builder.Services.AddScoped<IAccessService, AccessService>();
builder.Services.AddScoped<IStaffService, StaffService>();
builder.Services.AddScoped<IManagerService, ManagerService>();

var app = builder.Build();

// Handle explicit command line bootstrap before starting web server & background workers
if (args.Contains("--seed-reference") || args.Contains("--seed-staging") || args.Contains("--bootstrap"))
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var adminPass = builder.Configuration["ADMIN_INITIAL_PASSWORD"] ?? builder.Configuration["AdminPassword"];

    if (args.Contains("--seed-reference") || args.Contains("--bootstrap"))
    {
        await DbSeeder.SeedReferenceAsync(context, adminPass);
    }
    else if (args.Contains("--seed-staging"))
    {
        await DbSeeder.SeedStagingAsync(context);
    }
    return;
}

// 6. Middleware Pipeline
app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseCors("DefaultCorsPolicy");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "SSFRMS API v1 (Customer & Admin)");
        c.RoutePrefix = string.Empty; // Swagger UI at root
    });
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// 7. Map Minimal API Endpoints
app.MapAuthEndpoints();
app.MapFacilityEndpoints();
app.MapReservationEndpoints();
app.MapContractEndpoints();
app.MapPaymentEndpoints();
app.MapRenewalEndpoints();
app.MapCounterRenewalEndpoints();
app.MapRentalPolicyEndpoints();
app.MapSupportTicketEndpoints();
app.MapAdminEndpoints();
app.MapOperationsEndpoints();
app.MapFacilityOpsEndpoints();
app.MapStaffEndpoints();
app.MapManagerEndpoints();
app.MapAccessEndpoints();

// 8. Health & Readiness Endpoints
// Liveness endpoint (lightweight check, no external DB dependencies)
app.MapGet("/health", () => Results.Ok(new
{
    System = "SSFRMS API (Self-Storage Facility Rental Management System)",
    Status = "Healthy",
    Timestamp = DateTime.UtcNow
}));

// Readiness endpoint (verifies SQL Server connectivity and applied migrations)
app.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
{
    try
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(3));

        var canConnect = await db.Database.CanConnectAsync(cts.Token);
        if (!canConnect)
        {
            return Results.Json(new
            {
                Status = "Unhealthy",
                Reason = "Database connection unavailable",
                Timestamp = DateTime.UtcNow
            }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var pending = await db.Database.GetPendingMigrationsAsync(cts.Token);
        if (pending.Any())
        {
            return Results.Json(new
            {
                Status = "Unhealthy",
                Reason = "Database has pending migrations",
                Timestamp = DateTime.UtcNow
            }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Results.Ok(new
        {
            Status = "Ready",
            Database = "Connected",
            Timestamp = DateTime.UtcNow
        });
    }
    catch (Exception)
    {
        return Results.Json(new
        {
            Status = "Unhealthy",
            Reason = "Database readiness check failed",
            Timestamp = DateTime.UtcNow
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// 9. Database Auto-Migration and Seeding based on Environment & Configuration
var autoMigrate = builder.Configuration.GetValue<bool>("Database:AutoMigrate", app.Environment.IsDevelopment());
var seedMode = builder.Configuration.GetValue<string>("Database:SeedMode")
    ?? (app.Environment.IsDevelopment() ? "Development" : "None");

if (autoMigrate || !string.Equals(seedMode, "None", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (autoMigrate)
    {
        await context.Database.MigrateAsync();
    }

    if (!string.Equals(seedMode, "None", StringComparison.OrdinalIgnoreCase))
    {
        var adminPass = builder.Configuration["ADMIN_INITIAL_PASSWORD"] ?? builder.Configuration["AdminPassword"];
        await DbSeeder.SeedByModeAsync(context, seedMode, adminPass);
    }
}

app.Run();

public partial class Program { }
