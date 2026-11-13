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
public sealed partial class D32RefundEvidenceTests
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
        Assert.Equal("Vietcombank", acc.BankName);
        Assert.Equal("nguyen van an", acc.AccountHolder);
        Assert.Equal("DANG THU TRANG", RefundBank.NormalizeHolder("Đặng Thu Trang"));
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(new RefundBankInput("VCB", "123456", "NGUYEN VAN AN"), "Nguyễn Văn An"));
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(new RefundBankInput("Ngân hàng lạ", "0123456789", "NGUYEN VAN AN"), "Nguyễn Văn An"));
        var relative = RefundBank.Validate(new RefundBankInput("VCB", "0123456789", "TRAN VAN B"), "Nguyễn Văn An");
        Assert.Equal("TRAN VAN B", relative.AccountHolder);
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(null, "Nguyễn Văn An"));
    }

    // ------------------------------------------------------------------ trả kho → kiểm kê → chốt → hoàn

    [Fact]
    public async Task MoveOut_RequiresPhotosBankAndEmptied_StoresThem_AndBlocksDuplicate()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var svc = new ContractService(f.Db);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId,
            MoveOut() with { Emptied = false }));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId,
            MoveOut() with { AccountHolder = "   " }));

        var res = await svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut() with { AccountHolder = "TRAN THI NGUOI THAN" });
        var inspection = await f.Db.ReturnInspections.SingleAsync(i => i.InspectionId == res.InspectionId);
        Assert.Equal("Vietcombank", inspection.RefundBankName);
        Assert.Equal("0123456789", inspection.RefundAccountNumber);
        Assert.Equal(0, await f.Db.EvidencePhotos.CountAsync(p => p.OwnerType == EvidencePhotos.MoveOut && p.OwnerId == res.InspectionId));
        Assert.Equal("RETURN_PENDING", (await f.Db.RentalContracts.FindAsync(c.ContractId))!.Status);
        // 09:00 giờ Việt Nam lưu thành 02:00 UTC (D10)
        Assert.Equal(new TimeOnly(2, 0), TimeOnly.FromDateTime(inspection.ScheduledAt!.Value));

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut()));
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
        // D39/D40: có khấu trừ thì chờ khách xác nhận trong 48 giờ trước khi chốt.
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmRefundAsync(f.ManagerActor, contractCode));
        await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, contractCode, new ReturnDeductionDecisionRequest("AGREE", null));
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
        // Task #20: khóa hình thức hoàn theo lựa chọn khách (BANK_TRANSFER không được đổi sang CASH)
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request with { Method = "CASH" }));

        var paid = await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request);
        Assert.Equal("PAID", paid.Status);
        Assert.Equal(2, paid.Version);
        Assert.Equal("FT26302000001", paid.TransactionRef);
        Assert.NotNull(paid.PaidAt);
        // Gửi lại cùng yêu cầu (mạng lỗi, bấm lặp) không chuyển lần hai
        await Assert.ThrowsAsync<OpsConflictException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request));
    }

    [Fact]
    public async Task ConfirmDepositRefundAsync_CashMethod_DoesNotRequireBankDetails()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        // Payment without bank account
        var refundPayment = new Payment
        {
            ContractId = c.ContractId,
            PaymentType = "REFUND",
            Amount = 300_000m,
            Status = "PENDING",
            PaymentMethod = "CASH",
            CreatedAt = DateTime.UtcNow.AddHours(-1)
        };
        f.Db.Payments.Add(refundPayment);
        await f.Db.SaveChangesAsync();

        var request = new DepositRefundActionRequest(
            "CONFIRM_DEPOSIT_REFUND",
            $"HC-{refundPayment.PaymentId:0000}",
            1,
            "PC-001",
            DateTime.UtcNow,
            Confirmed: true,
            Method: "CASH"
        );

        var result = await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor, request);
        Assert.Equal("PAID", result.Status);
        Assert.Equal("CASH", result.Method);
        Assert.Equal("PC-001", result.TransactionRef);
        Assert.NotNull(result.PaidAt);
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
        var preview = await reservations.GetCancelPreviewAsync(f.Customer.UserId, r.ReservationId);
        Assert.Equal(4_000_000m, preview.PaidAmount);
        Assert.Equal(0m, preview.CancellationFee);
        Assert.Equal(4_000_000m, preview.RefundAmount);
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            reservations.GetCancelPreviewAsync(f.Staff.UserId, r.ReservationId));
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
        Assert.Equal(4_000_000m, refund.Amount); // D49: 100% thuê + 100% cọc (miễn phí huỷ)
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
    [Fact] public async Task T06_SettlementCapsActualFeePaymentsAndWaivesOnlyReturnFeeRemainders()
    {
        await using var f=await Fixture.CreateAsync();var c=await f.ActiveContractAsync();
        var move=await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId,c.ContractId,MoveOut(Photo(Jpeg)));
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor,$"TK-{move.InspectionId:0000}",
            new("Trống","Trầy cửa","Đã nhận","Cần bảo trì trước khi cho thuê lại",2_000_000m,true,"Cửa","Hỏng",[Photo(Jpeg)]));
        Payment Fee(string type,decimal amount,string status="PENDING")=>new(){ContractId=c.ContractId,PaymentType=type,Amount=amount,PaymentMethod="CASH",Status=status,CreatedAt=DateTime.UtcNow,UpdatedAt=DateTime.UtcNow};
        var rent=Fee("RENT",1_000_000m,"PAID");var renewal=Fee("RENEWAL",500_000m);
        f.Db.Payments.AddRange(Fee("DAMAGE_FEE",1_500_000m),Fee("OVERDUE_FEE",3_000_000m,"FAILED"),Fee("CLEANING_FEE",1_000_000m),rent,renewal);await f.Db.SaveChangesAsync();
        await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId,$"HĐ-{c.StartDate.Year}-{c.ContractId:0000}",new ReturnDeductionDecisionRequest("AGREE",null));
        var result=await f.Ops.ConfirmRefundAsync(f.ManagerActor,$"HĐ-{c.StartDate.Year}-{c.ContractId:0000}");
        Assert.Equal("NO_REFUND",result.RefundStatus);Assert.Equal(0m,result.Refund);
        var fees=await f.Db.Payments.Where(p=>p.ContractId==c.ContractId&&(p.PaymentType=="DAMAGE_FEE"||p.PaymentType=="OVERDUE_FEE"||p.PaymentType=="CLEANING_FEE")).ToListAsync();
        Assert.Equal(1_000_000m,fees.Where(p=>p.Status=="PAID").Sum(p=>p.Amount));Assert.Equal(4_500_000m,fees.Where(p=>p.Status=="CANCELLED").Sum(p=>p.Amount));
        Assert.DoesNotContain(fees,p=>p.Status is "PENDING" or "FAILED");Assert.All(fees.Where(p=>p.Status=="CANCELLED"),p=>Assert.Null(p.PaidAt));
        Assert.Equal("PAID",rent.Status);Assert.Equal(1_000_000m,rent.Amount);Assert.Equal("PENDING",renewal.Status);Assert.Equal(500_000m,renewal.Amount);
        Assert.Equal(3,await f.Db.ActivityLogs.CountAsync(x=>x.Action=="RETURN_FEE_WAIVED"));
    }
    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task OpsInspection_RequiresExplicitFees_WithoutChangingTheInspection(bool hasDamageFee, bool hasCleaningChoice)
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var move = await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg)));
        var request = new OpsReturnInspectionRequest("Đạt · không còn đồ", "Đạt tiêu chuẩn", "Đã nhận đủ chìa", "Sẵn sàng cho thuê lại",
            hasDamageFee ? 0m : null, hasCleaningChoice ? false : null, Photos: [Photo(Jpeg)]);

        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.SubmitReturnInspectionAsync(
            f.StaffActor, $"TK-{move.InspectionId:0000}", request));
        // Task #8: nhân viên kiểm tra trả kho (kể cả không hư hỏng) bắt buộc có ít nhất 1 ảnh hiện trạng.
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.SubmitReturnInspectionAsync(
            f.StaffActor, $"TK-{move.InspectionId:0000}", request with { DamageFee = 0m, CleaningRequired = false, Photos = null }));

        f.Db.ChangeTracker.Clear();
        var inspection = await f.Db.ReturnInspections.SingleAsync(i => i.InspectionId == move.InspectionId);
        Assert.Equal("SCHEDULED", inspection.Status);
        Assert.Null(inspection.InspectedAt);
        Assert.Equal("RETURN_PENDING", (await f.Db.RentalContracts.FindAsync(c.ContractId))!.Status);
        Assert.False(await f.Db.ActivityLogs.AnyAsync(l => l.Action == "RETURN_INSPECTED"));

        // Không có phí vẫn hợp lệ, nhưng biểu mẫu phải gửi rõ 0, false và ảnh hiện trạng.
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, $"TK-{move.InspectionId:0000}",
            request with { DamageFee = 0m, CleaningRequired = false });
        Assert.Equal("COMPLETED", inspection.Status);
        Assert.Equal(0m, inspection.DamageFee);
        Assert.Equal(0m, inspection.CleaningFee);
    }

    [Theory]
    [InlineData("DIRTY", false, 900_000)]
    [InlineData("GOOD", true, 900_000)]
    [InlineData("DAMAGED", false, 1_000_000)]
    [InlineData("MAINTENANCE_REQUIRED", false, 1_000_000)]
    [InlineData("GOOD", false, 1_000_000)]
    public async Task Settlement_PreservesLegacyInspectionMaintenance(string condition, bool hasCleaningFee, int expectedRefund)
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var move = await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg)));
        var inspection = await f.Db.ReturnInspections.SingleAsync(i => i.InspectionId == move.InspectionId);
        // Dữ liệu cũ có ConditionStatus/CleaningFee nhưng chưa có các cờ mới.
        inspection.Status = "COMPLETED";
        inspection.InspectedAt = DateTime.UtcNow.AddHours(-49);
        inspection.ConditionStatus = condition;
        inspection.CleaningFee = hasCleaningFee ? 100_000m : 0m;
        inspection.CleaningRequired = false;
        inspection.MaintenanceRequired = false;
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();

        var result = await f.Ops.ConfirmRefundAsync(f.ManagerActor, $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}");
        Assert.Equal((decimal)expectedRefund, result.Refund);
        var expectedUnitStatus = condition == "GOOD" && !hasCleaningFee ? "AVAILABLE" : "MAINTENANCE";
        Assert.Equal(expectedUnitStatus, (await f.Db.StorageUnits.AsNoTracking().SingleAsync(u => u.UnitId == c.UnitId)).Status);
        var refund = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal("PENDING", refund.Status);
        Assert.Null(refund.PaidAt);
        Assert.Null(refund.TransactionReference);
    }

    [Theory]
    [InlineData("١٢٣٤٥٦")]
    [InlineData("１２３４５６")]
    [InlineData("123456\n")]
    public void RefundBank_RejectsNonAsciiOrTrailingNewlineInStoredAccount(string number)
    {
        Assert.False(RefundBank.IsComplete("VCB", number, "Nguyen Van An"));
        if (!number.EndsWith('\n'))
            Assert.Throws<ArgumentException>(() => RefundBank.Validate(new("VCB", number, "Nguyen Van An"), "Nguyễn Văn An"));
    }

    [Fact]
    public async Task DepositRefund_ShowsInspectionTimeSeparatelyFromSettlementTime()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var move = await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, MoveOut(Photo(Jpeg)));
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, $"TK-{move.InspectionId:0000}",
            new("Đạt · không còn đồ", "Đạt tiêu chuẩn", "Đã nhận đủ chìa", "Sẵn sàng cho thuê lại", 0m, false, Photos: [Photo(Jpeg)]));
        var inspection = await f.Db.ReturnInspections.SingleAsync(i => i.InspectionId == move.InspectionId);
        // Đặt các mốc khác nhau để phát hiện DTO lấy nhầm giờ chốt làm giờ kiểm kê.
        var inspectedAt = DateTime.UtcNow.AddHours(-1);
        inspection.CreatedAt = inspectedAt.AddHours(-1);
        inspection.InspectedAt = inspectedAt;
        c.EndDate = DateOnly.FromDateTime(inspection.CreatedAt.AddHours(7));
        await f.Db.SaveChangesAsync();
        await f.Ops.ConfirmRefundAsync(f.ManagerActor, $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}");

        var item = Assert.Single(await f.Ops.GetDepositRefundsAsync(f.ManagerActor));
        Assert.Equal(inspectedAt, item.InspectedAt);
        Assert.Equal(inspection.CreatedAt, item.RequestedAt);
        Assert.True(item.ApprovedAt > item.InspectedAt);
        Assert.Equal("PENDING", item.Status);
    }

    [Fact] public async Task LegacyInspectionRequiresExplicitFeesAndUsesTheSamePersistedRules()
    {
        await using var f=await Fixture.CreateAsync();var c=await f.ActiveContractAsync();
        var move=await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId,c.ContractId,MoveOut(Photo(Jpeg)));
        var service=new StaffService(f.Db);
        await Assert.ThrowsAsync<ArgumentException>(()=>service.SubmitReturnInspectionAsync(f.Staff.UserId,move.InspectionId.ToString(),
            new(){Items="Trống",Walls="Sạch",Keys="Đủ",Proposal="Sẵn sàng cho thuê lại"}));
        // L22 / D38: đạt 1/3 tiêu chuẩn thì không được chọn cho thuê lại ngay.
        var below=await Assert.ThrowsAsync<ArgumentException>(()=>service.SubmitReturnInspectionAsync(f.Staff.UserId,move.InspectionId.ToString(),
            new(){Items="Chưa đạt · còn nhiều đồ",Walls="Chưa đạt tiêu chuẩn vệ sinh",Keys="Đã nhận đủ chìa",Proposal="Sẵn sàng cho thuê lại",DamageFee=0,CleaningRequired=false,Photos=[Photo(Jpeg)]}));
        Assert.Contains("2/3",below.Message);
        // Task #13: "Đạt · còn ít đồ" tính là đạt (2/3 cùng với chìa khóa), không tự động phát sinh phí vệ sinh.
        await service.SubmitReturnInspectionAsync(f.Staff.UserId,move.InspectionId.ToString(),
            new(){Items="Đạt · còn ít đồ",Walls="Đạt tiêu chuẩn",Keys="Đã nhận đủ chìa",Proposal="Sẵn sàng cho thuê lại",DamageFee=0,CleaningRequired=false,Photos=[Photo(Jpeg)]});
        var inspection=await f.Db.ReturnInspections.AsNoTracking().SingleAsync(x=>x.InspectionId==move.InspectionId);
        Assert.Equal("COMPLETED",inspection.Status);Assert.False(inspection.CleaningRequired);Assert.Equal(0m,inspection.CleaningFee);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>service.SubmitReturnInspectionAsync(f.Staff.UserId,move.InspectionId.ToString(),
            new(){Items="Đạt · không còn đồ",Walls="Đạt tiêu chuẩn",Keys="Đã nhận đủ chìa",Proposal="Sẵn sàng cho thuê lại",DamageFee=0,CleaningRequired=false,Photos=[Photo(Jpeg)]}));
    }

}
