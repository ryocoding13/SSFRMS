using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class RentalPolicyW3Tests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
            {
                if (p.GetDefaultValueSql() != null) p.SetDefaultValueSql(null);
            }
        }
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User AdminUser = null!;

        public async Task InitAsync()
        {
            await Connection.OpenAsync();
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(Connection)
                .Options;

            Db = new TestDb(options);
            await Db.Database.EnsureCreatedAsync();

            AdminUser = new User
            {
                Username = "admin",
                Email = "admin@storage.vn",
                PasswordHash = "hash",
                FullName = "Admin System",
                Status = "ACTIVE"
            };
            Db.Users.Add(AdminUser);
            await Db.SaveChangesAsync();
        }

        public ValueTask DisposeAsync()
        {
            Db.Dispose();
            Connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private static Dictionary<string, string> ValidSections() => new()
    {
        ["payment"] = "Thanh toán theo hợp đồng.",
        ["access"] = "Mã QR ra vào theo kỳ thuê.",
        ["renewal"] = "Gia hạn trước hạn.",
        ["overdue"] = "Quá hạn 5% mỗi ngày.",
        ["return"] = "Trả kho chuyển hết đồ.",
        ["cancellation"] = "Hủy đơn trước ngày bắt đầu.",
        ["support"] = "Hỗ trợ khách hàng."
    };

    [Fact]
    public void ValidateOverdueMilestones_ValidValues_DoesNotThrow()
    {
        OpsRules.ValidateOverdueMilestones(5.0m, 10, 14, 20);
    }

    [Theory]
    [InlineData(0, 10, 14, 20)]
    [InlineData(101, 10, 14, 20)]
    [InlineData(5, 0, 14, 20)]
    [InlineData(5, 15, 14, 20)]
    [InlineData(5, 10, 20, 20)]
    [InlineData(5, 10, 21, 20)]
    public void ValidateOverdueMilestones_InvalidValues_ThrowsArgumentException(decimal rate, int start, int end, int disposal)
    {
        Assert.Throws<ArgumentException>(() => OpsRules.ValidateOverdueMilestones(rate, start, end, disposal));
    }

    [Fact]
    public async Task SaveRentalPolicy_SectionExceeds3000Chars_ThrowsArgumentException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new RentalPolicyService(f.Db);

        var sections = ValidSections();
        sections["payment"] = new string('A', 3001);

        var request = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 5.0m,
            Sections: sections,
            Version: null
        );

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.SaveRentalPolicyAsync(f.AdminUser.UserId, request));
        Assert.Contains("vượt quá 3.000 ký tự", ex.Message);
    }

    [Fact]
    public async Task SaveRentalPolicy_OptimisticConcurrencyConflict_ThrowsOperationConflictException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new RentalPolicyService(f.Db);

        // Version 1 ban đầu
        await DbSeeder.EnsureRentalPolicyVersionsAsync(f.Db, f.AdminUser.UserId);

        // Editor A lưu với Version 1 -> tăng lên Version 2
        var requestA = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 5.5m,
            Sections: ValidSections(),
            Version: 1
        );
        var resultA = await service.SaveRentalPolicyAsync(f.AdminUser.UserId, requestA);
        Assert.Equal(2, resultA.Version);

        // Editor B cố lưu với Version 1 cũ (stale version)
        var requestB = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 6.0m,
            Sections: ValidSections(),
            Version: 1
        );

        var ex = await Assert.ThrowsAsync<OperationConflictException>(() => service.SaveRentalPolicyAsync(f.AdminUser.UserId, requestB));
        Assert.Contains("thay đổi bởi người khác", ex.Message);
    }

    [Fact]
    public async Task SaveRentalPolicy_PreservesOperationalPoliciesTable_P1_DoesNotMutateOverduePolicy()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new RentalPolicyService(f.Db);

        await DbSeeder.EnsureRentalPolicyVersionsAsync(f.Db, f.AdminUser.UserId);

        // Giả lập chính sách vận hành OVERDUE ban đầu tại B02 là 5.0%
        f.Db.Policies.Add(new Policy
        {
            PolicyName = "Phí phạt quá hạn",
            PolicyType = "OVERDUE",
            CalculationType = "DEPOSIT_PERCENT_PER_DAY",
            Value = 5.0m,
            RuleDescription = "Phí quá hạn 5% mỗi ngày",
            Status = "ACTIVE",
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            CreatedBy = f.AdminUser.UserId,
            CreatedAt = DateTime.UtcNow
        });
        await f.Db.SaveChangesAsync();

        var request = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 7.5m,
            Sections: ValidSections(),
            Version: 1
        );

        var result = await service.SaveRentalPolicyAsync(f.AdminUser.UserId, request);
        Assert.Equal(7.5m, result.Rate);

        // P1: Bảng Policies vận hành được giữ nguyên (vẫn 5.0%), không bị đường công bố nội dung tự động ghi đè
        var overduePolicy = await f.Db.Policies.FirstOrDefaultAsync(p => p.PolicyType == "OVERDUE" && p.Status == "ACTIVE");
        Assert.NotNull(overduePolicy);
        Assert.Equal(5.0m, overduePolicy.Value);
    }
}

