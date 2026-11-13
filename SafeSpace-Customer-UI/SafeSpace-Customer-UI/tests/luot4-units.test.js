// Lượt 4 (#2, #22, #47): tự bố trí ô khi đặt kho, sự cố kho đang thuê, bảng kho tách Sử dụng / Vận hành / Cửa.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSeedData } from "../src/app/data/appSeed.js";
import { reduce, proposeUnit } from "../src/app/state/appReducer.js";
import { unitBoardView, unitActions, incidentLink, BOARD_TABS } from "../src/features/manager/units/unitBoardModel.js";
import { UNIT_TRANSITIONS } from "../src/features/facility-operations/state/facilityOperationsReducer.js";
import { createOpsData } from "../src/features/facility-operations/data/facilityOperationsSeed.js";
import { unitsFor } from "../src/shared/utils/units.js";

const NOW = new Date("2026-11-12T09:00:00");
const run = (state, payload) => reduce(state, { type: "CREATE_RESERVATION", payload }, { now: NOW, timeoutSeconds: 60 });

test("#2: tạo đơn → hệ thống bố trí ô khả dụng cả kỳ, đơn sau không trùng ô đơn trước", () => {
  let state = createSeedData();
  const f = state.facilities[0];
  const offer = f.offers.find(o => unitsFor(f).filter(u => u.offer_key === o.key && u.bookable_for_period).length >= 2);
  assert.ok(offer, "cơ sở mẫu có loại kho còn ít nhất 2 ô trống");
  const free = unitsFor(f).filter(u => u.offer_key === offer.key && u.bookable_for_period).map(u => u.code);
  const a = run(state, { facility_id: f.facility_id, offer_key: offer.key, months: 3, start_date: "2026-11-20" });
  assert.ifError(a.error); state = a.state;
  const first = state.reservations.find(r => r.reservation_id === a.result.reservation_id);
  assert.equal(first.unit_code, free[0]);
  assert.equal(first.unit_assigned, false);
  const b = run(state, { facility_id: f.facility_id, offer_key: offer.key, months: 1, start_date: "2026-11-21" });
  assert.ifError(b.error);
  assert.equal(b.state.reservations.find(r => r.reservation_id === b.result.reservation_id).unit_code, free[1]);
});

test("#2: hết ô cả kỳ → báo rõ, không tạo đơn và không bắt chọn ô trên sơ đồ", () => {
  const state = createSeedData();
  const f = state.facilities[0];
  const offer = f.offers[0];
  const taken = unitsFor(f).filter(u => u.offer_key === offer.key).map((u, i) => ({ reservation_id: `R${i}`, facility_id: f.facility_id, unit_code: u.code, status: "CONFIRMED", start_date: "2026-11-01", end_date: "2027-06-01" }));
  const full = { ...state, reservations: [...state.reservations, ...taken] };
  assert.equal(proposeUnit(full, f, offer, "2026-11-20", "2027-02-20"), null);
  const out = run(full, { facility_id: f.facility_id, offer_key: offer.key, months: 3, start_date: "2026-11-20" });
  assert.ok(out.error);
  assert.match(out.error.message, /toàn bộ kỳ thuê/);
  assert.equal(out.state.reservations.length, full.reservations.length);
});

