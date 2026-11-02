import test from "node:test";
import assert from "node:assert/strict";
import { applyWorkflowAction, createWorkflowSeed, depositSchedule, policyRate } from "../src/features/facility-operations/workflows/workflowModel.js";
import { accessError } from "../src/shared/utils/access.js";
import { loadWorkflow, saveWorkflow } from "../src/features/facility-operations/workflows/workflowApi.js";

const actor = roles => ({ id: 3, name: "Trần Văn Long", facilityId:1, roles });
test("khấu trừ dựa trên cọc gốc, cộng theo ngày, chặn ở 100%", () => {
  const d = depositSchedule(1150000, "2026-10-01", "2026-10-04");
  assert.equal(d.deducted, 172500); assert.equal(d.balance, 977500);
  assert.deepEqual(d.rows.map(r => r.amount), [57500, 57500, 57500]);
  for (const days of [20, 21, 100]) { const x = depositSchedule(1150000, "2026-01-01", new Date(Date.UTC(2026, 0, 1 + days)).toISOString().slice(0, 10)); assert.equal(x.balance, 0); assert.equal(x.rows.length, 20); }
  assert.equal(depositSchedule(100, "2026-10-10", "2026-10-09").days, 0);
});
test("phân bổ phần lẻ vẫn cộng đúng 100% tiền cọc", () => {
  const x = depositSchedule(1003, "2026-01-01", "2026-02-01");
  assert.equal(x.rows.reduce((s, r) => s + r.amount, 0), 1003);
  assert.throws(() => depositSchedule(100, "2026-01-01", "2026-02-01", 0));
});
test("khách không được xác nhận hoàn cọc, quản lý không ghi trùng", () => {
  const s = createWorkflowSeed(), p = { id: "HC-0098", confirmed:true,transferredAt:new Date(Date.now()-60000).toISOString(),transactionRef: "FT123" };
  assert.throws(() => applyWorkflowAction(s, "CONFIRM_DEPOSIT_REFUND", p, actor(["CUSTOMER"])), /quyền/);
  assert.throws(() => applyWorkflowAction(s, "CONFIRM_DEPOSIT_REFUND", { id: p.id }, actor(["MANAGER"])), /mã giao dịch/);
  s.depositRefunds[0].inspectedAt=new Date(Date.now()-120000).toISOString();
  const next = applyWorkflowAction(s, "CONFIRM_DEPOSIT_REFUND", p, actor(["MANAGER"]));
  assert.equal(next.depositRefunds[0].status, "PAID"); assert.equal(s.depositRefunds[0].status, "PENDING");
  assert.throws(() => applyWorkflowAction(next, "CONFIRM_DEPOSIT_REFUND", p, actor(["MANAGER"])), /không còn/);
});
test("biên bản bắt buộc đủ thông tin và thời gian không ở tương lai", () => {
  const s = createWorkflowSeed(), p = { id: "QH-0061", inventory: "03 thùng", location: "Khu ngoài K03", performedAt: "2099-01-01T10:00:00Z", unitStatus: "INSPECTION",confirmed:true,beforePhotos:[{name:"before.png",type:"image/png",size:20}],afterPhotos:[{name:"after.png",type:"image/png",size:20}] };
  assert.throws(() => applyWorkflowAction(s, "RECORD_REMOVAL", p, actor(["STAFF"])), /tương lai/);
  p.performedAt = new Date(Date.now()-60000).toISOString();
  const next = applyWorkflowAction(s, "RECORD_REMOVAL", p, actor(["STAFF"]));
  assert.equal(next.overdue[0].status, "DONE"); assert.equal(next.overdue[0].record.location, p.location);
  assert.throws(() => applyWorkflowAction(next, "RECORD_REMOVAL", p, actor(["STAFF"])), /không gửi lại/);
});
test("khách chỉ phản hồi yêu cầu của chính mình, nội dung trống bị từ chối", () => {
  const s = createWorkflowSeed(), p = { id: "HT-0091", note: "Tôi cần kho 3 tháng" };
  assert.throws(() => applyWorkflowAction(s, "REPLY_INQUIRY", p, { ...actor(["CUSTOMER"]), id: 99 }), /không thuộc/);
  assert.throws(() => applyWorkflowAction(s, "REPLY_INQUIRY", { ...p, note: " " }, actor(["CUSTOMER"])), /nội dung/);
  const next = applyWorkflowAction(s, "REPLY_INQUIRY", p, actor(["CUSTOMER"]));
  assert.equal(next.inquiries[0].responses.length, 1);
});
test("đối soát giữ nguyên khoản thực nhận và không ghi kết quả hai lần", () => {
  const s = createWorkflowSeed(), p = { id: "SL-0001", note: "Đã xác minh số thực nhận" };
  const next = applyWorkflowAction(s, "RESOLVE_DISCREPANCY", p, actor(["MANAGER"]));
  assert.equal(next.discrepancies[0].actual, 100000);
  assert.throws(() => applyWorkflowAction(next, "RESOLVE_DISCREPANCY", p, actor(["MANAGER"])), /đã được xử lý/);
});
test("gia hạn tại quầy không thu hai lần", () => {
  const s = createWorkflowSeed(), p = { id: "GHQ-0142" };
  const next = applyWorkflowAction(s, "COLLECT_RENEWAL", p, actor(["STAFF"]));
  assert.throws(() => applyWorkflowAction(next, "COLLECT_RENEWAL", p, actor(["STAFF"])), /không thu lần nữa/i);
});
test("chính sách cần đúng quyền và đủ nội dung", () => {
  const s = createWorkflowSeed();
  assert.throws(() => applyWorkflowAction(s, "SAVE_RENTAL_POLICY", s.policy, actor(["MANAGER"])), /quyền/);
  assert.throws(() => applyWorkflowAction(s, "SAVE_RENTAL_POLICY", { ...s.policy, sections: {} }, actor(["OPERATIONS"])), /Vui lòng/);
  assert.equal(applyWorkflowAction(s, "SAVE_RENTAL_POLICY", s.policy, actor(["OPERATIONS"])).policy.version, 2);
});
test("QR bị từ chối với hợp đồng đã gửi trả kho", () => {
  assert.match(accessError({ status: "RETURN_PENDING", start_date: "2026-01-01", end_date: "2027-01-01" }, "2026-10-25"), /hết hiệu lực/);
});
test("API chưa có endpoint luôn từ chối đọc/ghi, không trả dữ liệu giả hoặc thành công giả", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(loadWorkflow("overdue"), /chưa cung cấp/);
    await assert.rejects(saveWorkflow("overdue", "RECORD_REMOVAL", {}), /chưa được ghi nhận/);
  } finally { globalThis.fetch = original; }
});

