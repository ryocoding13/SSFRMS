using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using StorageProject.Api.Endpoints;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Context
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// 2. JWT Authentication & Authorization
var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? "CHANGE_ME_TO_A_SECURE_256BIT_KEY_AT_LEAST_32_CHARS_LONG!!";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "SSFRMSApi";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "SSFRMSClients";

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

// 3. Swagger / OpenAPI Configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SSFRMS Customer API",
        Version = "v1",
        Description = "Self-Storage Facility Rental Management System - Customer Scope API"
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

// 4. CORS Policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
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

var app = builder.Build();

// 6. Middleware Pipeline
app.UseHttpsRedirection();
app.UseCors("AllowAll");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "SSFRMS Customer API v1");
        c.RoutePrefix = string.Empty; // Swagger UI at root
    });
}

app.UseAuthentication();
app.UseAuthorization();

// 7. Map Minimal API Endpoints (Customer Scoped)
app.MapAuthEndpoints();
app.MapFacilityEndpoints();
app.MapReservationEndpoints();
app.MapContractEndpoints();
app.MapPaymentEndpoints();
app.MapRenewalEndpoints();
app.MapSupportTicketEndpoints();

// Root status check
app.MapGet("/health", () => Results.Ok(new
{
    System = "SSFRMS API (Self-Storage Facility Rental Management System)",
    Status = "Healthy",
    Timestamp = DateTime.UtcNow
}));

// 8. Auto-Seed Initial Database Data
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbSeeder.SeedAsync(context);
}

app.Run();
