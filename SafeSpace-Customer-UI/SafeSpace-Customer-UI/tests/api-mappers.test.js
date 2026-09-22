// Kiểm tra chuyển đổi dữ liệu backend (theo DbSeeder của StorageProject) sang dữ liệu giao diện.
import test from "node:test";
import assert from "node:assert/strict";
import { composeData, mapCatalog, parseUtc, reservationCode, reservationsToExpire, usernameFromEmail } from "../src/api/mappers.js";

const NOW = new Date("2026-09-22T05:00:00Z");
const catalogDto = {
  facilities: [
    { facilityId: 1, name: "SSFRMS Chi nhánh Tân Bình", address: "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh", contactPhone: "02838112233", openingTime: "07:00:00", closingTime: "22:00:00", status: "ACTIVE" },
    { facilityId: 2, name: "SSFRMS Chi nhánh Quận 7", address: "456 Nguyễn Thị Thập, Phường Tân Quy, Quận 7, TP. Hồ Chí Minh", contactPhone: null, openingTime: "06:00:00", closingTime: "23:00:00", status: "ACTIVE" },
  ],
  unitTypes: [
    { unitTypeId: 1, typeName: "Kho Mini S (1m x 1m)", area: 1.0, climateControlled: false, description: "Kho nhỏ", status: "ACTIVE" },
    { unitTypeId: 2, typeName: "Kho Tiêu Chuẩn M (2m x 2m)", area: 4.0, climateControlled: true, description: "Kho điều hòa", status: "ACTIVE" },
    { unitTypeId: 3, typeName: "Kho Lớn L (3m x 3m)", area: 9.0, climateControlled: true, status: "ACTIVE" },
    { unitTypeId: 4, typeName: "Kho Doanh Nghiệp XL (4m x 4m)", area: 16.0, climateControlled: true, status: "ACTIVE" },
  ],
  rates: [
    { rateId: 1, facilityId: 1, unitTypeId: 1, monthlyRate: 500000 },
    { rateId: 2, facilityId: 1, unitTypeId: 2, monthlyRate: 1500000 },
    { rateId: 3, facilityId: 1, unitTypeId: 3, monthlyRate: 3000000 },
    { rateId: 7, facilityId: 2, unitTypeId: 4, monthlyRate: 5500000 },
  ],
};
const catalog = mapCatalog(catalogDto);
const session = { token: "t", user: { userId: 3, username: "customer01", fullName: "Nguyễn Văn An", email: "an.nguyen@example.com" } };
const remote = {
  reservations: [
    { reservationId: 1, facilityId: 1, facilityName: "SSFRMS Chi nhánh Tân Bình", unitTypeId: 2, unitTypeName: "Kho Tiêu Chuẩn M (2m x 2m)", startDate: "2026-09-07", expectedEndDate: "2026-12-07", rentalPeriodMonths: 3, quotedMonthlyRate: 1500000, estimatedAmount: 4500000, requiredDeposit: 1500000, status: "CHECKED_IN", expiresAt: "2026-09-07T05:00:00", createdAt: "2026-09-06T05:00:00" },
    { reservationId: 2, facilityId: 1, facilityName: "SSFRMS Chi nhánh Tân Bình", unitTypeId: 1, unitTypeName: "Kho Mini S (1m x 1m)", startDate: "2026-09-27", expectedEndDate: "2026-10-27", rentalPeriodMonths: 1, quotedMonthlyRate: 500000, estimatedAmount: 500000, requiredDeposit: 500000, status: "PENDING_PAYMENT", expiresAt: "2026-09-23T04:00:00", createdAt: "2026-09-22T04:00:00" },
  ],
  reservationDetails: { 1: { reservationId: 1, contractId: 1, assignedUnitNumber: "TB-M-103", checkInAppointmentAt: "2026-09-07T02:00:00" } },
  contracts: [
    {
      contractId: 1, reservationId: 1, unitId: 3, unitNumber: "TB-M-103", facilityName: "SSFRMS Chi nhánh Tân Bình", unitTypeName: "Kho Tiêu Chuẩn M (2m x 2m)",
      startDate: "2026-09-07", endDate: "2026-12-07", agreedMonthlyRate: 1500000, depositAmount: 1500000, status: "ACTIVE",
      handover: { handoverId: 1, status: "HANDED_OVER", customerConfirmed: true, staffConfirmed: true },
      payments: [
        { paymentId: 1, contractId: 1, paymentType: "DEPOSIT", amount: 1500000, transactionReference: "VNPAY-DEP-10001", status: "PAID" },
        { paymentId: 2, contractId: 1, paymentType: "RENT", amount: 1500000, transactionReference: "VNPAY-RENT-10002", status: "PAID" },
      ],
      renewals: [{ renewalId: 5, contractId: 1, oldEndDate: "2026-12-07", newEndDate: "2027-03-07", renewalPeriodMonths: 3, renewalAmount: 4500000, status: "PENDING_PAYMENT", requestedAt: "2026-09-21T03:00:00" }],
    },
  ],
  tickets: [{ ticketId: 1, contractId: 1, issueType: "UNIT", title: "Kiểm tra nhiệt độ phòng kho", description: "Nhờ kiểm tra", priority: "NORMAL", status: "OPEN", createdAt: "2026-09-20T05:00:00" }],
};
const compose = (overlay = {}, now = NOW) => composeData({ catalog, remote, overlay, session, timeoutSeconds: 60, now });

