import test from "node:test";
import assert from "node:assert/strict";
import { canMarkMoved, moveWindowStart, renewalEstimate, renewalUnitChoices } from "../src/features/customer/contracts/renewalUnitModel.js";
import { oldUnitDeduction } from "../src/features/staff/returns/oldUnitInspectionModel.js";
import { unitMoveText } from "../src/features/manager/renewals/renewalApprovalModel.js";

// D46 / D46b · gia hạn sang ô khác, gia hạn sau nâng cấp, chuyển đồ, kiểm tra ô cũ
const opts = (upgraded) => ({ currentUnit: "K07", upgraded, options: [
  { unitId: 2, unitNumber: "B-021", unitTypeName: "Kho M", kind: "SWAP", monthlyRate: 1500000, depositRequired: 1800000, depositTopUp: 300000 },
  { unitId: 3, unitNumber: "A-010", unitTypeName: "Kho S", kind: "ORIGINAL_TYPE", monthlyRate: 900000, depositRequired: 900000, depositTopUp: 0 },
] });

test("không nâng cấp: chỉ ô cùng loại", () => {
  assert.deepEqual(renewalUnitChoices(opts(false)).map(x => x.key), ["UNIT-2"]);
});

test("sau nâng cấp: giữ ô lớn trước, rồi ô loại đã đặt ban đầu", () => {
  const list = renewalUnitChoices(opts(true));
  assert.deepEqual(list.map(x => x.kind), ["KEEP", "ORIGINAL_TYPE", "SWAP"]);
  assert.equal(list[0].unitNumber, "K07");
});

test("tạm tính gộp tiền gia hạn + cọc chênh; giữ ô lớn không cộng cọc", () => {
  const [swap] = renewalUnitChoices(opts(false));
  assert.deepEqual(renewalEstimate(swap, 2, 1000000), { rate: 1500000, rent: 3000000, topUp: 300000, total: 3300000 });
  const keep = renewalUnitChoices(opts(true))[0];
  assert.equal(renewalEstimate(keep, 1, 1000000).topUp, 0);
});

test("chỉ bấm Đã chuyển đồ trong 3 ngày cuối kỳ cũ, khi đã thanh toán", () => {
  assert.equal(moveWindowStart("2026-11-30"), "2026-11-28");
  assert.equal(moveWindowStart("2026-12-01"), "2026-11-29");
  const m = { status: "PAID", oldEndDate: "2026-11-30", moveFrom: "2026-11-28" };
  assert.equal(canMarkMoved(m, "2026-11-27"), false);
  assert.equal(canMarkMoved(m, "2026-11-28"), true);
  assert.equal(canMarkMoved(m, "2026-11-30"), true);
  assert.equal(canMarkMoved(m, "2026-12-01"), false);
  assert.equal(canMarkMoved({ ...m, status: "HELD" }, "2026-11-29"), false);
  assert.equal(canMarkMoved({ ...m, status: "MOVED" }, "2026-11-29"), false);
});

test("kiểm tra ô cũ: khách báo đúng hạn không tính quá hạn; vệ sinh 10% + hư hỏng", () => {
  const r = oldUnitDeduction({ depositHeld: 1800000, autoMoved: false, oldEndDate: "2026-11-30" }, { walls: "DAMAGED", damage: "200000", cleaning: true }, "2026-12-01");
  assert.deepEqual([r.cleaning, r.damageTaken, r.total, r.left], [180000, 200000, 380000, 1420000]);
});

test("D48: hệ thống tự chuyển không tính phí quá hạn ô cũ", () => {
  const r = oldUnitDeduction({ depositHeld: 1500000, autoMoved: true, oldEndDate: "2026-11-30" }, { walls: "OK" });
  assert.deepEqual([r.total, r.left], [0, 1500000]);
  assert.equal("overdue" in r, false);
});

test("khấu trừ không vượt cọc đang giữ, không tạo nợ", () => {
  const r = oldUnitDeduction({ depositHeld: 1500000, autoMoved: false }, { walls: "DAMAGED", damage: "5000000", cleaning: true });
  assert.equal(r.total, 1500000);
  assert.equal(r.left, 0);
  assert.equal(oldUnitDeduction({ depositHeld: 1000 }, { walls: "DAMAGED", damage: "-5" }).invalidDamage, true);
});

test("quản lý thấy ô mới và cọc chênh khi duyệt gia hạn sang ô khác", () => {
  assert.match(unitMoveText({ target_unit: "B-021", deposit_top_up: 300000 }), /Sang ô B-021 · cọc chênh 300\.000/);
  assert.match(unitMoveText({ target_unit: "B-021", deposit_top_up: 0 }), /không thu thêm cọc/);
});
