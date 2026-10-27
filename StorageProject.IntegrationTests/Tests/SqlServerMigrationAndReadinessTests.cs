using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.IntegrationTests.Infrastructure;
using Xunit;

namespace StorageProject.IntegrationTests.Tests;

public sealed class SqlServerMigrationAndReadinessTests(SqlServerFixture fixture) : IClassFixture<SqlServerFixture>
{
    private static readonly string[] ExpectedMigrations =
    [
        "20260915124041_InitialCreate",
        "20260930094512_AddPayOSFieldsToReservation",
        "20261014150000_ReservationPendingVerification",
        "20261014152714_MakeUnitAssignmentAssignedByNullable",
        "20261015153130_AddFacilityCoordinates",
        "20261020154838_ReservationPaymentIntegrity",
        "20261026093424_AddDepositPercentPerDayCalculationType"
    ];

    [Fact]
    public async Task SqlServer_AppliesAllMigrations_AndHasNoPendingModelChanges()
    {
        if (!fixture.IsAvailable)
        {
            return; // Skip if SQL Server is not running in local dev
        }

        await using var db = fixture.CreateContext();

        // 1. Kiểm tra danh sách migrations đã áp dụng
        var appliedMigrations = (await db.Database.GetAppliedMigrationsAsync()).ToList();

        Assert.Equal(ExpectedMigrations.Length, appliedMigrations.Count);
        for (var i = 0; i < ExpectedMigrations.Length; i++)
        {
            Assert.Equal(ExpectedMigrations[i], appliedMigrations[i]);
        }

        // 2. Chốt ID migration cuối cùng
        Assert.Equal(ExpectedMigrations.Last(), appliedMigrations.Last());

        // 3. Không có migration nào còn chờ
        var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
        Assert.Empty(pendingMigrations);

        // 4. Model Drift Check: Đảm bảo model code khớp 100% snapshot migration
        Assert.False(db.Database.HasPendingModelChanges(), "Phát hiện model drift! Cần thêm migration mới thay vì sửa model mà không migrate.");
    }

    [Fact]
    public async Task LivenessEndpoint_Returns200AndHealthy()
    {
        if (!fixture.IsAvailable) return;

        using var factory = new CustomWebApplicationFactory(fixture);
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(doc);
        Assert.Equal("Healthy", doc.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task ReadinessEndpoint_Returns200AndReady_WhenDatabaseIsHealthy()
    {
        if (!fixture.IsAvailable) return;

        using var factory = new CustomWebApplicationFactory(fixture);
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(doc);
        Assert.Equal("Ready", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("Connected", doc.RootElement.GetProperty("database").GetString());
    }
}
