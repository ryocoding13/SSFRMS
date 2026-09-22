import test from "node:test";
import assert from "node:assert/strict";
import { createSeedData, createEmptyData } from "../src/data/seed.js";
import { reduce, sweepExpired, validateRegister } from "../src/state/reducer.js";
import { contractStatus, milestones } from "../src/state/selectors.js";
import { quote, searchFacilities, rateFor } from "../src/lib/catalog.js";
import { addMonths, maskPhone, formatCountdown } from "../src/lib/format.js";

const NOW = new Date("2026-09-21T09:00:00");
const T = "2026-09-21";
const run = (state, type, payload, now = NOW) => reduce(state, { type, payload }, { now, timeoutSeconds: 60 });
const book = (state, over = {}) =>
  run(state, "CREATE_RESERVATION", { facility_id: 1, type: "normal", band: "M", months: 3, start_date: T, ...over });

test("báo giá khớp Figma: 3 × 1.150.000 + cọc 1.150.000 = 4.600.000", () => {
  const s = createSeedData(T);
  const q = quote({ facility: s.facilities[0], type: "normal", band: "M", months: 3, start_date: T });
  assert.equal(q.monthly_rate, 1150000);
  assert.equal(q.rent_total, 3450000);
  assert.equal(q.deposit, 1150000);
  assert.equal(q.initial_total, 4600000);
  assert.equal(q.end_date, addMonths(T, 3));
});

test("đặt chỗ: tạo đơn chờ chuyển khoản có hạn giữ chỗ 60 giây", () => {
  const s = createSeedData(T);
  const out = book(s);
  assert.ok(out.result.reservation_id.startsWith("SS-20260921-"));
  const r = out.state.reservations.find((x) => x.reservation_id === out.result.reservation_id);
  assert.equal(r.status, "PENDING_PAYMENT");
  assert.equal(new Date(r.expires_at) - NOW, 60000);
});

test("đặt chỗ: không tạo trùng khi bấm hai lần", () => {
  const s = createSeedData(T);
  const a = book(s);
  const b = book(a.state);
  assert.equal(b.result.reservation_id, a.result.reservation_id);
  assert.equal(b.state.reservations.length, a.state.reservations.length);
});

test("đặt chỗ: kiểm tra đầu vào", () => {
  const s = createSeedData(T);
  assert.match(book(s, { start_date: "2026-09-20" }).error.message, /quá khứ/);
  assert.match(book(s, { months: 2 }).error.message, /1, 3 hoặc 6/);
  assert.match(book(s, { facility_id: 8, type: "climate" }).error.message, /chưa có loại kho/);
  assert.match(book(s, { band: "X" }).error.message, /diện tích/);
});

test("chuyển khoản trong hạn: chờ đối soát, sinh 2 khoản thu, thông báo", () => {
  const s = createSeedData(T);
  const { state, result } = book(s);
  const ok = run(state, "CONFIRM_TRANSFER", { reservation_id: result.reservation_id }, new Date(NOW.getTime() + 30000));
  assert.equal(ok.state.reservations[0].status, "PENDING_VERIFICATION");
  assert.equal(ok.state.ledger.length, s.ledger.length + 2);
  assert.equal(ok.state.ledger.at(-2).status, "PENDING_VERIFICATION");
  assert.equal(ok.state.notifications.length, s.notifications.length + 1);
});

test("chuyển khoản sau hạn: bị chặn và đơn tự huỷ (C04b)", () => {
  const s = createSeedData(T);
  const { state, result } = book(s);
  const late = run(state, "CONFIRM_TRANSFER", { reservation_id: result.reservation_id }, new Date(NOW.getTime() + 61000));
  assert.equal(late.error.code, "EXPIRED");
  const r = late.state.reservations[0];
  assert.equal(r.status, "CANCELLED");
  assert.equal(r.cancel_reason, "Quá 1 phút chưa xác nhận");
  assert.equal(late.state.ledger.length, s.ledger.length);
});

test("sweepExpired chỉ huỷ đơn chờ chuyển khoản đã quá hạn", () => {
  const s = createSeedData(T);
  const { state } = book(s);
  assert.equal(sweepExpired(state, new Date(NOW.getTime() + 59000)), state);
  const swept = sweepExpired(state, new Date(NOW.getTime() + 60000));
  assert.equal(swept.reservations[0].status, "CANCELLED");
  assert.equal(swept.reservations.filter((r) => r.status === "PENDING_VERIFICATION").length, 1);
});

