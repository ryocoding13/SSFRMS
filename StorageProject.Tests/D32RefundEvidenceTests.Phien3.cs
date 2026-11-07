using Microsoft.EntityFrameworkCore;
using StorageProject.Core.DTOs.Contract;
using StorageProject.Core.DTOs.Evidence;
using StorageProject.Core.DTOs.FacilityOps;
using StorageProject.Core.DTOs.Support;
using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>
/// Phiên 3 (05/11/2026): D39/D40 xác nhận khấu trừ 48 giờ, D42 hoàn tiền mặt tại quầy + gọi nhắc + báo cáo cuối ngày,
/// D35/D36 ảnh hỗ trợ và yêu cầu nhận chìa khóa. SQLite trong bộ nhớ — chưa thay cho kiểm SQL Server thật.
/// </summary>
public sealed partial class D32RefundEvidenceTests
{
    private static MoveOutRequest CashMoveOut(params EvidencePhotoUpload[] photos) =>
        new(TodayVn, "09:00–09:30", "Đã dọn", null, null, null, true, photos, RefundMethod: "CASH");

    private static string Code(RentalContract c) => $"HĐ-{c.StartDate.Year}-{c.ContractId:0000}";

    /// <summary>Gửi trả kho rồi nhân viên gửi biên bản; cleaning/damage quyết định có khấu trừ hay không.</summary>
    private static async Task<long> InspectAsync(Fixture f, RentalContract c, bool cleaning, decimal damage, MoveOutRequest? move = null)
    {
        var res = await new ContractService(f.Db).RegisterMoveOutAsync(f.Customer.UserId, c.ContractId, move ?? MoveOut(Photo(Jpeg)));
        var ready = !cleaning && damage == 0;
        await f.Ops.SubmitReturnInspectionAsync(f.StaffActor, $"TK-{res.InspectionId:0000}", new OpsReturnInspectionRequest(
            "Đạt · không còn đồ", ready ? "Đạt · tường sàn cửa nguyên vẹn" : "Trầy cửa", "Đã nhận đủ chìa",
            ready ? "Sẵn sàng cho thuê lại" : "Cần bảo trì trước khi cho thuê lại",
            damage, cleaning, damage > 0 ? "Cửa cuốn" : null, cleaning || damage > 0 ? "Theo biên bản" : null,
            damage > 0 ? new[] { Photo(Jpeg) } : null));
        f.Db.ChangeTracker.Clear();
        return res.InspectionId;
    }

    // ------------------------------------------------------------------ D39 / D40

    [Fact]
    public async Task Deduction_BlocksSettlementFor48Hours_ThenAutoAgreesByStaffReport()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var inspectionId = await InspectAsync(f, c, cleaning: true, damage: 0);

