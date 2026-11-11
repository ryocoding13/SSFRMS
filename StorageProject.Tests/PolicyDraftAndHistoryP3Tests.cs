using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Operations;
using StorageProject.Core.DTOs.Policy;
using StorageProject.Core.Entities;
using StorageProject.Core.Exceptions;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// Kiểm chứng Gói P3 theo SSFRMS-Business-Policies-Audit-and-Refactor-Plan.md:
/// - Quản lý nháp chính sách vận hành (DRAFT -> UPDATE -> ACTIVATE -> DEACTIVATE, chặn sửa/xoá bản ACTIVE).
/// - Lịch sử các phiên bản chính sách cho thuê (GetPolicyVersionsAsync).
/// - Xử lý xung đột phiên bản khi công bố đồng thời (OperationConflictException 409).
/// </summary>
public sealed class PolicyDraftAndHistoryP3Tests
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
        public User OpsUser = null!;

        public async Task InitAsync()
        {
            await Connection.OpenAsync();
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(Connection)
                .Options;

            Db = new TestDb(options);
            await Db.Database.EnsureCreatedAsync();

            OpsUser = new User
            {
                Username = "ops01",
                Email = "ops@safespace.vn",
                PasswordHash = "hash",
                FullName = "Quản Lý Vận Hành",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            Db.Users.Add(OpsUser);
            await Db.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    private static Dictionary<string, string> ValidSections() => new()
    {
        ["payment"] = "Thanh toán đầy đủ.",
        ["access"] = "Mã QR tự động hết hạn khi trả kho.",
        ["renewal"] = "Gia hạn trong 24 giờ sau duyệt.",
        ["overdue"] = "Phí 5% cọc mỗi ngày.",
        ["return"] = "Trả kho kiểm tra tình trạng.",
        ["cancellation"] = "Huỷ trước ngày bắt đầu hoàn cọc.",
        ["support"] = "Hỗ trợ 24/7."
    };

    [Fact]
    public async Task RentalPolicy_GetPolicyVersionsAsync_ReturnsVersionsInDescendingOrder_WithCurrentMarked()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new RentalPolicyService(f.Db);

        await DbSeeder.EnsureRentalPolicyVersionsAsync(f.Db, f.OpsUser.UserId);

        // Công bố phiên bản mới
        var request = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 6.0m,
            Sections: ValidSections(),
            Version: 1
        );
        var published = await service.SaveRentalPolicyAsync(f.OpsUser.UserId, request);
        Assert.Equal(2, published.Version);

        // Lấy danh sách lịch sử
        var history = await service.GetPolicyVersionsAsync();
        Assert.NotNull(history);
        Assert.True(history.Count >= 2);

        // Bản đầu tiên phải là phiên bản mới nhất (version 2) và IsCurrent = true
        var latest = history[0];
        Assert.Equal(2, latest.Version);
        Assert.True(latest.IsCurrent);
        Assert.Equal(6.0m, latest.Rate);

        // Bản trước đó (version 1) IsCurrent = false
        var previous = history[1];
        Assert.Equal(1, previous.Version);
        Assert.False(previous.IsCurrent);
    }

    [Fact]
    public async Task RentalPolicy_SaveRentalPolicy_WithMismatchedExpectedVersion_ThrowsOperationConflictException()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new RentalPolicyService(f.Db);

        await DbSeeder.EnsureRentalPolicyVersionsAsync(f.Db, f.OpsUser.UserId);

        // Giả lập người dùng soạn thảo trên cơ sở version 0 trong khi hiện tại đã là version 1
        var conflictRequest = new SaveRentalPolicyRequest(
            Action: "SAVE_RENTAL_POLICY",
            Rate: 5.5m,
            Sections: ValidSections(),
            Version: 0 // Lệch phiên bản máy chủ
        );

        var ex = await Assert.ThrowsAsync<OperationConflictException>(() =>
            service.SaveRentalPolicyAsync(f.OpsUser.UserId, conflictRequest));

        Assert.Contains("Phiên bản chính sách đã được thay đổi bởi người khác", ex.Message);
    }

    [Fact]
    public async Task OperationsService_DraftLifecycle_ProtectsAgainstIllegalTransitions()
    {
        await using var f = new Fixture();
        await f.InitAsync();
        var service = new OperationsService(f.Db);

        // 1. Tạo bản nháp DRAFT
        var createReq = new UpsertPolicyRequest(
            PolicyName: "Chính sách đệm kho nháp",
            PolicyType: "RELET_BUFFER",
            CalculationType: "FIXED",
            Value: 5m,
            MinValue: null,
            MaxValue: null,
            RuleDescription: "Số ngày đệm kho trống 5 ngày",
            FacilityId: null,
            UnitTypeId: null,
            EffectiveFrom: OpsRules.TodayLocal,
            EffectiveTo: null
        );

        var draft = await service.CreatePolicyAsync(createReq, f.OpsUser.UserId);
        Assert.Equal("DRAFT", draft.Status);
        Assert.Equal(5m, draft.Value);

        // 2. Cập nhật bản nháp (cho phép khi còn DRAFT)
        var updateReq = createReq with { Value = 4m, RuleDescription = "Số ngày đệm kho trống cập nhật 4 ngày" };
        var updated = await service.UpdatePolicyAsync(draft.PolicyId, updateReq, f.OpsUser.UserId);
        Assert.Equal("DRAFT", updated.Status);
        Assert.Equal(4m, updated.Value);

        // 3. Kích hoạt bản nháp -> ACTIVE
        var activated = await service.ActivatePolicyAsync(draft.PolicyId, replaceExisting: true, f.OpsUser.UserId);
        Assert.Equal("ACTIVE", activated.Policy.Status);

        // 4. Cố tình sửa bản ACTIVE -> phải bị chặn với InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UpdatePolicyAsync(draft.PolicyId, updateReq, f.OpsUser.UserId));

        // 5. Cố tình xoá bản ACTIVE -> phải bị chặn với InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.DeleteDraftPolicyAsync(draft.PolicyId, f.OpsUser.UserId));

        // 6. Ngừng áp dụng bản ACTIVE -> INACTIVE (bảo toàn lịch sử)
        var deactivated = await service.DeactivatePolicyAsync(draft.PolicyId, f.OpsUser.UserId);
        Assert.Equal("INACTIVE", deactivated.Status);
    }
}