test("parseUtc: giờ không múi từ ASP.NET được hiểu là UTC", () => {
  assert.equal(parseUtc("2026-09-22T04:00:00").toISOString(), "2026-09-22T04:00:00.000Z");
  assert.equal(parseUtc("2026-09-22T04:00:00.1234567Z").toISOString(), "2026-09-22T04:00:00.123Z");
  assert.equal(parseUtc(null), null);
});

test("danh mục: cơ sở, quận / thành phố, giờ mở cửa và gói kho theo bảng giá", () => {
  const [tb, q7] = catalog.facilities;
  assert.equal(tb.district, "Quận Tân Bình");
  assert.equal(tb.city, "TP. Hồ Chí Minh");
  assert.equal(tb.hours, "07:00–22:00");
  assert.deepEqual(tb.offers.map((o) => [o.unit_type_id, o.type, o.band, o.monthly_rate]), [
    [1, "normal", "S", 500000],
    [2, "climate", "S", 1500000],
    [3, "climate", "M", 3000000],
  ]);
  assert.equal(tb.offers[1].size_label, "4 m²");
  assert.deepEqual(q7.offers.map((o) => o.unit_type_id), [4]);
});

test("đơn đặt chỗ: mã hiển thị, trạng thái, tổng ban đầu", () => {
  const d = compose();
  const [r1, r2] = d.reservations;
  assert.equal(r1.reservation_id, reservationCode(remote.reservations[0]));
  assert.equal(r1.reservation_id, "SS-20260906-0001");
  assert.equal(r1.status, "CHECKED_IN");
  assert.equal(r2.status, "PENDING_PAYMENT");
  assert.equal(r2.initial_total, 1000000);
  assert.equal(r2.timeout_seconds, 86400); // đơn tạo ngoài trình duyệt này: theo hạn 24h của backend
});

test("giữ chỗ trong trình duyệt: 60 giây, báo chuyển khoản → chờ đối soát, hết giờ → huỷ", () => {
  const hold = { holds: { 2: NOW.getTime() - 10000 } };
  assert.equal(compose(hold).reservations[1].status, "PENDING_PAYMENT");
  assert.equal(compose(hold).reservations[1].timeout_seconds, 60);
  const late = compose(hold, new Date(NOW.getTime() + 55000)).reservations[1];
  assert.equal(late.status, "CANCELLED");
  assert.equal(late.cancel_reason, "Quá 1 phút chưa xác nhận");
  assert.equal(reservationsToExpire({ remote, overlay: { holds: hold.holds, transfers: {} }, timeoutSeconds: 60, now: new Date(NOW.getTime() + 55000) }).length, 1);
  const paid = compose({ ...hold, transfers: { 2: NOW.getTime() } }, new Date(NOW.getTime() + 55000));
  assert.equal(paid.reservations[1].status, "PENDING_VERIFICATION");
  assert.deepEqual(paid.ledger.filter((l) => l.status === "PENDING_VERIFICATION").map((l) => l.amount).sort(), [500000, 500000]);
});

test("hợp đồng, thanh toán, gia hạn, lịch nhận kho, hỗ trợ", () => {
  const d = compose();
  const c = d.contracts[0];
  assert.equal(c.contract_id, "HĐ-2026-0001");
  assert.equal(c.facility_id, 1);
  assert.equal(c.type, "climate");
  assert.equal(c.size_m2, 4);
  assert.equal(c.months, 3);
  assert.equal(c.handed_over, true);
  assert.equal(d.reservations[0].contract_id, "HĐ-2026-0001");
  assert.deepEqual(d.ledger.map((l) => [l.kind, l.status]), [["DEPOSIT", "DEPOSIT_HELD"], ["RENT", "RECONCILED"], ["RENEWAL", "RENEWAL_PENDING"]]);
  assert.equal(d.renewals[0].status, "PENDING");
  assert.equal(d.appointments[0].unit_number, "TB-M-103");
  assert.equal(d.appointments[0].status, "DONE");
  assert.equal(d.tickets[0].ticket_id, "HT-0001");
  assert.equal(d.tickets[0].topic, "UNIT");
  assert.equal(d.tickets[0].title, "Kiểm tra nhiệt độ phòng kho");
});

test("phần lưu cục bộ: tên hiển thị, lịch trả kho, thông báo được ghép vào", () => {
  const d = compose({ name: "An Nguyễn", phone: "0912345678", returns: [{ return_id: "TK-0001", contract_id: "HĐ-2026-0001", status: "PENDING" }], notifications: [{ id: "N-1", read: false }] });
  assert.equal(d.user.full_name, "An Nguyễn");
  assert.equal(d.user.phone, "0912345678");
  assert.equal(d.returns.length, 1);
  assert.equal(d.notifications.length, 1);
});

test("tên đăng nhập backend sinh từ email (≤ 50 ký tự)", () => {
  assert.equal(usernameFromEmail(" Mai.Tran@Example.com "), "mai.tran@example.com");
  assert.ok(usernameFromEmail(`${"a".repeat(60)}@example.com`).length <= 50);
});