        var view = await f.Ops.GetReturnDeductionAsync(f.Customer.UserId, Code(c));
        Assert.Equal("WAITING", view.Status);
        Assert.True(view.NeedsConfirmation);
        Assert.Equal(100_000m, view.CleaningFee);
        Assert.NotNull(view.DeadlineAt);
        // D30-13: hợp đồng còn hạn → không có phí quá hạn; biên bản ghi tên nhân viên lập.
        Assert.Equal(0m, view.OverdueFee);
        Assert.Equal(0, view.OverdueDays);
        Assert.False(string.IsNullOrWhiteSpace(view.StaffName));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c)));
        Assert.Contains("Chờ khách xác nhận", ex.Message);

        // Quá 48 giờ: khách không còn chọn được; chốt theo biên bản và ghi log tự đồng ý.
        var i = await f.Db.ReturnInspections.SingleAsync(x => x.InspectionId == inspectionId);
        i.InspectedAt = DateTime.UtcNow.AddHours(-49);
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        Assert.Equal("AUTO_AGREED", (await f.Ops.GetReturnDeductionAsync(f.Customer.UserId, Code(c))).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("AGREE", null)));

        Assert.Equal(1, await f.Ops.AutoSettleExpiredDeductionsAsync());
        f.Db.ChangeTracker.Clear();
        var refund = await f.Db.Payments.SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal(900_000m, refund.Amount); // 1.000.000 − vệ sinh 10% cọc
        Assert.Equal("BANK_TRANSFER", refund.PaymentMethod);
        // D44 (cách B): ghi nhật ký là Hệ thống, không gắn tên quản lý
        var auto = Assert.Single(await f.Db.ActivityLogs.Where(l => l.Action == "RETURN_DEDUCTION_AUTO_AGREED").ToListAsync());
        Assert.Null(auto.UserId);
        var settledLog = await f.Db.ActivityLogs.SingleAsync(l => l.Action == "DEPOSIT_REFUNDED");
        Assert.Null(settledLog.UserId);
        Assert.Contains("\"system\":true", settledLog.NewValue);
        Assert.Equal(0, await f.Ops.AutoSettleExpiredDeductionsAsync());
    }

    [Fact]
    public async Task Deduction_NoFeesNeedsNoConfirmation()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0);
        Assert.Equal("NONE", (await f.Ops.GetReturnDeductionAsync(f.Customer.UserId, Code(c))).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("AGREE", null)));
        Assert.Equal(1_000_000m, (await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c))).Refund);
    }

    [Fact]
    public async Task SelfClean_WaitsForRecheck_PassedRecheckWaivesCleaningFee()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var inspectionId = await InspectAsync(f, c, cleaning: true, damage: 0);
        var returnId = $"TK-{inspectionId:0000}";

        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("SELF_REPLACE", null)));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("DISPUTE", " ")));
        // Kiểm tra lại khi khách chưa chọn phương án → từ chối
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.RecheckReturnAsync(f.StaffActor, returnId, new ReturnRecheckRequest(true, null, "Đạt")));

        var decided = await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("SELF_CLEAN", "Tôi tự dọn chiều nay"));
        Assert.Equal("SELF_CLEAN", decided.Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("AGREE", null))); // chỉ chọn một lần
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c)));

        await f.Ops.RecheckReturnAsync(f.StaffActor, returnId, new ReturnRecheckRequest(true, null, "Khách đã dọn, đạt tiêu chuẩn"));
        f.Db.ChangeTracker.Clear();
        var i = await f.Db.ReturnInspections.AsNoTracking().SingleAsync(x => x.InspectionId == inspectionId);
        Assert.Equal(0m, i.CleaningFee);
        Assert.False(i.CleaningRequired);
        Assert.Equal("RECHECKED", (await f.Ops.GetReturnDeductionAsync(f.Customer.UserId, Code(c))).Status);
        Assert.Equal(1_000_000m, (await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c))).Refund);
    }

    [Fact]
    public async Task Dispute_FailedRecheckKeepsDamageFee()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        var inspectionId = await InspectAsync(f, c, cleaning: false, damage: 300_000m);
        await f.Ops.DecideReturnDeductionAsync(f.Customer.UserId, Code(c), new ReturnDeductionDecisionRequest("DISPUTE", "Vết trầy có từ trước"));
        await f.Ops.RecheckReturnAsync(f.ManagerActor, $"TK-{inspectionId:0000}", new ReturnRecheckRequest(null, false, "Ảnh bàn giao không có vết trầy"));
        f.Db.ChangeTracker.Clear();
        Assert.Equal(700_000m, (await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c))).Refund);
    }

    // ------------------------------------------------------------------ D42 · tiền mặt tại quầy

    [Fact]
    public async Task CashRefund_CustomerChoice_ManagerApproves_StaffPaysWithFourChecksOnce()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0, CashMoveOut(Photo(Jpeg)));
        var inspection = await f.Db.ReturnInspections.AsNoTracking().SingleAsync(i => i.ContractId == c.ContractId);
        Assert.Equal(RefundBank.CashMethod, inspection.RefundBankName);
        Assert.Null(inspection.RefundAccountNumber);
        Assert.Equal("Nguyễn Văn An", inspection.RefundAccountHolder);

        await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c));
        f.Db.ChangeTracker.Clear();
        var payment = await f.Db.Payments.SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal("CASH", payment.PaymentMethod);
        var listed = Assert.Single(await f.Ops.GetDepositRefundsAsync(f.ManagerActor));
        Assert.Equal("CASH", listed.Method);
        var cashId = listed.CashRefundId!;
        // Quản lý không ghi chuyển khoản cho khoản khách chọn tiền mặt
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmDepositRefundAsync(f.ManagerActor,
            new DepositRefundActionRequest("CONFIRM_DEPOSIT_REFUND", listed.Id, 1, "FT1", DateTime.UtcNow, true)));

        Assert.Equal("WAITING_APPROVAL", Assert.Single(await f.Ops.GetCashRefundsAsync(f.StaffActor)).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.PayCashRefundAsync(f.StaffActor, cashId, new CashRefundPayRequest(true, true, true, true)));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            f.Ops.ApproveCashRefundAsync(f.StaffActor, cashId, new OpsAssignRequest($"NV-{f.Staff.UserId:00}")));

        var approved = await f.Ops.ApproveCashRefundAsync(f.ManagerActor, cashId, new OpsAssignRequest($"NV-{f.Staff.UserId:00}"));
        Assert.Equal("READY", approved.Status);
        Assert.NotNull(approved.DeadlineDate);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Ops.PayCashRefundAsync(f.StaffActor, cashId, new CashRefundPayRequest(true, true, false, true)));
        var paid = await f.Ops.PayCashRefundAsync(f.StaffActor, cashId, new CashRefundPayRequest(true, true, true, true));
        Assert.Equal("PAID", paid.Status);
        Assert.Equal("Trần Nhân Viên", paid.PaidBy);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.PayCashRefundAsync(f.StaffActor, cashId, new CashRefundPayRequest(true, true, true, true)));
        f.Db.ChangeTracker.Clear();
        var done = await f.Db.Payments.SingleAsync(p => p.PaymentId == payment.PaymentId);
        Assert.Equal("PAID", done.Status);
        Assert.StartsWith($"CASH:{f.Staff.UserId}:", done.TransactionReference);
    }

    [Fact]
    public async Task CashRefund_RemindersAtDay10_AppointmentPauses_ExpiresAfter30Days()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0, CashMoveOut(Photo(Jpeg)));
        await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c));
        f.Db.ChangeTracker.Clear();
        var cashId = Assert.Single(await f.Ops.GetCashRefundsAsync(f.ManagerActor)).Id;
        await f.Ops.ApproveCashRefundAsync(f.ManagerActor, cashId, new OpsAssignRequest($"NV-{f.Staff.UserId:00}"));
        f.Db.ChangeTracker.Clear();

        async Task MoveApproval(int days)
        {
            var log = await f.Db.ActivityLogs.SingleAsync(l => l.Action == "CASH_REFUND_APPROVED");
            log.LoggedAt = DateTime.UtcNow.AddDays(-days);
            await f.Db.SaveChangesAsync();
            f.Db.ChangeTracker.Clear();
        }

        await MoveApproval(10);
        var remind = Assert.Single(await f.Ops.GetCashRefundsAsync(f.StaffActor));
        Assert.Equal("REMIND", remind.Status);
        Assert.Equal(10, remind.ReminderDay);
        var report = await f.Ops.GetDailyReportAsync(f.ManagerActor);
        Assert.Contains(report.Staff.Single(s => s.FullName == "Trần Nhân Viên").PendingTasks, t => t.Kind == "CASH_CALL");
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Ops.GetDailyReportAsync(f.StaffActor));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Ops.RecordCashRefundCallAsync(f.StaffActor, cashId, new CashRefundCallRequest("APPOINTMENT", null, null)));
        var appointment = await f.Ops.RecordCashRefundCallAsync(f.StaffActor, cashId,
            new CashRefundCallRequest("APPOINTMENT", TodayVn.AddDays(2), "Khách hẹn thứ bảy"));
        Assert.Equal("APPOINTMENT", appointment.Status);
        Assert.Equal(TodayVn.AddDays(2).ToString("yyyy-MM-dd"), appointment.AppointmentDate);

        await MoveApproval(31);
        f.Db.ChangeTracker.Clear();
        // D44: quá 30 ngày chưa nhận → khách mất khoản hoàn; không chi, không đổi sang chuyển khoản
        Assert.Equal("FORFEITED", Assert.Single(await f.Ops.GetCashRefundsAsync(f.StaffActor)).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            f.Ops.PayCashRefundAsync(f.StaffActor, cashId, new CashRefundPayRequest(true, true, true, true)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.SwitchCashRefundToBankAsync(f.Customer.UserId, cashId,
            new RefundBankInput("Vietcombank", "0123456789", "NGUYEN VAN AN")));
        Assert.Equal(1, await f.Ops.ForfeitExpiredCashRefundsAsync());
        Assert.Equal(0, await f.Ops.ForfeitExpiredCashRefundsAsync());
        var forfeitedPayment = await f.Db.Payments.AsNoTracking().SingleAsync(p => p.ContractId == c.ContractId && p.PaymentType == "REFUND");
        Assert.Equal("CANCELLED", forfeitedPayment.Status);
        Assert.StartsWith("FORFEITED:", forfeitedPayment.TransactionReference);
        Assert.Null((await f.Db.ActivityLogs.SingleAsync(l => l.Action == "CASH_REFUND_FORFEITED")).UserId);
        Assert.Equal("FORFEITED", Assert.Single(await f.Ops.GetCustomerCashRefundsAsync(f.Customer.UserId)).Status);

        // D45: khoản khách không nhận được cộng vào doanh thu, dòng riêng (báo cáo Vận hành KD và báo cáo cơ sở).
        var system = await new OperationsReportService(f.Db).GetSystemReportAsync(
            new StorageProject.Core.DTOs.Operations.ReportFilter(TodayVn.AddDays(-40), TodayVn.AddDays(40), null, null));
        Assert.Equal(forfeitedPayment.Amount, system.Totals.ForfeitedRefunds);
        var board = await f.Ops.GetBoardAsync(f.ManagerActor);
        Assert.Equal(Math.Round(forfeitedPayment.Amount / 1_000_000m, 1, MidpointRounding.AwayFromZero), board.Revenue!.ForfeitedRefunds);
    }

    [Fact]
    public async Task CancelledReservation_CashChoice_NeedsNoBankAndRejectsTransferEvidence()
    {
        await using var f = await Fixture.CreateAsync();
        var start = TodayVn.AddDays(5);
        var r = new Reservation
        {
            CustomerId = f.Customer.UserId, FacilityId = f.Facility.FacilityId, UnitTypeId = f.Type.UnitTypeId, StartDate = start,
            ExpectedEndDate = start.AddMonths(1), RentalPeriodMonths = 1, EstimatedAmount = 1_000_000m, RequiredDeposit = 1_000_000m,
            QuotedMonthlyRate = 1_000_000m, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow
        };
        f.Db.Reservations.Add(r);
        await f.Db.SaveChangesAsync();
        var now = DateTime.UtcNow;
        f.Db.Payments.AddRange(
            new Payment { ReservationId = r.ReservationId, PaymentType = "RENT", Amount = 1_000_000m, PaymentMethod = "CASH", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now },
            new Payment { ReservationId = r.ReservationId, PaymentType = "DEPOSIT", Amount = 1_000_000m, PaymentMethod = "CASH", Status = "PAID", PaidAt = now, CreatedAt = now, UpdatedAt = now });
        await f.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() => new ReservationService(f.Db).CancelReservationAsync(f.Customer.UserId, r.ReservationId,
            "Đổi kế hoạch", new RefundBankInput(null, null, null, "TIEN_MAT")));
        await new ReservationService(f.Db).CancelReservationAsync(f.Customer.UserId, r.ReservationId, "Đổi kế hoạch",
            new RefundBankInput(null, null, null, "CASH"));
        f.Db.ChangeTracker.Clear();
        var cancelled = await f.Db.Reservations.SingleAsync(x => x.ReservationId == r.ReservationId);
        Assert.Equal("CASH", cancelled.RefundBankName);
        Assert.Null(cancelled.RefundAccountNumber);
        var refund = await f.Db.Payments.SingleAsync(p => p.ReservationId == r.ReservationId && p.PaymentType == "REFUND");
        Assert.Equal("CASH", refund.PaymentMethod);

        var code = $"SS-{cancelled.CreatedAt.AddHours(7):yyyyMMdd}-{cancelled.ReservationId:0000}";
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Ops.ConfirmReservationRefundAsync(f.ManagerActor, code,
            new OpsReservationRefundRequest("BANK_TRANSFER", "FT26302000099", DateTime.UtcNow, true)));
        var cash = Assert.Single(await f.Ops.GetCashRefundsAsync(f.ManagerActor));
        Assert.Equal("RESERVATION", cash.Source);
        Assert.Equal(code, cash.Reference);
        // Sự cố cơ sở (T13) không có lựa chọn tiền mặt
        Assert.Throws<ArgumentException>(() => RefundBank.Validate(new RefundBankInput(null, null, null, "CASH"), "Nguyễn Văn An", allowCash: false));
    }

    [Fact]
    public async Task CashRefund_CustomerSwitchesToBankWithin30Days_ThenManagerRecordsTransfer()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync(deposit: 1_000_000m);
        await InspectAsync(f, c, cleaning: false, damage: 0, CashMoveOut(Photo(Jpeg)));
        await f.Ops.ConfirmRefundAsync(f.ManagerActor, Code(c));
        f.Db.ChangeTracker.Clear();
        var cashId = Assert.Single(await f.Ops.GetCustomerCashRefundsAsync(f.Customer.UserId)).Id;
        await f.Ops.ApproveCashRefundAsync(f.ManagerActor, cashId, new OpsAssignRequest($"NV-{f.Staff.UserId:00}"));
        f.Db.ChangeTracker.Clear();

        // Tên chủ tài khoản phải trùng hợp đồng; khách khác không đổi được
        await Assert.ThrowsAsync<ArgumentException>(() => f.Ops.SwitchCashRefundToBankAsync(f.Customer.UserId, cashId,
            new RefundBankInput("Vietcombank", "0123456789", "TRAN VAN B")));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Ops.SwitchCashRefundToBankAsync(f.Staff.UserId, cashId,
            new RefundBankInput("Vietcombank", "0123456789", "NGUYEN VAN AN")));
        var switched = await f.Ops.SwitchCashRefundToBankAsync(f.Customer.UserId, cashId,
            new RefundBankInput("Vietcombank", "0123456789", "Nguyen Van An"));
        Assert.Equal("SWITCHED_TO_BANK", switched.Status);
        f.Db.ChangeTracker.Clear();

        Assert.Empty(await f.Ops.GetCashRefundsAsync(f.StaffActor)); // nhân viên không còn việc chi / gọi nhắc
        var item = Assert.Single(await f.Ops.GetDepositRefundsAsync(f.ManagerActor));
        Assert.Equal("BANK_TRANSFER", item.Method);
        Assert.Equal("0123456789", item.AccountNumber);
        var paid = await f.Ops.ConfirmDepositRefundAsync(f.ManagerActor,
            new DepositRefundActionRequest("CONFIRM_DEPOSIT_REFUND", item.Id, item.Version, "FT26309000001", DateTime.UtcNow, true));
        Assert.Equal("PAID", paid.Status);
    }

    // ------------------------------------------------------------------ D35 / D36 · hỗ trợ

    [Fact]
    public async Task SupportTicket_StoresPhotos_AndKeyPickupSchedulesOneHandover()
    {
        await using var f = await Fixture.CreateAsync();
        var c = await f.ActiveContractAsync();
        var tickets = new SupportTicketService(f.Db);
        await Assert.ThrowsAsync<ArgumentException>(() => tickets.CreateTicketAsync(f.Customer.UserId,
            new CreateTicketRequest(c.ContractId, null, "LOCK", "Khoá kẹt", "Không mở được", "NORMAL", Enumerable.Repeat(Photo(Jpeg), 4).ToList())));
        var withPhoto = await tickets.CreateTicketAsync(f.Customer.UserId,
            new CreateTicketRequest(c.ContractId, null, "LOCK", "Khoá kẹt", "Không mở được", "NORMAL", [Photo(Jpeg)]));
        Assert.Equal(1, await f.Db.EvidencePhotos.CountAsync(p => p.OwnerType == EvidencePhotos.SupportTicket && p.OwnerId == withPhoto.TicketId));

        var key = await tickets.CreateTicketAsync(f.Customer.UserId,
            new CreateTicketRequest(c.ContractId, null, SupportTicketService.KeyPickupTopic, "", "Tôi muốn nhận chìa khóa", "NORMAL"));
        Assert.Equal(SupportTicketService.KeyPickupTitle, key.Title);
        Assert.Equal("ACCESS_CARD", key.IssueType);
        var handover = await f.Db.HandoverRecords.AsNoTracking().SingleAsync(h => h.ContractId == c.ContractId);
        Assert.Equal("SCHEDULED", handover.Status);
        Assert.Equal(f.Staff.UserId, handover.StaffId);
        await Assert.ThrowsAsync<InvalidOperationException>(() => tickets.CreateTicketAsync(f.Customer.UserId,
            new CreateTicketRequest(c.ContractId, null, SupportTicketService.KeyPickupTopic, "", "Gửi lại", "NORMAL")));
        Assert.Equal(1, await f.Db.HandoverRecords.CountAsync());
    }
}
