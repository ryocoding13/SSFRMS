// Lượt 3 (#24, #26, #27, #28): gia hạn thanh toán trong luồng, chọn tại quầy không còn hai trạng thái mâu thuẫn.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeData, mapCatalog } from "../src/shared/api/apiMappers.js";
import { reduce } from "../src/app/state/appReducer.js";
import { canPayLedger } from "../src/shared/utils/returnPolicy.js";
import { renewalState, renewalView } from "../src/features/customer/contracts/renewalStatusModel.js";

const NOW = new Date("2026-11-12T03:00:00Z");
const catalog = mapCatalog({
  facilities: [{ facilityId: 1, name: "SSFRMS Chi nhánh Tân Bình", address: "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh", openingTime: "07:00:00", closingTime: "22:00:00", status: "ACTIVE" }],
  unitTypes: [{ unitTypeId: 2, typeName: "Kho Tiêu Chuẩn M (2m x 2m)", area: 4, climateControlled: true, status: "ACTIVE" }],
  rates: [{ rateId: 2, facilityId: 1, unitTypeId: 2, monthlyRate: 1150000 }],
});
const session = { token: "t", user: { userId: 3, username: "customer01", fullName: "Nguyễn Văn An", email: "an@example.com" } };
const remoteWith = (renewal, payment) => ({
  reservations: [], reservationDetails: {}, tickets: [],
  contracts: [{
    contractId: 1, reservationId: 1, unitId: 3, unitNumber: "TB-M-103", facilityName: "SSFRMS Chi nhánh Tân Bình", unitTypeName: "Kho Tiêu Chuẩn M (2m x 2m)",
    startDate: "2026-09-07", endDate: "2026-12-07", agreedMonthlyRate: 1150000, depositAmount: 1150000, status: "ACTIVE",
    payments: [payment],
    renewals: [{ renewalId: 5, contractId: 1, oldEndDate: "2026-12-07", newEndDate: "2027-03-07", renewalPeriodMonths: 3, renewalAmount: 3450000, paymentDeadlineAt: "2026-11-13T03:00:00Z", ...renewal }],
  }],
});
const compose = remote => composeData({ catalog, remote, overlay: {}, session, timeoutSeconds: 60, now: NOW });
const PENDING_PAY = { paymentId: 30, contractId: 1, renewalId: 5, paymentType: "RENEWAL", amount: 3450000, status: "PENDING" };

test("#28: chọn tại quầy (máy chủ) → dòng gia hạn chờ thu tại quầy, không còn nút QR", () => {
  const d = compose(remoteWith({ status: "APPROVED", atCounter: true }, PENDING_PAY));
  const row = d.ledger.find(l => l.kind === "RENEWAL");
  assert.equal(row.status, "AT_COUNTER");
  assert.equal(row.payable, false);
  assert.equal(canPayLedger(row), false);
  assert.equal(renewalState(d, d.renewals[0], NOW.getTime()), "COUNTER");
  assert.equal(renewalView(d, d.renewals[0], NOW.getTime()).ledger, null, "không đưa dòng cho PayOS");
});

test("#26: chưa chọn phương thức → trả PayOS ngay trên màn gia hạn", () => {
  const d = compose(remoteWith({ status: "APPROVED" }, PENDING_PAY));
  const row = d.ledger.find(l => l.kind === "RENEWAL");
  assert.equal(row.status, "UNPAID");
  assert.equal(canPayLedger(row), true);
  const v = renewalView(d, d.renewals[0], NOW.getTime());
  assert.equal(v.state, "CHOOSE");
  assert.equal(v.ledger, row);
  assert.equal(v.methodLabel, "Chưa chọn");
});

test("#28: chế độ mô phỏng cũng chuyển dòng sổ thu khi chọn tại quầy", () => {
  const state = {
    renewals: [{ renewal_id: "GH-0005", contract_id: "HĐ-2026-0001", status: "APPROVED", old_end: "2026-12-07", new_end: "2027-03-07", amount: 3450000, months: 3, payment_deadline_at: "2026-11-13T03:00:00.000Z" }],
    ledger: [{ ref: "TT-0030", kind: "RENEWAL", contract_id: "HĐ-2026-0001", status: "UNPAID", payable: true, amount: 3450000, period: { from: "2026-12-07", to: "2027-03-07", months: 3 } }],
    reservations: [], contracts: [],
  };
  const out = reduce(state, { type: "CHOOSE_RENEWAL_AT_COUNTER", payload: { renewal_id: "GH-0005" } }, { now: NOW });
  assert.ifError(out.error);
  assert.equal(out.state.renewals[0].at_counter, true);
  assert.equal(out.state.ledger[0].status, "AT_COUNTER");
  assert.equal(canPayLedger(out.state.ledger[0]), false);
  assert.equal(renewalState(out.state, out.state.renewals[0], NOW.getTime()), "COUNTER");
});

test("#27: trạng thái hết hạn / đã trả rõ ràng", () => {
  const d = compose(remoteWith({ status: "APPROVED", paymentDeadlineAt: "2026-11-12T02:00:00Z" }, PENDING_PAY));
  assert.equal(renewalState(d, d.renewals[0], NOW.getTime()), "EXPIRED");
  const p = compose(remoteWith({ status: "PAID" }, { ...PENDING_PAY, status: "PAID" }));
  assert.equal(renewalView(p, p.renewals[0], NOW.getTime()).label, "Đã thanh toán · Đã gia hạn");
});

test("#24/#26: gửi gia hạn đi thẳng tới màn thanh toán gia hạn, ô đã có người đặt thì chặn", () => {
  const req = readFileSync(new URL("../src/features/customer/contracts/RenewalRequestPage.jsx", import.meta.url), "utf8");
  const move = readFileSync(new URL("../src/features/customer/contracts/RenewalUnitChangePage.jsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../src/features/customer/contracts/RenewalStatusPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(req, /go\("payments"\)/);
  assert.doesNotMatch(move, /go\("payments"\)/);
  assert.match(req, /bookedFrom/);
  assert.match(req, /renew-other/);
  assert.match(status, /PayosModal/);
  assert.doesNotMatch(status, /to="payments"/, "không vòng sang trang Thanh toán");
});
