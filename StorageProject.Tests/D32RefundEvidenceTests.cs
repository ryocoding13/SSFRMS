using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Data;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// D32 / T05, T07, T08: ảnh bằng chứng, tài khoản chính chủ, kiểm kê lưu phí, hoàn cọc hai bước, huỷ đơn đã thanh toán.
/// Chạy trên SQLite trong bộ nhớ (không có sp_getapplock) — chưa thay cho kiểm SQL Server thật.
/// </summary>
public sealed class D32RefundEvidenceTests
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

    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
    private static EvidencePhotoUpload Photo(byte[] data, string type = "image/jpeg", string name = "kho-trong.jpg") =>
        new(name, type, Convert.ToBase64String(data));

    private static DateOnly TodayVn => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = new("Data Source=:memory:");
        public AppDbContext Db = null!;
        public User Staff = null!, Manager = null!, Customer = null!;
        public Facility Facility = null!;
        public UnitType Type = null!;

        public FacilityOpsService Ops => new(Db);
        public OpsActor StaffActor => new(Staff.UserId, false);
        public OpsActor ManagerActor => new(Manager.UserId, true);

        public static async Task<Fixture> CreateAsync()
        {
            var f = new Fixture();
            await f.Connection.OpenAsync();
            f.Db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options);
            await f.Db.Database.EnsureCreatedAsync();

            f.Staff = new User { Username = "staff01", Email = "staff01@example.com", FullName = "Trần Nhân Viên", PasswordHash = "x", Status = "ACTIVE" };
            f.Manager = new User { Username = "manager01", Email = "manager01@example.com", FullName = "Lê Quản Lý", PasswordHash = "x", Status = "ACTIVE" };
            f.Customer = new User { Username = "customer01", Email = "customer01@example.com", FullName = "Nguyễn Văn An", PasswordHash = "x", Status = "ACTIVE" };
            f.Facility = new Facility { Name = "SafeSpace Nguyễn Lương Bằng", Address = "1 NLB", Status = "ACTIVE" };
            f.Type = new UnitType { TypeName = "Kho thường M", Area = 15, ClimateControlled = false, Status = "ACTIVE" };
            f.Db.AddRange(f.Staff, f.Manager, f.Customer, f.Facility, f.Type);
            await f.Db.SaveChangesAsync();

            var staffRole = new Role { RoleName = "STAFF", Description = "Staff" };
            var managerRole = new Role { RoleName = "MANAGER", Description = "Manager" };
            var customerRole = new Role { RoleName = "CUSTOMER", Description = "Customer" };
            f.Db.AddRange(staffRole, managerRole, customerRole);
            await f.Db.SaveChangesAsync();
            f.Db.UserRoles.AddRange(
                new UserRole { UserId = f.Staff.UserId, RoleId = staffRole.RoleId },
                new UserRole { UserId = f.Manager.UserId, RoleId = managerRole.RoleId },
                new UserRole { UserId = f.Customer.UserId, RoleId = customerRole.RoleId });
            var from = TodayVn.AddDays(-30);
            f.Db.UserFacilities.AddRange(
                new UserFacility { UserId = f.Staff.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE", AssignedBy = f.Manager.UserId, AssignedFrom = from, CreatedAt = DateTime.UtcNow },
                new UserFacility { UserId = f.Manager.UserId, FacilityId = f.Facility.FacilityId, Status = "ACTIVE", AssignedBy = f.Manager.UserId, AssignedFrom = from, CreatedAt = DateTime.UtcNow });
            await f.Db.SaveChangesAsync();
            return f;
        }

        /// <summary>Hợp đồng ACTIVE hết hạn hôm nay (trả kho hôm nay = trả đúng hạn, không quá hạn, không dừng sớm).</summary>
        public async Task<RentalContract> ActiveContractAsync(decimal deposit = 1_000_000m, string unitNumber = "K01")
        {
            var unit = new StorageUnit { FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId, UnitNumber = unitNumber, Status = "OCCUPIED" };
            Db.StorageUnits.Add(unit);
            var start = TodayVn.AddMonths(-1);
            var reservation = new Reservation
            {
                CustomerId = Customer.UserId, FacilityId = Facility.FacilityId, UnitTypeId = Type.UnitTypeId,
                StartDate = start, ExpectedEndDate = TodayVn, RentalPeriodMonths = 1, EstimatedAmount = deposit,
                RequiredDeposit = deposit, QuotedMonthlyRate = deposit, Status = "UNIT_ASSIGNED", CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            Db.Reservations.Add(reservation);
            await Db.SaveChangesAsync();
            var contract = new RentalContract
            {
                ReservationId = reservation.ReservationId, CustomerId = Customer.UserId, UnitId = unit.UnitId,
                StartDate = start, EndDate = TodayVn, AgreedMonthlyRate = deposit, DepositAmount = deposit,
                Status = "ACTIVE", CreatedAt = DateTime.UtcNow.AddMonths(-1)
            };
            Db.RentalContracts.Add(contract);
            await Db.SaveChangesAsync();
            return contract;
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }

    private static MoveOutRequest MoveOut(params EvidencePhotoUpload[] photos) =>
        new(TodayVn, "09:00–09:30", "Đã dọn sạch", "Vietcombank", "0123456789", "NGUYEN VAN AN", true, photos);

    // ------------------------------------------------------------------ ảnh và tài khoản

    [Fact]
    public void Photos_AcceptRealJpegPng_RejectFakeTooManyAndMissing()
    {
        var ok = EvidencePhotos.Decode([Photo(Jpeg), Photo(Png, "image/png", "a.png")], required: true, what: "kho trống");
        Assert.Equal(2, ok.Count);
        Assert.Equal("image/png", ok[1].ContentType);

        // MIME nói JPG nhưng nội dung là PNG → từ chối (không tin MIME)
        Assert.Throws<ArgumentException>(() => EvidencePhotos.Decode([Photo(Png, "image/jpeg")], true, "kho trống"));
        Assert.Throws<ArgumentException>(() => EvidencePhotos.Decode([Photo(Jpeg, "image/gif")], true, "kho trống"));
        Assert.Throws<ArgumentException>(() => EvidencePhotos.Decode(Enumerable.Repeat(Photo(Jpeg), 6).ToList(), true, "kho trống"));
        Assert.Throws<ArgumentException>(() => EvidencePhotos.Decode([], true, "kho trống"));
        Assert.Empty(EvidencePhotos.Decode(null, false, "bằng chứng"));
        Assert.Equal("anh-1.jpg", EvidencePhotos.SafeName("../../", 0, "image/jpeg"));
        Assert.Equal("a.jpg", EvidencePhotos.SafeName("C:\\fakepath\\a.jpg", 0, "image/jpeg"));
    }

    [Fact]
    public void PhotoUrl_IsSigned_AndExpires()
    {
        var now = DateTime.UtcNow;
        var url = EvidencePhotos.Url(42, now);
        var query = url[(url.IndexOf('?') + 1)..].Split('&').ToDictionary(p => p.Split('=')[0], p => p.Split('=')[1]);
        var exp = long.Parse(query["exp"]);
        Assert.True(EvidencePhotos.Verify(42, exp, query["sig"], now));
        Assert.False(EvidencePhotos.Verify(43, exp, query["sig"], now));          // ảnh khác
        Assert.False(EvidencePhotos.Verify(42, exp + 1, query["sig"], now));      // sửa hạn
        Assert.False(EvidencePhotos.Verify(42, exp, query["sig"], now.AddHours(2))); // hết hạn
    }

    [Fact]
    public void RefundBank_RequiresOwnerName_IgnoringAccentsAndCase()
    {
        var acc = RefundBank.Validate(new RefundBankInput(" Vietcombank ", "0012345678", "nguyen   van an"), "Nguyễn Văn An");
        Assert.Equal("0012345678", acc.AccountNumber); // giữ số 0 đầu
        Assert.Equal("nguyen van an", acc.AccountHolder);
        Assert.Equal("DANG THU TRANG", RefundBank.NormalizeHolder("Đặng Thu Trang"));
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(new RefundBankInput("VCB", "12345", "NGUYEN VAN AN"), "Nguyễn Văn An"));
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(new RefundBankInput("VCB", "123456", "TRAN VAN B"), "Nguyễn Văn An"));
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(null, "Nguyễn Văn An"));
    }

    // ------------------------------------------------------------------ trả kho → kiểm kê → chốt → hoàn

    [Fact]
    public async Task MoveOut_RequiresPhotosBankAndEmptied_StoresThem_AndBlocksDuplicate()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var svc = new ContractService(f.Db);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut()));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId,
            MoveOut(Photo(Jpeg)) with { Emptied = false }));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId,
            MoveOut(Photo(Jpeg)) with { AccountHolder = "NGUOI KHAC" }));

        var res = await svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg), Photo(Png, "image/png", "b.png")));
        var inspection = await f.Db.ReturnInspections.SingleAsync(i => i.InspectionId == res.InspectionId);
        Assert.Equal("Vietcombank", inspection.RefundBankName);
        Assert.Equal("0123456789", inspection.RefundAccountNumber);
        Assert.Equal(2, await f.Db.EvidencePhotos.CountAsync(p => p.OwnerType == EvidencePhotos.MoveOut && p.OwnerId == res.InspectionId));
        Assert.Equal("RETURN_PENDING", (await f.Db.RentalContracts.FindAsync(c.ContractId))!.Status);
        // 09:00 giờ Việt Nam lưu thành 02:00 UTC (D10)
        Assert.Equal(new TimeOnly(2, 0), TimeOnly.FromDateTime(inspection.ScheduledAt!.Value));

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg))));
    }

    [Fact]
    public async Task Inspection_StoresFeesAndPhotos_ThenSettlementIsPending_ThenTransferMarksPaidOnce()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var move = await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg)));
        var returnId = $"TK-{move.InspectionId:0000}";

        // Hư hỏng bắt buộc có ảnh, hạng mục, lý do; không được chọn "cho thuê lại ngay"
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.SubmitReturnInspectionAsync(f.StaffActor, returnId,
            new OpsReturnInspectionRequest("Trống", "Trầy cửa", "Đã nhận", "Cần bảo trì trước khi cho thuê lại", 200_000m, true, "Cửa cuốn", "Trầy sơn")));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.SubmitReturnInspectionAsync(f.StaffActor, returnId,
            new OpsReturnInspectionRequest("Trống", "Trầy cửa", "Đã nhận", "Sẵn sàng cho thuê lại", 200_000m, true, "Cửa cuốn", "Trầy sơn", [Photo(Jpeg)])));

        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, returnId,
            new OpsReturnInspectionRequest("Trống", "Trầy cửa", "Đã nhận", "Cần bảo trì trước khi cho thuê lại", 200_000m, true, "Cửa cuốn", "Trầy sơn", [Photo(Jpeg)]));
        var inspection = await f.Db.ReturnInspections.AsNoTracking().SingleAsync(i => i.InspectionId == move.InspectionId);
        Assert.Equal(200_000m, inspection.DamageFee);
        Assert.Equal(100_000m, inspection.CleaningFee); // 10% cọc, server tự tính
        Assert.Equal("Cửa cuốn", inspection.DamageItem);
        Assert.Equal(1, await f.Db.EvidencePhotos.CountAsync(p => p.OwnerType == EvidencePhotos.ReturnInspection && p.OwnerId == move.InspectionId));

        // M07: chốt → chờ hoàn, chưa PAID; ô giữ MAINTENANCE
        var contractCode = $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";
        var settled = await f.Ops.ConfirmRefundAsync(f.ManagerActor, contractCode, "Đối chiếu đủ ảnh");
        Assert.Equal("PENDING", settled.RefundStatus);
        Assert.Equal(700_000m, settled.Refund); // 1.000.000 − vệ sinh 100.000 − hư hỏng 200.000
        var refund = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal("PENDING", refund.Status);
        Assert.Null(refund.TransactionReference);
        Assert.Null(refund.PaidAt);
        Assert.Equal("MAINTENANCE", (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == c.UnitId)).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmRefundAsync(f.ManagerActor, contractCode));

        // Danh sách hoàn cọc: version 1, có tài khoản chính chủ và ảnh biên bản
        var item = Assert.Single(await f.Ops.GetDepositRefundsAsync(f.ManagerActor));
        Assert.Equal(1, item.Version);
        Assert.Equal("PENDING", item.Status);
        Assert.Equal("0123456789", item.AccountNumber);
        Assert.Equal(100_000m, item.Cleaning);
        Assert.Equal(200_000m, item.Damage);
        Assert.Single(item.Photos);
        Assert.Single(await f.Ops.GetCustomerDepositRefundsAsync(f.Customer.UserId));
        Assert.Empty(await f.Ops.GetCustomerDepositRefundsAsync(f.Staff.UserId));

        // Nhân viên không được xác nhận chuyển tiền; phiên bản cũ → 409
        var request = new DepositRefundActionRequest("CONFIRM_DEPOSIT_REFUND", item.Id, 1, "FT26302000001", DateTime.UtcNow, true);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Ops.ConfirmDepositRefundAsync(f.StaffActor, request));
        await Assert.ThrowsAsync<OpsConflictException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request with { ExpectedVersion = 2 }));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request with { Confirmed = false }));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request with { TransferredAt = DateTime.UtcNow.AddHours(2) }));

        var paid = await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request);
        Assert.Equal("PAID", paid.Status);
        Assert.Equal(2, paid.Version);
        Assert.Equal("FT26302000001", paid.TransactionRef);
        Assert.NotNull(paid.PaidAt);
        // Gửi lại cùng yêu cầu (mạng lỗi, bấm lặp) không chuyển lần hai
        await Assert.ThrowsAsync<OpsConflictException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request));
    }

    [Fact]
    public async Task Verification_Checklist_RequiresAllFourItems_WithoutDocumentNumber()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var handover = new HandoverRecord { ContractId = c.ContractId, StaffId = f.Staff.UserId, ScheduledAt = DateTime.UtcNow, Status = "SCHEDULED", CreatedAt = DateTime.UtcNow };
        f.Db.HandoverRecords.Add(handover);
        await f.Db.SaveChangesAsync();
        var id = $"XM-{handover.HandoverId:0000}";

        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.VerifyCustomerAsync(f.StaffActor, id,
            new OpsVerifyRequest(null, null, true, true, OriginalDocumentValid: true, BookingMatched: false)));
        await f.Ops.VerifyCustomerAsync(f.StaffActor, id, new OpsVerifyRequest(null, null, true, true, OriginalDocumentValid: true, BookingMatched: true));
        Assert.Equal("VERIFIED", (await f.Db.HandoverRecords.AsNoTracking().SingleAsync(h => h.HandoverId == handover.HandoverId)).Status);

        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.RecordKeyReceiptAsync(f.StaffActor,
            $"BG-{handover.HandoverId:0000}", new OpsKeyReceiptRequest(true, true, false)));
    }

    // ------------------------------------------------------------------ huỷ đơn đã thanh toán (M08)

    [Fact]
    public async Task CancelPaidReservationBeforeStart_StoresOwnerBank_ReleasesUnit_ThenManagerRecordsTransfer()
    {
        await using var f = await Fixture.CreateAsync();
        var unit = new StorageUnit { FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, UnitNumber = "K05", Status = "RESERVED" };
        f.Db.StorageUnits.Add(unit);
        var start = TodayVn.AddDays(10);
        var r = new Reservation
        {
            CustomerId = f.Customer.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId,
            StartDate = start, ExpectedEndDate = start.AddMonths(3), RentalPeriodMonths = 3, EstimatedAmount = 3_000_000m,
            RequiredDeposit = 1_000_000m, QuotedMonthlyRate = 1_000_000m, Status = "UNIT_ASSIGNED", CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
        f.Db.Reservations.Add(r);
        await f.Db.SaveChangesAsync();
        var contract = new RentalContract
        {
            ReservationId = r.ReservationId, CustomerId = f.Customer.UserId, UnitId = unit.UnitId, StartDate = start,
            EndDate = start.AddMonths(3), AgreedMonthlyRate = 1_000_000m, DepositAmount = 1_000_000m, Status = "ACTIVE", CreatedAt = DateTime.UtcNow
        };
        f.Db.RentalContracts.Add(contract);
        await f.Db.SaveChangesAsync();
        f.Db.UnitAssignments.Add(new UnitAssignment { ReservationId = r.ReservationId, UnitId = unit.UnitId, AssignedAt = DateTime.UtcNow, Status = "ACTIVE" });
        f.Db.AccessCredentials.Add(new AccessCredential { ContractId = contract.ContractId, UnitId = unit.UnitId, IssuedBy = f.Manager.UserId,
            CredentialType = "ACCESS_CODE", CredentialReference = $"QR-{r.ReservationId}", IssuedAt = DateTime.UtcNow, Status = "ACTIVE" });
        var now = DateTime.UtcNow;
        f.Db.Payments.AddRange(
            new Payment { ReservationId = r.ReservationId, ContractId = contract.ContractId, PaymentType = "RENT", Amount = 3_000_000m, PaymentMethod = "PAYMENT_GATEWAY", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now },
            new Payment { ReservationId = r.ReservationId, ContractId = contract.ContractId, PaymentType = "DEPOSIT", Amount = 1_000_000m, PaymentMethod = "PAYMENT_GATEWAY", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now });
        await f.Db.SaveChangesAsync();

        var reservations = new ReservationService(f.Db);
        // Đã thanh toán mà thiếu tài khoản chính chủ → không huỷ
        await Assert.ThrowsAsync<ArgumentException>(() => reservations.CancelReservationAsync(f.Customer.UserId, r.ReservationId, "Đổi kế hoạch"));
        await reservations.CancelReservationAsync(f.Customer.UserId, r.ReservationId, "Đổi kế hoạch",
            new RefundBankInput("Techcombank", "1903000000", "Nguyen Van An"));

        f.Db.ChangeTracker.Clear();
        var cancelled = await f.Db.Reservations.SingleAsync(x => x.ReservationId == r.ReservationId);
        Assert.Equal("CANCELLED", cancelled.Status);
        Assert.Equal("1903000000", cancelled.RefundAccountNumber);
        Assert.Equal("CANCELLED", (await f.Db.RentalContracts.SingleAsync(x => x.ContractId == contract.ContractId)).Status);
        Assert.Equal("AVAILABLE", (await f.Db.StorageUnits.SingleAsync(u => u.UnitId == unit.UnitId)).Status);
        Assert.Equal("REVOKED", (await f.Db.AccessCredentials.SingleAsync(a => a.ContractId == contract.ContractId)).Status);
        var refund = await f.Db.Payments.SingleAsync(p => p.ReservationId == r.ReservationId && p.PaymentType == "REFUND");
        Assert.Equal(3_900_000m, refund.Amount); // 100% thuê + 90% cọc
        Assert.Equal("PENDING", refund.Status);

        var code = $"SS-{cancelled.CreatedAt.AddHours(7):yyyyMMdd}-{cancelled.ReservationId:0000}";
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.ConfirmReservationRefundAsync(f.ManagerActor, code,
            new OpsReservationRefundRequest("BANK_TRANSFER", "", DateTime.UtcNow, true)));
        await f.Ops.ConfirmReservationRefundAsync(f.ManagerActor, code,
            new OpsReservationRefundRequest("BANK_TRANSFER", "FT26302000099", DateTime.UtcNow, true));
        f.Db.ChangeTracker.Clear();
        var done = await f.Db.Payments.SingleAsync(p => p.PaymentId == refund.PaymentId);
        Assert.Equal("PAID", done.Status);
        Assert.Equal("FT26302000099", done.TransactionReference);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmReservationRefundAsync(f.ManagerActor, code,
            new OpsReservationRefundRequest("BANK_TRANSFER", "FT26302000100", DateTime.UtcNow, true)));
    }
}
