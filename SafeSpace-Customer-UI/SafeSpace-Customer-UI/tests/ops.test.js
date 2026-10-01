// Nghiệp vụ khu Nhân viên cơ sở & Quản lý cơ sở (src/ops/reducer.js)
import test from "node:test";
import assert from "node:assert/strict";
import { createOpsData } from "../src/ops/data.js";
import { candidateUnits, reduceOps } from "../src/ops/reducer.js";

const T = "2026-09-14";
const run = (s, type, payload) => reduceOps(s, { type, payload }, new Date(`${T}T10:00:00`));

test("dữ liệu khởi tạo: 86 kho, 3 khoản chờ đối soát, 3 khách cần xác minh", () => {
  const s = createOpsData(T);
  assert.equal(s.units.length, 86);
  assert.equal(new Set(s.units.map((u) => u.code)).size, 86);
  assert.equal(s.payments.filter((p) => p.status === "PENDING").length, 3);
  assert.equal(s.verifications.filter((v) => v.status === "TODO").length, 3);
  assert.equal(s.revenue.months.at(-1).label, "Tháng 9");
});

test("đối soát đơn chưa có kho → chuyển quản lý phân bổ, rồi phân bổ tạo lịch xác minh + bàn giao", () => {
  let s = createOpsData(T);
  let out = run(s, "CONFIRM_PAYMENT", { id: "SS-20260913-0147" });
  assert.ok(!out.error);
  s = out.state;
  const a = s.allocations.find((x) => x.id === "SS-20260913-0147");
  assert.equal(a.type, "climate");
  assert.deepEqual([a.min_area, a.max_area], [2, 5]);
  const unit = candidateUnits(s, a)[0];
  assert.ok(unit);
  out = run(s, "ALLOCATE", { id: a.id, unit: unit.code });
  s = out.state;
  assert.equal(s.units.find((u) => u.code === unit.code).status, "WAITING_HANDOVER");
  assert.ok(s.handovers.some((h) => h.unit === unit.code));
  assert.ok(run(s, "ALLOCATE", { id: a.id, unit: unit.code }).error, "không phân bổ lần hai");
});

test("không bàn giao khi chưa xác minh; xác minh rồi bàn giao thì kho hoạt động", () => {
  let s = createOpsData(T);
  assert.match(run(s, "HANDOVER", { id: "BG-0142", method: "CARD" }).error.message, /xác minh/);
  assert.ok(run(s, "VERIFY_CUSTOMER", { id: "XM-0142", doc_type: "CCCD", doc_no: "123", photo_ok: true, info_ok: true }).error);
  s = run(s, "VERIFY_CUSTOMER", { id: "XM-0142", doc_type: "CCCD", doc_no: "079123456789", photo_ok: true, info_ok: true }).state;
  assert.equal(s.verifications.find((v) => v.id === "XM-0142").doc_last4, "6789");
  s = run(s, "HANDOVER", { id: "BG-0142", method: "PIN" }).state;
  assert.equal(s.units.find((u) => u.code === "A-102").status, "ACTIVE");
});

test("trả kho → quản lý xác nhận hoàn cọc = cọc − khoản nợ, kho trống lại", () => {
  let s = createOpsData(T);
  s = run(s, "SUBMIT_RETURN", { id: "TK-0098", report: { items: "a", walls: "b", keys: "c", proposal: "d" } }).state;
  assert.equal(s.contracts.find((c) => c.id === "HĐ-0098").state, "RETURNED");
  const out = run(s, "CONFIRM_REFUND", { id: "HĐ-0098" });
  assert.equal(out.result.refund, 1150000 - 460000);
  assert.equal(out.state.units.find((u) => u.code === "C-012").status, "EMPTY");
});

test("duyệt / từ chối gia hạn; từ chối bắt buộc có lý do", () => {
  let s = createOpsData(T);
  assert.ok(run(s, "DECIDE_RENEWAL", { id: "GH-0077", approve: false }).error);
  s = run(s, "DECIDE_RENEWAL", { id: "GH-0077", approve: false, reason: "Kho đã có đơn đặt trước" }).state;
  assert.equal(s.contracts.find((c) => c.id === "HĐ-0077").state, "RESOLVED");
  s = run(s, "DECIDE_RENEWAL", { id: "GH-0208", approve: true }).state;
  const r = s.renewals.find((x) => x.id === "GH-0208");
  assert.equal(s.units.find((u) => u.code === "C-208").end, r.to);
});

test("phân công việc hỗ trợ cho nhân viên → yêu cầu chuyển sang đang xử lý", () => {
  let s = createOpsData(T);
  s = run(s, "ASSIGN", { id: "PC-03", staff: "NV-01" }).state;
  assert.equal(s.tickets.find((t) => t.id === "HT-0082").assignee, "NV-01");
  assert.equal(s.tickets.find((t) => t.id === "HT-0082").status, "IN_PROGRESS");
  s = run(s, "TICKET_RESPONSE", { id: "HT-0082", note: "Đã cấp lại thẻ", next: "DONE", staff: "NV-01" }).state;
  assert.equal(s.assignments.find((a) => a.id === "PC-03").status, "DONE");
});