test("cọc hết sớm do tỷ lệ cao vẫn không xử lý đồ trước mốc ngày 20", () => {
  assert.equal(policyRate({ rate: 10 }), 10);
  assert.equal(policyRate(null), 5);
  assert.equal(policyRate({ rate: 0 }), 5);
  assert.equal(depositSchedule(1000000, "2026-01-01", "2026-03-01", 10).limitDays, 10);
  const s = createWorkflowSeed();
  s.policy.rate = 10;
  s.overdue[0].endDate = new Date(Date.now() - 11 * 86400000).toISOString().slice(0, 10);
  const payload = { id: s.overdue[0].id, inventory: "2 thùng carton", location: "Khu tập kết A", performedAt: new Date(Date.now() - 60000).toISOString(), unitStatus: "INSPECTION",confirmed:true,beforePhotos:[{name:"before.png",type:"image/png",size:20}],afterPhotos:[{name:"after.png",type:"image/png",size:20}] };
  assert.throws(()=>applyWorkflowAction(s, "RECORD_REMOVAL", payload, actor(["STAFF"])),/mốc 20 ngày/);
  s.policy.rate = 5;
  assert.throws(() => applyWorkflowAction(s, "RECORD_REMOVAL", payload, actor(["STAFF"])), /mốc 20 ngày/);
});

test("khách đọc hoàn cọc qua endpoint riêng, không gọi board vận hành", async () => {
  const previous = globalThis.fetch;
  let url;
  globalThis.fetch = async path => { url = String(path); return new Response("[]", {status:200}); };
  try { assert.deepEqual(await loadWorkflow("customerRefunds"), []); assert.ok(url.endsWith("/api/deposit-refunds")); assert.ok(!url.includes("/ops/")); }
  finally { globalThis.fetch = previous; }
});
