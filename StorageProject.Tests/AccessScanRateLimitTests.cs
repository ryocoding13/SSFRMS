using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Access;
using StorageProject.Core.Entities;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class AccessScanRateLimitTests
{
    private static DbContextOptions<AppDbContext> CreateInMemoryDbOptions(string dbName) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"DataSource=file:{dbName}?mode=memory&cache=shared")
            .Options;

    [Fact]
    public void RateLimiter_Allows10Attempts_AndRejects11thWithinWindow()
    {
        var limiter = new DefaultScanRateLimiter(permitLimit: 10, window: TimeSpan.FromMinutes(1));
        const string ip = "192.168.10.1";

        for (var i = 0; i < 10; i++)
        {
            Assert.True(limiter.TryAcquire(ip), $"Attempt {i + 1} should be permitted.");
        }

        Assert.False(limiter.TryAcquire(ip), "11th attempt within 1 minute should be rejected.");
    }

    [Fact]
    public void RateLimiter_ResetsWindow_After60Seconds()
    {
        var limiter = new DefaultScanRateLimiter(permitLimit: 10, window: TimeSpan.FromMinutes(1));
        const string ip = "192.168.10.2";
        var t0 = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);

        for (var i = 0; i < 10; i++)
        {
            Assert.True(limiter.TryAcquire(ip, t0));
        }

        // At 30s: still rejected
        Assert.False(limiter.TryAcquire(ip, t0.AddSeconds(30)));

        // At 61s: first attempts have rolled out of the 60s sliding window
        Assert.True(limiter.TryAcquire(ip, t0.AddSeconds(61)), "After 61 seconds, request should be allowed.");
    }

    [Fact]
    public void RateLimiter_TracksDifferentIPsIndependently()
    {
        var limiter = new DefaultScanRateLimiter(permitLimit: 10, window: TimeSpan.FromMinutes(1));
        const string ip1 = "10.0.0.1";
        const string ip2 = "10.0.0.2";

        for (var i = 0; i < 10; i++)
        {
            Assert.True(limiter.TryAcquire(ip1));
        }

        Assert.False(limiter.TryAcquire(ip1));
        Assert.True(limiter.TryAcquire(ip2), "Independent IP should not be blocked.");
    }

    [Fact]
    public async Task AccessService_Rejects11thScan_WithExactStandardReasonAndLogsActivity()
    {
        var dbName = $"ratelimit_test_{Guid.NewGuid():N}";
        var options = CreateInMemoryDbOptions(dbName);
        await using var db = new AppDbContext(options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();

        var limiter = new DefaultScanRateLimiter(permitLimit: 10, window: TimeSpan.FromMinutes(1));
        var qrOptions = new AccessQrOptions("test-access-secret-at-least-thirty-two-characters");
        var service = new AccessService(db, qrOptions, limiter);

        const string clientIp = "172.16.0.99";

        // Perform 10 scans (invalid code)
        for (var i = 0; i < 10; i++)
        {
            var res = await service.ScanAsync("INVALID_CODE", clientIp);
            Assert.Equal("DENIED", res.Result);
            Assert.Contains("Mã không đúng", res.Reason);
        }

        // 11th scan must be blocked by rate limiter
        var blockedRes = await service.ScanAsync("INVALID_CODE", clientIp);
        Assert.Equal("DENIED", blockedRes.Result);
        Assert.Equal("Tạm dừng quét, thử lại sau 60 giây", blockedRes.Reason);

        // Verify ActivityLogs contains the rate limit denial
        var logs = await db.ActivityLogs.Where(l => l.IpAddress == clientIp).ToListAsync();
        Assert.Equal(11, logs.Count);

        var rateLimitLog = logs.Last();
        Assert.Equal("ACCESS_SCANNED", rateLimitLog.Action);
        Assert.Equal("CONTRACT", rateLimitLog.EntityType);
        Assert.Null(rateLimitLog.EntityId);
        Assert.NotNull(rateLimitLog.NewValue);

        using var doc = JsonDocument.Parse(rateLimitLog.NewValue);
        Assert.Equal("DENIED", doc.RootElement.GetProperty("result").GetString());
        Assert.Equal("Tạm dừng quét, thử lại sau 60 giây", doc.RootElement.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task AccessService_HonorsInjectedLimiter_WhenPreBlocked()
    {
        var dbName = $"ratelimit_mock_{Guid.NewGuid():N}";
        var options = CreateInMemoryDbOptions(dbName);
        await using var db = new AppDbContext(options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();

        // Limiter that always blocks
        var blockingLimiter = new AlwaysBlockingLimiter();
        var qrOptions = new AccessQrOptions("test-access-secret-at-least-thirty-two-characters");
        var service = new AccessService(db, qrOptions, blockingLimiter);

        var result = await service.ScanAsync("ANY_CODE", "192.168.1.1");
        Assert.Equal("DENIED", result.Result);
        Assert.Equal("Tạm dừng quét, thử lại sau 60 giây", result.Reason);
    }

    private sealed class AlwaysBlockingLimiter : IScanRateLimiter
    {
        public bool TryAcquire(string clientIp, DateTime? now = null) => false;
        public void Reset() { }
    }
}
