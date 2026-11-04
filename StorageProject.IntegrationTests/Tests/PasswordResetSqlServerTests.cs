using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StorageProject.Core.DTOs.Auth;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Services;
using StorageProject.IntegrationTests.Infrastructure;
using Xunit;

namespace StorageProject.IntegrationTests.Tests;

public sealed class PasswordResetSqlServerTests(SqlServerFixture fixture) : IClassFixture<SqlServerFixture>
{
    private sealed class Mailbox : IPasswordResetEmailSender
    {
        public string Code { get; private set; } = "";
        public void ValidateConfiguration() { }
        public Task SendAsync(string email, string code, CancellationToken ct = default) { Code = code; return Task.CompletedTask; }
    }

    [Fact]
    public async Task SqlServer_ConcurrentConfirmUsesCodeExactlyOnceAndPreservesAccount()
    {
        if (!fixture.IsAvailable) return; // CI đặt REQUIRE_SQLSERVER=true để thiếu SQL không bị coi là đạt.
        var mail = new Mailbox();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["PasswordReset:HashKey"] = "sql-server-reset-test-only-hmac-key-at-least-32"
        }).Build();
        string email;
        long id;
        await using (var db = fixture.CreateContext())
        {
            var user = await db.Users.SingleAsync(u => u.Username == "customer01");
            email = user.Email; id = user.UserId;
            await new PasswordResetService(db, mail, config, TimeProvider.System).RequestAsync(new(email));
        }
        async Task<bool> Confirm()
        {
            await using var db = fixture.CreateContext();
            try
            {
                await new PasswordResetService(db, mail, config, TimeProvider.System)
                    .ConfirmAsync(new(email, mail.Code, "NewSqlCustomer@123"));
                return true;
            }
            catch (ArgumentException) { return false; }
        }
        var results = await Task.WhenAll(Confirm(), Confirm());
        Assert.Single(results, success => success);
        await using var verify = fixture.CreateContext();
        var saved = await verify.Users.SingleAsync(u => u.UserId == id);
        Assert.True(BCrypt.Net.BCrypt.Verify("NewSqlCustomer@123", saved.PasswordHash));
        Assert.Equal(email, saved.Email);
        Assert.Equal("ACTIVE", saved.Status);
        Assert.NotNull((await verify.PasswordResetChallenges.SingleAsync(x => x.UserId == id)).UsedAt);
        Assert.NotEmpty(await verify.UserRoles.Where(x => x.UserId == id).ToListAsync());
    }
}
