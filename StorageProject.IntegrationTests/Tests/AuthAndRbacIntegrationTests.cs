using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using StorageProject.Core.DTOs.Auth;
using StorageProject.IntegrationTests.Infrastructure;
using Xunit;

namespace StorageProject.IntegrationTests.Tests;

public sealed class AuthAndRbacIntegrationTests(SqlServerFixture fixture) : IClassFixture<SqlServerFixture>
{
    private static readonly (string Username, string Password, string ExpectedRole)[] TestAccounts =
    [
        ("customer01", "Customer@123", "CUSTOMER"),
        ("staff01", "Staff@123", "STAFF"),
        ("manager01", "Manager@123", "MANAGER"),
        ("ops01", "Ops@123", "OPERATIONS"),
        ("admin", "Admin@123", "ADMIN")
    ];

    private async Task<string> LoginAsync(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(username, password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var loginResult = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginResult);
        Assert.False(string.IsNullOrWhiteSpace(loginResult.Token));
        return loginResult.Token;
    }

    [Fact]
    public async Task AllFiveRoles_CanLoginSuccessfully_AndReceiveValidTokens()
    {
        if (!fixture.IsAvailable) return;

        using var factory = new CustomWebApplicationFactory(fixture);
        var client = factory.CreateClient();

        foreach (var (username, password, _) in TestAccounts)
        {
            var token = await LoginAsync(client, username, password);
            Assert.NotEmpty(token);
        }
    }

    [Fact]
    public async Task ProtectedEndpoints_Return401_WhenNoTokenIsProvided()
    {
        if (!fixture.IsAvailable) return;

        using var factory = new CustomWebApplicationFactory(fixture);
        var client = factory.CreateClient();

        // 1. Endpoint Profile
        var profileResp = await client.GetAsync("/api/auth/profile");
        Assert.Equal(HttpStatusCode.Unauthorized, profileResp.StatusCode);

        // 2. Endpoint Facility Operations Board
        var opsBoardResp = await client.GetAsync("/api/ops/board");
        Assert.Equal(HttpStatusCode.Unauthorized, opsBoardResp.StatusCode);

        // 3. Endpoint Business Operations Facilities
        var businessResp = await client.GetAsync("/api/operations/facilities");
        Assert.Equal(HttpStatusCode.Unauthorized, businessResp.StatusCode);
    }

    [Fact]
    public async Task RoleAuthorization_Returns403_WhenRoleIsForbidden()
    {
        if (!fixture.IsAvailable) return;

        using var factory = new CustomWebApplicationFactory(fixture);
        var client = factory.CreateClient();

        // Đăng nhập tài khoản customer01
        var customerToken = await LoginAsync(client, "customer01", "Customer@123");
        var customerClient = factory.CreateClient();
        customerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", customerToken);

        // Customer không được truy cập endpoint của Staff/Manager (/api/ops/board)
        var forbiddenCustomerResp = await customerClient.GetAsync("/api/ops/board");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenCustomerResp.StatusCode);

        // Đăng nhập tài khoản staff01
        var staffToken = await LoginAsync(client, "staff01", "Staff@123");
        var staffClient = factory.CreateClient();
        staffClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);

        // Staff không được truy cập endpoint của Quản lý vận hành kinh doanh (/api/operations/facilities)
        var staffForbiddenResp = await staffClient.GetAsync("/api/operations/facilities");
        Assert.Equal(HttpStatusCode.Forbidden, staffForbiddenResp.StatusCode);
    }

    [Fact]
    public async Task CatalogEndpoints_ReturnRealData_FromSqlServer()
    {
        if (!fixture.IsAvailable) return;

        using var factory = new CustomWebApplicationFactory(fixture);
        var client = factory.CreateClient();

        // 1. Kiểm tra /api/facilities
        var facilitiesResp = await client.GetAsync("/api/facilities");
        Assert.Equal(HttpStatusCode.OK, facilitiesResp.StatusCode);

        var facilities = await facilitiesResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, facilities.ValueKind);
        Assert.True(facilities.GetArrayLength() > 0, "Dữ liệu facilities phải được lấy từ SQL Server thật.");

        // 2. Kiểm tra /api/unit-types
        var unitTypesResp = await client.GetAsync("/api/unit-types");
        Assert.Equal(HttpStatusCode.OK, unitTypesResp.StatusCode);

        var unitTypes = await unitTypesResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, unitTypes.ValueKind);
        Assert.True(unitTypes.GetArrayLength() > 0, "Dữ liệu unit-types phải được lấy từ SQL Server thật.");
    }
}