test("#2: trang đặt kho không chặn vì ô xem trên sơ đồ, bước 2/3 hiện ô được bố trí", () => {
  const detail = readFileSync(new URL("../src/features/customer/facilities/FacilityDetailPage.jsx", import.meta.url), "utf8");
  const review = readFileSync(new URL("../src/features/customer/payments/ReservationReviewPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(detail, /unitBlocked/);
  assert.doesNotMatch(detail, /unit_code: unit\?\.code/);
  assert.match(review, /Ô hệ thống bố trí cho bạn/);
  assert.match(review, /Khả dụng cả kỳ/);
});

test("#47: ba trạng thái độc lập; sử dụng theo hợp đồng, cửa mô phỏng có thời điểm", () => {
  const v = unitBoardView({ code: "A-105", status: "ACTIVE", usage: "RENTED", operation: "MAINTENANCE", door: "OPEN", door_at: "2026-11-12T14:32:00", contract: "HĐ-2026-0150", incident: "SC-0150-1" });
  assert.deepEqual([v.usage, v.operation, v.door, v.doorAt], ["RENTED", "MAINTENANCE", "OPEN", "2026-11-12T14:32:00"]);
  // Dữ liệu cũ không có trường mới → suy từ status, cửa mặc định đã khóa
  const old = unitBoardView({ code: "K06", status: "EMPTY" });
  assert.deepEqual([old.usage, old.operation, old.door, old.doorAt], ["FREE", "ACTIVE", "LOCKED", null]);
  assert.equal(unitBoardView({ code: "K01", status: "WAITING_HANDOVER", booked_from: "2026-11-18" }).usage, "FREE");
  const ops = createOpsData("2026-11-12");
  const views = ops.units.map(unitBoardView);
  for (const [, , fn] of BOARD_TABS) assert.equal(typeof fn, "function");
  assert.ok(views.some(x => x.door === "OPEN" && x.doorAt), "có ô cửa đang mở kèm thời điểm");
});

test("#22/#47: ô có người thuê không đổi tay thành trống, vẫn ghi nhận sự cố theo hợp đồng", () => {
  const rented = { code: "A-102", status: "ACTIVE", usage: "RENTED", contract: "HĐ-2026-0142" };
  const act = unitActions(rented, unitBoardView(rented), UNIT_TRANSITIONS);
  assert.deepEqual(act, { incident: "RECORD", status: false, edit: false });
  assert.equal(incidentLink(unitBoardView(rented)), `manager/incidents?contract=${encodeURIComponent("HĐ-2026-0142")}`);
  const withCase = { ...rented, incident: "SC-0142-1" };
  assert.equal(unitActions(withCase, unitBoardView(withCase), UNIT_TRANSITIONS).incident, "VIEW");
  assert.equal(incidentLink(unitBoardView(withCase)), "manager/incidents?id=SC-0142-1");
  const empty = { code: "K06", status: "EMPTY" };
  assert.deepEqual(unitActions(empty, unitBoardView(empty), UNIT_TRANSITIONS), { incident: null, status: true, edit: true });
  assert.ok(!UNIT_TRANSITIONS.ACTIVE && !UNIT_TRANSITIONS.EXPIRING, "không có chuyển tay cho ô đang thuê");
});

test("D56: chế độ EXACT giữ đúng ô khách chọn từ sơ đồ, bước 2 hiện 'Ô bạn đã chọn'", () => {
  let state = createSeedData();
  const f = state.facilities[0];
  const offer = f.offers[0];
  const targetUnit = unitsFor(f).find(u => u.offer_key === offer.key && u.bookable_for_period);
  assert.ok(targetUnit, "tìm được ô khả dụng để chọn");

  const action = run(state, {
    facility_id: f.facility_id,
    offer_key: offer.key,
    months: 1,
    start_date: "2026-11-20",
    selected_unit_id: targetUnit.unit_id || 101,
    unit_code: targetUnit.code
  });

  assert.ifError(action.error);
  const created = action.state.reservations.find(r => r.reservation_id === action.result.reservation_id);
  assert.equal(created.unit_code, targetUnit.code);
  assert.equal(created.allocation_mode, "EXACT");

  // Kiểm tra file ReservationReviewPage phân biệt nhãn EXACT và AUTO
  const review = readFileSync(new URL("../src/features/customer/payments/ReservationReviewPage.jsx", import.meta.url), "utf8");
  assert.match(review, /Ô bạn đã chọn/);
  assert.match(review, /Ô hệ thống bố trí cho bạn/);
});
