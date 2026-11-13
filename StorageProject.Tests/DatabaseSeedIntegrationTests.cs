using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// Integration test nạp và xác nhận dữ liệu mẫu (Development Seed) trên SQL Server thật SSFRMS (D55 / #60).
/// Phục vụ cho lệnh /resetdb và kiểm thử phân hệ Quản lý cơ sở, Business Ops.
/// </summary>
public sealed class DatabaseSeedIntegrationTests
{
    [Fact]
    public async Task Seed_SqlServer_SSFRMS()
    {
        var connStr = "Server=.\\SQLEXPRESS;Database=SSFRMS;Trusted_Connection=True;TrustServerCertificate=True;Connection Timeout=2;";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connStr)
            .Options;

        await using var db = new AppDbContext(options);
        try
        {
            if (!await db.Database.CanConnectAsync())
            {
                // Bỏ qua an toàn trên môi trường CI không có SQL Server cục bộ
                return;
            }
        }
        catch
        {
            return;
        }

        await DbSeeder.SeedByModeAsync(db, "Development", "Admin@123");
        await FacilityCoordinateSeeder.SeedAsync(db);

        // Kiểm tra sau khi seed:
        var contractCount = await db.RentalContracts.CountAsync();
        var paymentCount = await db.Payments.CountAsync();
        var occupiedUnits = await db.StorageUnits.CountAsync(u => u.Status == "OCCUPIED");
        var availableUnits = await db.StorageUnits.CountAsync(u => u.Status == "AVAILABLE");

        Assert.True(contractCount >= 40, $"Hợp đồng mẫu phải >= 40, thực tế: {contractCount}");
        Assert.True(paymentCount >= 80, $"Thanh toán mẫu phải >= 80, thực tế: {paymentCount}");
        Assert.True(occupiedUnits >= 40, $"Ô có người thuê phải >= 40, thực tế: {occupiedUnits}");
        Assert.True(availableUnits >= 90, $"Ô còn trống phải >= 90, thực tế: {availableUnits}");
    }
}