test("gia hạn: chỉ 1 yêu cầu chờ duyệt, chặn trả kho song song, hiện ở khoản thu", () => {
  const s = createSeedData(T);
  const a = run(s, "REQUEST_RENEWAL", { contract_id: "HĐ-2026-0086", months: 3 });
  assert.equal(a.state.renewals[0].status, "PENDING");
  assert.equal(a.state.renewals[0].new_end, addMonths(s.contracts[1].end_date, 3));
  assert.equal(a.state.ledger.at(-1).status, "RENEWAL_PENDING");
  assert.equal(a.state.ledger.at(-1).amount, 3 * 500000);
  assert.match(run(a.state, "REQUEST_RENEWAL", { contract_id: "HĐ-2026-0086", months: 1 }).error.message, /đang chờ/);
  assert.match(run(a.state, "REQUEST_RETURN", { contract_id: "HĐ-2026-0086", date: T, slot: "09:00–09:30" }).error.message, /gia hạn/);
  assert.match(run(s, "REQUEST_RENEWAL", { contract_id: "HĐ-2026-0086", months: 2 }).error.message, /1, 3 hoặc 6/);
});

test("trả kho: tạo lịch hẹn chờ xác nhận, không đổi trạng thái hợp đồng", () => {
  const s = createSeedData(T);
  const a = run(s, "REQUEST_RETURN", { contract_id: "HĐ-2026-0142", date: "2026-12-21", slot: "09:00–09:30", notes: "  ok " });
  assert.equal(a.state.returns[0].notes, "ok");
  assert.equal(a.state.appointments[0].kind, "MOVE_OUT");
  assert.equal(a.state.appointments[0].status, "PENDING");
  assert.equal(a.state.contracts.find((c) => c.contract_id === "HĐ-2026-0142").status, "ACTIVE");
  assert.match(run(s, "REQUEST_RETURN", { contract_id: "HĐ-2026-0142", date: "2026-09-20", slot: "09:00–09:30" }).error.message, /quá khứ/);
});

test("hợp đồng: trạng thái suy ra theo ngày (30 ngày → sắp hết hạn)", () => {
  const s = createSeedData(T);
  assert.equal(contractStatus(s.contracts[0], NOW), "ACTIVE");
  assert.equal(contractStatus(s.contracts[1], NOW), "EXPIRING");
  assert.equal(contractStatus({ ...s.contracts[1], end_date: "2026-09-01" }, NOW), "OVERDUE");
});

test("hỗ trợ: tạo, huỷ (chỉ khi mới gửi), yêu cầu đang xử lý không huỷ được", () => {
  const s = createSeedData(T);
  assert.match(run(s, "CREATE_TICKET", { contract_id: "HĐ-2026-0142", topic: "ACCESS", description: "  " }).error.message, /mô tả/);
  const a = run(s, "CREATE_TICKET", { contract_id: "HĐ-2026-0142", topic: "LOCK", description: "Mất chìa", attachments: ["a.png"] });
  const id = a.result.ticket_id;
  assert.equal(id, "HT-0083");
  assert.equal(run(a.state, "CANCEL_TICKET", { ticket_id: id }).state.tickets[0].status, "CANCELLED");
  assert.match(run(a.state, "CANCEL_TICKET", { ticket_id: "HT-0082" }).error.message, /không thể huỷ/);
});

test("hồ sơ: đổi tên, đổi mật khẩu kiểm tra mật khẩu hiện tại", () => {
  const s = createSeedData(T);
  assert.equal(run(s, "UPDATE_NAME", { name: " Mai B " }).state.user.full_name, "Mai B");
  assert.equal(run(s, "CHANGE_PASSWORD", { current: "sai", next: "MatKhauMoi1" }).error.code, "BAD_PASSWORD");
  assert.match(run(s, "CHANGE_PASSWORD", { current: "SafeSpace@123", next: "ngan" }).error.message, /8 ký tự/);
  assert.equal(run(s, "CHANGE_PASSWORD", { current: "SafeSpace@123", next: "MatKhauMoi1" }).state.user.password, "MatKhauMoi1");
});

