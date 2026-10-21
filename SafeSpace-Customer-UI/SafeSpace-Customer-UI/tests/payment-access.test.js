import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/shared/api/httpClient.js";
import { directionsUrl, isUnsupported, localAccessCode, normAccess, normCancelPreview, normPayos, normScan } from "../src/features/customer/access/accessApi.js";
import { composeData } from "../src/shared/api/apiMappers.js";

test("PayOS: chuẩn hoá PayosCheckoutDto, thiếu QR lẫn link thì coi như không có", () => {
  const c = normPayos({ orderCode: 142, amount: 4600000, qrCode: "000201...", checkoutUrl: "https://pay.payos.vn/web/abc", expiredAt: "2026-09-21T02:10:00", status: "PENDING" });
  assert.equal(c.amount, 4600000);
  assert.equal(c.url, "https://pay.payos.vn/web/abc");
  assert.equal(c.expires_at, "2026-09-21T02:10:00.000Z");
  assert.equal(c.paid, false);
  assert.equal(normPayos({ orderCode: 1 }), null);
  assert.equal(normPayos({ qrCode: "x", status: "paid" }).paid, true);
});

test("backend chưa có endpoint (404/405) → isUnsupported, lỗi khác thì không", () => {
  assert.ok(isUnsupported(new ApiError("x", 404)));
  assert.ok(isUnsupported(new ApiError("x", 405)));
  assert.ok(!isUnsupported(new ApiError("x", 400)));
  assert.ok(!isUnsupported(new Error("x")));
});

test("QR mở cửa, máy quét, xem trước hoàn tiền", () => {
  assert.equal(normAccess({}), null);
  assert.deepEqual(normAccess({ code: "SSQR-1", backupCode: "4821 9037", unitNumber: "B-015", validUntil: "2026-09-25T00:00:00" }).valid_until, "2026-09-25");
  assert.equal(normScan({ result: "open", unitNumber: "B-015" }).result, "OPEN");
  const denied = normScan({ result: "DENIED" });
  assert.equal(denied.result, "DENIED");
  assert.ok(denied.reason);
  assert.deepEqual(normCancelPreview({ paidAmount: 4600000, cancellationFee: 345000 }), { paid: 4600000, fee: 345000, refund: 4255000, policy: null });
  assert.equal(normCancelPreview({}), null);
  const a = localAccessCode({ contract_id: "HĐ-2026-0086", unit_number: "B-015", end_date: "2026-09-25" });
  assert.match(a.backup, /^\d{4} \d{4}$/);
  assert.equal(localAccessCode({ contract_id: "HĐ-2026-0086", unit_number: "B-015" }).code, a.code);
});

test("chỉ đường: ưu tiên toạ độ, không có thì theo tên + địa chỉ", () => {
  assert.match(directionsUrl({ lat: 10.7, lng: 106.7 }), /destination=10\.7%2C106\.7$/);
  assert.match(directionsUrl({ lat: null, lng: null, name: "SafeSpace Him Lam", address: "Quận 7" }), /SafeSpace%20Him%20Lam%2C%20Qu/);
});

test("mappers: khoản gia hạn chưa trả có nút thanh toán, phản hồi hỗ trợ, đơn trả tại cửa hàng", () => {
  const remote = {
    reservations: [{ reservationId: 7, facilityId: 1, facilityName: "SafeSpace A", unitTypeId: 1, unitTypeName: "M", startDate: "2026-10-01", expectedEndDate: "2027-01-01", rentalPeriodMonths: 3, quotedMonthlyRate: 1, estimatedAmount: 3, requiredDeposit: 1, status: "PENDING_AT_FACILITY", createdAt: "2026-09-21T02:00:00" }],
    reservationDetails: {},
    contracts: [{
      contractId: 3, reservationId: 9, facilityName: "SafeSpace A", unitNumber: "K02", unitTypeName: "M", startDate: "2026-06-01", endDate: "2026-09-01", agreedMonthlyRate: 1, depositAmount: 1, status: "ACTIVE",
      payments: [{ paymentId: 51, renewalId: 4, paymentType: "RENEWAL", amount: 3, status: "PENDING" }],
      renewals: [{ renewalId: 4, renewalPeriodMonths: 3, oldEndDate: "2026-09-01", newEndDate: "2026-12-01", renewalAmount: 3, status: "APPROVED" }],
    }],
    tickets: [{ ticketId: 82, contractId: 3, issueType: "ACCESS", title: "Lỗi", status: "RESOLVED", createdAt: "2026-09-14T02:40:00", responses: [{ message: "Đã đổi thẻ", staffName: "Long", createdAt: "2026-09-14T04:02:00" }] }],
  };
  const d = composeData({ catalog: { facilities: [], unitTypes: [] }, remote, overlay: {}, session: { user: { userId: 1, fullName: "Mai" } }, timeoutSeconds: 600, now: new Date("2026-09-21T03:00:00Z") });
  const row = d.ledger.find((l) => l.kind === "RENEWAL");
  assert.equal(row.payable, true);
  assert.equal(row.api_id, 51);
  assert.equal(row.label, "Gia hạn K02 · 3 tháng");
  assert.deepEqual(row.period, { from: "2026-09-01", to: "2026-12-01", months: 3 });
  assert.equal(d.tickets[0].responses[0].text, "Đã đổi thẻ");
  assert.equal(d.reservations[0].status, "PENDING_VERIFICATION");
  assert.equal(d.reservations[0].pay_at_facility, true);
});
