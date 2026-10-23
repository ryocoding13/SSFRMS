using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using Xunit;

namespace StorageProject.IntegrationTests.Infrastructure;

public sealed class SqlServerFixture : IAsyncLifetime
{
    private readonly string _databaseName = $"SSFRMS_CI_{Guid.NewGuid():N}";
    private string _masterConnectionString = string.Empty;
    public string ConnectionString { get; private set; } = string.Empty;
    public bool IsAvailable { get; private set; }
    public string SkipReason { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var envConn = Environment.GetEnvironmentVariable("SSFRMS_TEST_CONNECTION_STRING")
                      ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

        var requireSqlServer = string.Equals(
            Environment.GetEnvironmentVariable("REQUIRE_SQLSERVER"), "true", StringComparison.OrdinalIgnoreCase);

        // Chuỗi kết nối master mặc định để tạo database tạm
        if (!string.IsNullOrWhiteSpace(envConn))
        {
            var builder = new SqlConnectionStringBuilder(envConn);
            builder.InitialCatalog = "master";
            _masterConnectionString = builder.ConnectionString;
        }
        else
        {
            _masterConnectionString = "Server=.\\SQLEXPRESS;Database=master;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=5";
        }

        try
        {
            await using var masterConn = new SqlConnection(_masterConnectionString);
            await masterConn.OpenAsync();

            // Tạo database riêng biệt cho lần chạy test này
            await using (var cmd = masterConn.CreateCommand())
            {
                cmd.CommandText = $"CREATE DATABASE [{_databaseName}]";
                await cmd.ExecuteNonQueryAsync();
            }

            var testDbBuilder = new SqlConnectionStringBuilder(_masterConnectionString)
            {
                InitialCatalog = _databaseName
            };
            ConnectionString = testDbBuilder.ConnectionString;

            // Chạy EF Core Migration đầy đủ 6 migrations trên database rỗng
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(ConnectionString)
                .Options;

            await using (var context = new AppDbContext(options))
            {
                await context.Database.MigrateAsync();

                // Seed dữ liệu chuẩn tham chiếu & tài khoản 5 nhóm người dùng
                await DbSeeder.SeedByModeAsync(context, "Development", "Admin@123");
            }

            IsAvailable = true;
        }
        catch (Exception ex)
        {
            IsAvailable = false;
            SkipReason = $"SQL Server unavailable: {ex.Message}";

            if (requireSqlServer)
            {
                throw new InvalidOperationException($"REQUIRE_SQLSERVER is true but cannot connect to SQL Server: {ex.Message}", ex);
            }
        }
    }

    public async Task DisposeAsync()
    {
        if (!IsAvailable || string.IsNullOrEmpty(_masterConnectionString))
        {
            return;
        }

        try
        {
            await using var masterConn = new SqlConnection(_masterConnectionString);
            await masterConn.OpenAsync();

            // Force drop database test
            await using var cmd = masterConn.CreateCommand();
            cmd.CommandText = $@"
                IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '{_databaseName}')
                BEGIN
                    ALTER DATABASE [{_databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE [{_databaseName}];
                END";
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Tránh throw exception trong Dispose
        }
    }

    public AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;
        return new AppDbContext(options);
    }
}
