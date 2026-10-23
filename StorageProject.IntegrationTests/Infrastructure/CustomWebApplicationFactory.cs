using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StorageProject.Infrastructure.Services;

namespace StorageProject.IntegrationTests.Infrastructure;

public sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string TestJwtSecret = "SafeSpaceSecureIntegrationTestingKey_2026_AtLeast32Chars!!";
    private readonly SqlServerFixture _fixture;
    public FakePayOSGateway FakeGateway { get; } = new();

    public CustomWebApplicationFactory(SqlServerFixture fixture)
    {
        _fixture = fixture;
        Environment.SetEnvironmentVariable("JwtSettings__Secret", TestJwtSecret);
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _fixture.ConnectionString);
        Environment.SetEnvironmentVariable("Database__AutoMigrate", "false");
        Environment.SetEnvironmentVariable("Database__SeedMode", "None");
        Environment.SetEnvironmentVariable("Worker__EnableExpiredCashHold", "false");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            var testConfigs = new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _fixture.ConnectionString,
                ["Database:AutoMigrate"] = "false",
                ["Database:SeedMode"] = "None",
                ["Worker:EnableExpiredCashHold"] = "false",
                ["JwtSettings:Secret"] = TestJwtSecret,
                ["AppSettings:FrontendUrl"] = "https://safespace.vn"
            };

            config.AddInMemoryCollection(testConfigs);
        });

        builder.ConfigureServices(services =>
        {
            // Thay thế IPayOSGateway bằng FakePayOSGateway
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IPayOSGateway));
            if (descriptor != null)
            {
                services.Remove(descriptor);
            }
            services.AddSingleton<IPayOSGateway>(FakeGateway);
        });
    }
}
