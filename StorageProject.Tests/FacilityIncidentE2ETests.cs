using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Core.Policies;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// M06 · Luồng E2E Sự cố cơ sở: đề xuất -> khách chọn -> chuyển ô / kết thúc hợp đồng (T13 / D34).
/// Kiểm chứng tiêu chí nghiệm thu:
/// - Chuyển ô: giữ ô thay thế tương đương, không đổi kỳ/phụ phí, thu hồi mã cũ và cấp mã mới, retry không cấp trùng.
/// - Kết thúc: giải phóng ô đang giữ (nếu có), tài khoản chính chủ, tạo hoàn tiền PENDING 2 bước, retry không hoàn 2 lần.
/// </summary>
public sealed class FacilityIncidentE2ETests
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

    private static DateOnly TodayVn => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
    private static string Iso(DateTime utc) => utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Manager = null!, Customer = null!;
        public Facility Facility = null!;
        public UnitType Normal = null!, Cold = null!;
        public StorageUnit OldUnit = null!, TargetEquivalent = null!, NonEquivalent = null!;
        public RentalContract Contract = null!;
        public FacilityOpsService Ops => new(Db);
        public OpsActor ManagerActor => new(Manager.UserId, true);

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.Manager = new User { Username = "manager01", Email = "m@example.com", FullName = "Lê Quản Lý", PasswordHash = "x", Status = "ACTIVE" };
            f.Customer = new User { Username = "customer01", Email = "c@example.com", FullName = "Nguyễn Văn Tiến", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "1 NLB", Status = "ACTIVE" };
            f.Normal = new UnitType { TypeName = "Kho thường L", Area = 30, ClimateControlled = false, Status = "ACTIVE" };
            f.Cold = new UnitType { TypeName = "Kho lạnh L", Area = 30, ClimateControlled = true, Status = "ACTIVE" };
            f.Db.AddRange(f.Manager, f.Customer, f.Facility, f.Normal, f.Cold);
            await f.Db.SaveChangesAsync();

            var managerRole = new Role { RoleName = "MANAGER", Description = "Manager" };
            f.Db.Roles.Add(managerRole);
            await f.Db.SaveChangesAsync();

            f.Db.UserRoles.Add(new UserRole { UserId = f.Manager.UserId, RoleId = managerRole.RoleId });
            f.Db.UserFacilities.Add(new UserFacility
            {
                UserId = f.Manager.UserId,
                FacilityId = f.Facility.FacilityId,
                Status = "ACTIVE",
                AssignedBy = f.Manager.UserId,
                AssignedFrom = TodayVn.AddDays(-30),
                CreatedAt = DateTime.UtcNow
            });

            f.OldUnit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId, UnitNumber = "K07", Status = "OCCUPIED" };
            f.TargetEquivalent = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Normal.UnitTypeId, UnitNumber = "K08", Status = "AVAILABLE" };
            f.NonEquivalent = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Cold.UnitTypeId, UnitNumber = "K11", Status = "AVAILABLE" };
            f.Db.StorageUnits.AddRange(f.OldUnit, f.TargetEquivalent, f.NonEquivalent);

            var start = TodayVn.AddMonths(-1);
            var reservation = new Reservation
            {
                CustomerId = f.Customer.UserId,
                FacilityId = f.Facility.FacilityId,
                UnitTypeId = f.Normal.UnitTypeId,
                StartDate = start,
                ExpectedEndDate = start.AddMonths(3),
                RentalPeriodMonths = 3,
                EstimatedAmount = 3_450_000m,
                RequiredDeposit = 1_150_000m,
                QuotedMonthlyRate = 1_150_000m,
                Status = "UNIT_ASSIGNED",
                CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            f.Db.Reservations.Add(reservation);
            await f.Db.SaveChangesAsync();

            f.Contract = new RentalContract
            {
                ReservationId = reservation.ReservationId,
                CustomerId = f.Customer.UserId,
                UnitId = f.OldUnit.UnitId,
                StartDate = start,
                EndDate = start.AddMonths(3),
                AgreedMonthlyRate = 1_150_000m,
                DepositAmount = 1_150_000m,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            f.Db.RentalContracts.Add(f.Contract);
            await f.Db.SaveChangesAsync();

            f.Db.AccessCredentials.AddRange(
                new AccessCredential { ContractId = f.Contract.ContractId, UnitId = f.OldUnit.UnitId, IssuedBy = f.Manager.UserId, CredentialType = "ACCESS_CODE", CredentialReference = "QR-OLD-01", IssuedAt = DateTime.UtcNow, Status = "ACTIVE" },
                new AccessCredential { ContractId = f.Contract.ContractId, UnitId = f.OldUnit.UnitId, IssuedBy = f.Manager.UserId, CredentialType = "ACCESS_CODE", CredentialReference = "PIN-OLD-01", IssuedAt = DateTime.UtcNow, Status = "ACTIVE" }
            );
            await f.Db.SaveChangesAsync();
            f.Db.ChangeTracker.Clear();
            return f;
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    [Fact]
    public async Task E2E_FacilityIncident_Transfer_Workflow_With_Retries_And_No_Duplicate_Codes()
    {
        await using var f = await Fixture.CreateAsync();

        // 1. Quản lý xem danh sách sự cố -> tìm thấy bản nháp cho hợp đồng đang ACTIVE
        var list = await f.Ops.GetIncidentsAsync(f.ManagerActor);
        var draft = Assert.Single(list.Items);
        Assert.Equal("DRAFT", draft.Status);
        Assert.Equal(1, draft.Version);

        // Chỉ gợi ý ô tương đương K08 (kho thường 30m2), không gợi ý K11 (kho lạnh 30m2)
        var candidate = Assert.Single(draft.Candidates);
        Assert.Equal("K08", candidate.Code);

        // Thử chọn ô không tương đương K11 -> Bị từ chối
        var invalidSend = new IncidentActionRequest(
            Action: "SEND_INCIDENT_PROPOSAL",
            Id: draft.Id,
            ExpectedVersion: draft.Version,
            Description: "Hỏng đèn và cửa cuốn kẹt",
            AffectedAt: Iso(DateTime.UtcNow.AddHours(-1)),
            Confirmed: true,
            Proposal: "TRANSFER",
            TargetUnitId: f.NonEquivalent.UnitId.ToString(),
            ExpectedTargetVersion: 1
        );
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.SaveIncidentAsync(f.ManagerActor, invalidSend));

        // 2. Quản lý gửi phương án đổi sang K08
        var affectedAt = Iso(DateTime.UtcNow.AddHours(-1));
        var validSend = new IncidentActionRequest(
            Action: "SEND_INCIDENT_PROPOSAL",
            Id: draft.Id,
            ExpectedVersion: draft.Version,
            Description: "Hỏng đèn và cửa cuốn kẹt",
            AffectedAt: affectedAt,
            Confirmed: true,
            Proposal: "TRANSFER",
            TargetUnitId: candidate.Id,
            ExpectedTargetVersion: candidate.Version,
            Photos: [new EvidencePhotoUpload("su-co.jpg", "image/jpeg", Convert.ToBase64String(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }))]
        );

        var sentReceipt = await f.Ops.SaveIncidentAsync(f.ManagerActor, validSend);
        var sent = sentReceipt.Incident;
        Assert.Equal("PROPOSED", sent.Status);
        Assert.Equal("RESERVED", sent.TargetUnit!.Status);
        Assert.Equal(sent.Id, sent.TargetUnit.ReservedFor);

        // Ô K08 trong DB đã chuyển sang RESERVED
        var targetUnitInDb = await f.Db.StorageUnits.SingleAsync(u => u.UnitId == f.TargetEquivalent.UnitId);
        Assert.Equal("RESERVED", targetUnitInDb.Status);

        // 3. Khách hàng xem sự cố và chấp thuận đổi ô (TRANSFER)
        var customerIncidents = await f.Ops.GetCustomerIncidentsAsync(f.Customer.UserId);
        var customerIncident = Assert.Single(customerIncidents.Items);
        Assert.Equal("PROPOSED", customerIncident.Status);

        var chooseRequest = new IncidentActionRequest(
            Action: "CHOOSE_INCIDENT_OPTION",
            Id: customerIncident.Id,
            ExpectedVersion: customerIncident.Version,
            Choice: "TRANSFER",
            TargetUnitId: customerIncident.TargetUnit!.Id,
            ExpectedTargetVersion: customerIncident.TargetUnit.Version,
            Note: "Đồng ý chuyển sang ô K08"
        );
        var chosenReceipt = await f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, customerIncident.ContractId, chooseRequest);
        var chosen = chosenReceipt.Incident;
        Assert.Equal("TRANSFER_PENDING", chosen.Status);
        Assert.Equal("Đồng ý chuyển sang ô K08", chosen.Choice!.Note);

        // 4. Quản lý hoàn tất chuyển ô
        var completeRequest = new IncidentActionRequest(
            Action: "COMPLETE_INCIDENT_TRANSFER",
            Id: chosen.Id,
            ExpectedVersion: chosen.Version,
            Confirmed: true,
            TargetUnitId: chosen.TargetUnit!.Id,
            ExpectedTargetVersion: chosen.TargetUnit.Version,
            MovedAt: Iso(DateTime.UtcNow)
        );
        var doneReceipt = await f.Ops.CompleteIncidentTransferAsync(f.ManagerActor, chosen.Id, completeRequest);
        var done = doneReceipt.Incident;

        Assert.Equal("TRANSFERRED", done.Status);
        Assert.Equal("K08", done.CurrentUnit);
        Assert.Equal("MAINTENANCE", done.OldUnitStatus);
        Assert.Equal(0m, done.Surcharge); // D34: không phụ phí
        Assert.Equal(f.Contract.AgreedMonthlyRate, done.MonthlyRate); // D34: giữ nguyên giá
        Assert.Equal("ACTIVE", done.ContractStatus);

        // Kiểm tra trong DB:
        // - Hợp đồng trỏ sang K08
        var updatedContract = await f.Db.RentalContracts.Include(c => c.AccessCredentials).SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal(f.TargetEquivalent.UnitId, updatedContract.UnitId);
        // - Ô cũ K07 là MAINTENANCE
        var oldUnitInDb = await f.Db.StorageUnits.SingleAsync(u => u.UnitId == f.OldUnit.UnitId);
        Assert.Equal("MAINTENANCE", oldUnitInDb.Status);
        // - Ô mới K08 là OCCUPIED
        var newUnitInDb = await f.Db.StorageUnits.SingleAsync(u => u.UnitId == f.TargetEquivalent.UnitId);
        Assert.Equal("OCCUPIED", newUnitInDb.Status);
        // - Mã cũ K07 đã bị REPLACED
        Assert.All(updatedContract.AccessCredentials.Where(c => c.UnitId == f.OldUnit.UnitId), c => Assert.Equal("REPLACED", c.Status));
        // - Cấp đúng 2 mã mới cho K08 (1 QR, 1 PIN)
        var newCredentials = updatedContract.AccessCredentials.Where(c => c.UnitId == f.TargetEquivalent.UnitId && c.Status == "ACTIVE").ToList();
        Assert.Equal(2, newCredentials.Count);

        // 5. Retry / Idempotency: Thử gọi lại CompleteIncidentTransferAsync -> Phải bị từ chối, không cấp thừa mã
        await Assert.ThrowsAsync<OpsConflictException>(() =>
            f.Ops.CompleteIncidentTransferAsync(f.ManagerActor, chosen.Id, completeRequest));

        // Dù truyền version mới cũng bị từ chối vì Status đã là TRANSFERRED (không còn ở TRANSFER_PENDING)
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.CompleteIncidentTransferAsync(f.ManagerActor, chosen.Id, completeRequest with { ExpectedVersion = done.Version }));

        // Kiểm tra số mã truy cập ACTIVE cho ô mới vẫn đúng 2 mã, không bị sinh trùng
        var recheckedContract = await f.Db.RentalContracts.Include(c => c.AccessCredentials).SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal(2, recheckedContract.AccessCredentials.Count(c => c.UnitId == f.TargetEquivalent.UnitId && c.Status == "ACTIVE"));
    }

    [Fact]
    public async Task E2E_FacilityIncident_Termination_Workflow_With_TwoStepRefund_And_Releases_ReservedUnit()
    {
        await using var f = await Fixture.CreateAsync();

        // 1. Quản lý gửi phương án TRANSFER giữ trước ô K08
        var draft = Assert.Single((await f.Ops.GetIncidentsAsync(f.ManagerActor)).Items);
        var candidate = Assert.Single(draft.Candidates);

        var send = new IncidentActionRequest(
            Action: "SEND_INCIDENT_PROPOSAL",
            Id: draft.Id,
            ExpectedVersion: draft.Version,
            Description: "Sự cố dột ẩm nghiêm trọng không thể tiếp tục lưu kho",
            AffectedAt: Iso(DateTime.UtcNow.AddHours(-1)),
            Confirmed: true,
            Proposal: "TRANSFER",
            TargetUnitId: candidate.Id,
            ExpectedTargetVersion: candidate.Version
        );
        var sent = (await f.Ops.SaveIncidentAsync(f.ManagerActor, send)).Incident;
        Assert.Equal("RESERVED", sent.TargetUnit!.Status);

        // 2. Khách hàng chọn TERMINATE (Không đồng ý chuyển ô, yêu cầu kết thúc hợp đồng)
        // Kiểm tra validation tài khoản chính chủ: sai tên tài khoản -> Bị từ chối
        var chooseInvalidBank = new IncidentActionRequest(
            Action: "CHOOSE_INCIDENT_OPTION",
            Id: sent.Id,
            ExpectedVersion: sent.Version,
            Choice: "TERMINATE",
            RefundBank: new RefundBankInput("Vietcombank", "1234567890", "NGUYEN VAN SAI")
        );
        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId, chooseInvalidBank));

        // Gửi tài khoản chính chủ hợp lệ: NGUYEN VAN TIEN
        var chooseValidBank = chooseInvalidBank with
        {
            RefundBank = new RefundBankInput("Vietcombank", "1234567890", "NGUYEN VAN TIEN")
        };
        var chosen = (await f.Ops.ChooseIncidentOptionAsync(f.Customer.UserId, sent.ContractId, chooseValidBank)).Incident;
        Assert.Equal("TERMINATION_PENDING", chosen.Status);

        // TIÊU CHÍ QUAN TRỌNG: Ô K08 đã giữ trước đó phải được tự động giải phóng về AVAILABLE
        var releasedTarget = await f.Db.StorageUnits.SingleAsync(u => u.UnitId == f.TargetEquivalent.UnitId);
        Assert.Equal("AVAILABLE", releasedTarget.Status);

        // 3. Quản lý chốt kết thúc sự cố (FINALIZE_INCIDENT_TERMINATION)
        var finalizeRequest = new IncidentActionRequest(
            Action: "FINALIZE_INCIDENT_TERMINATION",
            Id: chosen.Id,
            ExpectedVersion: chosen.Version,
            Confirmed: true
        );
        var finalized = (await f.Ops.FinalizeIncidentTerminationAsync(f.ManagerActor, chosen.Id, finalizeRequest)).Incident;

        Assert.Equal("TERMINATED", finalized.Status);
        Assert.Equal("ENDED", finalized.ContractStatus);
        Assert.NotNull(finalized.Refund);
        Assert.Equal("PENDING", finalized.Refund.Status);

        // Công thức tính hoàn tiền D34: Tháng đang thuê + các tháng chưa dùng + 100% cọc
        var expectedTotalRefund = finalized.CurrentMonthRent + finalized.UnusedRent + finalized.Deposit;
        Assert.Equal(expectedTotalRefund, finalized.Refund.Amount);

        // Hợp đồng chuyển sang TERMINATED, mã truy cập đều REVOKED
        var terminatedContract = await f.Db.RentalContracts.Include(c => c.AccessCredentials).SingleAsync(c => c.ContractId == f.Contract.ContractId);
        Assert.Equal("TERMINATED", terminatedContract.Status);
        Assert.All(terminatedContract.AccessCredentials, c => Assert.Equal("REVOKED", c.Status));

        // Retry Finalize: Thử finalize lần 2 với version cũ hoặc version mới -> Bị chặn
        await Assert.ThrowsAsync<OpsConflictException>(() =>
            f.Ops.FinalizeIncidentTerminationAsync(f.ManagerActor, chosen.Id, finalizeRequest));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.FinalizeIncidentTerminationAsync(f.ManagerActor, chosen.Id, finalizeRequest with { ExpectedVersion = finalized.Version }));

        // Kiểm tra DB: Chỉ có đúng 1 bản ghi Payment REFUND được tạo
        var refundsInDb = await f.Db.Payments.Where(p => p.ContractId == f.Contract.ContractId && p.PaymentType == "REFUND").ToListAsync();
        Assert.Single(refundsInDb);

        // 4. Bước 2 của hoàn tiền: Quản lý xác nhận chuyển khoản thực tế qua /api/ops/deposit-refunds/actions
        var pendingRefunds = await f.Ops.GetDepositRefundsAsync(f.ManagerActor);
        var refundItem = Assert.Single(pendingRefunds);
        Assert.Equal(finalized.Refund.Id, refundItem.Id);
        Assert.Equal("1234567890", refundItem.AccountNumber);
        Assert.Equal(expectedTotalRefund, refundItem.Amount);

        var confirmRefundRequest = new DepositRefundActionRequest(
            Action: "CONFIRM_DEPOSIT_REFUND",
            Id: refundItem.Id,
            ExpectedVersion: refundItem.Version,
            TransactionRef: "TX-INCIDENT-9999",
            TransferredAt: DateTime.UtcNow,
            Confirmed: true
        );
        var confirmedRefund = await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, confirmRefundRequest);
        Assert.Equal("PAID", confirmedRefund.Status);

        // Khách hàng kiểm tra lại thấy khoản hoàn đã PAID kèm TransactionRef
        var customerIncidentsAfter = await f.Ops.GetCustomerIncidentsAsync(f.Customer.UserId);
        var myIncidentAfter = Assert.Single(customerIncidentsAfter.Items);
        Assert.Equal("PAID", myIncidentAfter.Refund!.Status);
        Assert.Equal("TX-INCIDENT-9999", myIncidentAfter.Refund.TransactionRef);

        // Retry Confirm: Thử confirm lại lần 2 -> Bị chặn (conflict do expectedVersion đã tăng)
        await Assert.ThrowsAsync<OpsConflictException>(() =>
            f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, confirmRefundRequest));
    }
}
