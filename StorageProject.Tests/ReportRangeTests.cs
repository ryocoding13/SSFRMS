using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

// #58 (Lượt 5): bộ lọc từ tháng đến tháng, qua năm được, không cho tháng bắt đầu sau tháng kết thúc.
public sealed class ReportRangeTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
                if (p.GetDefaultValueSql() != null) p.SetDefaultValueSql(null);
        }
    }

    private static async Task<(SqliteConnection, AppDbContext)> OpenAsync()
    {
        var c = new SqliteConnection("Data Source=:memory:");
        await c.OpenAsync();
        var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(c).Options);
        await db.Database.EnsureCreatedAsync();
        return (c, db);
    }

    [Theory]
    [InlineData(2026, 1, 2026, 11, 11)]
    [InlineData(2026, 11, 2027, 2, 4)]
    [InlineData(2026, 5, 2026, 5, 1)]
    [InlineData(2026, 12, 2026, 2, -9)]
    public void Month_count_spans_years(int y1, int m1, int y2, int m2, int expected) =>
        Assert.Equal(expected, OperationsReportService.MonthCount(new DateOnly(y1, m1, 1), new DateOnly(y2, m2, 1)));

    [Fact]
    public async Task Range_across_year_returns_each_month_in_order()
    {
        var (c, db) = await OpenAsync();
        await using var _ = c; await using var __ = db;
        var r = await new OperationsReportService(db).GetRevenueTrendRangeAsync(new DateOnly(2026, 11, 15), new DateOnly(2027, 2, 3), null, null);
        Assert.Equal(["11/2026", "12/2026", "1/2027", "2/2027"], r.Months.Select(m => $"{m.Month}/{m.Year}").ToArray());
        Assert.All(r.Months, m => Assert.Equal(0m, m.RentalAndFeeRevenue));
    }

    [Fact]
    public async Task Start_after_end_or_over_24_months_is_rejected()
    {
        var (c, db) = await OpenAsync();
        await using var _ = c; await using var __ = db;
        var svc = new OperationsReportService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.GetRevenueTrendRangeAsync(new DateOnly(2026, 12, 1), new DateOnly(2026, 2, 1), null, null));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.GetRevenueTrendRangeAsync(new DateOnly(2024, 1, 1), new DateOnly(2026, 2, 1), null, null));
    }
}