test("nhân viên đối soát: tạo hợp đồng + lịch nhận kho, khoản thu chuyển trạng thái", () => {
  const s = createSeedData(T);
  const b = book(s).state;
  const id = b.reservations[0].reservation_id;
  const c = run(b, "CONFIRM_TRANSFER", { reservation_id: id }).state;
  const d = run(c, "STAFF_CONFIRM_PAYMENT", { reservation_id: id });
  assert.equal(d.state.reservations[0].status, "CONFIRMED");
  assert.equal(d.state.contracts.length, s.contracts.length + 1);
  assert.equal(d.state.appointments[0].kind, "CHECK_IN");
  const mine = d.state.ledger.filter((l) => l.reservation_id === id).map((l) => l.status).sort();
  assert.deepEqual(mine, ["DEPOSIT_HELD", "RECONCILED"]);
});

test("tìm cơ sở: lọc khu vực Quận 7 → 3 cơ sở; kho lạnh loại bỏ cơ sở không có; sắp xếp giá", () => {
  const s = createSeedData(T);
  const q7 = searchFacilities(s.facilities, { area: "Quận 7, TP. Hồ Chí Minh" });
  assert.deepEqual(q7.map((f) => f.facility_id), [1, 2, 3]);
  const cold = searchFacilities(s.facilities, { type: "climate" });
  assert.ok(cold.every((f) => f.has_climate) && cold.length === 9);
  const cheap = searchFacilities(s.facilities, { sort: "price" });
  assert.equal(cheap[0].facility_id, 8); // Bình Chánh 790.000
  assert.equal(rateFor(s.facilities[0], "normal", "M"), 1150000);
  assert.equal(searchFacilities(s.facilities, { budget: true }).some((f) => f.facility_id === 5), false); // 1.250.000
});

test("mốc sắp tới sắp theo ngày và phản ánh yêu cầu gia hạn đang chờ", () => {
  const s = createSeedData(T);
  const a = run(s, "REQUEST_RENEWAL", { contract_id: "HĐ-2026-0086", months: 3 }).state;
  const m = milestones(a, NOW);
  assert.equal(m.length, 3);
  assert.ok(m[0].date <= m[1].date && m[1].date <= m[2].date);
  assert.ok(m.some((x) => x.detail === "Yêu cầu gia hạn đang chờ cơ sở duyệt"));
});

test("đăng ký: kiểm tra đủ trường, khớp mật khẩu; dữ liệu tài khoản mới rỗng", () => {
  const e = validateRegister({ name: "", email: "x", phone: "1", password: "1", confirm: "2" });
  assert.deepEqual(Object.keys(e).sort(), ["confirm", "email", "name", "password", "phone"]);
  assert.deepEqual(validateRegister({ name: "A", email: "a@b.co", phone: "0912345678", password: "Abcdefg1", confirm: "Abcdefg1" }), {});
  const d = createEmptyData({ user_id: 1, full_name: "A", email: "a@b.co", phone: "0912345678" }, T);
  assert.equal(d.contracts.length + d.reservations.length + d.ledger.length, 0);
});

test("định dạng: che số điện thoại và đồng hồ đếm ngược", () => {
  assert.equal(maskPhone("0901234142"), "09•• ••• 142");
  assert.equal(formatCountdown(60), "01:00");
  assert.equal(formatCountdown(0.2), "00:01");
  assert.equal(formatCountdown(-5), "00:00");
});

test("VietQR: CRC16-CCITT đúng chuẩn và payload đủ trường NAPAS", async () => {
  const { crc16, vietQrPayload, cleanContent } = await import("../src/lib/vietqr.js");
  assert.equal(crc16("123456789"), "29B1"); // giá trị kiểm tra chuẩn của CRC-16/CCITT-FALSE
  const p = vietQrPayload({ bin: "970422", accountNo: "0901234567890", amount: 4600000, content: "SS-20260921-0143" });
  assert.ok(p.startsWith("000201010212"));
  assert.ok(p.includes("0010A000000727"));
  assert.ok(p.includes("000697042201130901234567890"));
  assert.ok(p.includes("5303704") && p.includes("54074600000") && p.includes("5802VN"));
  assert.ok(p.includes("0816SS-20260921-0143"));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
  assert.equal(cleanContent("Đơn #SS-01 thuê kho"), "Don SS-01 thue kho");
});
