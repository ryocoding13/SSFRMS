// Lượt 2 (#15, #16, #19): bảng đối soát một nguồn số liệu và trạng thái hồ sơ trả kho.
import test from "node:test";
import assert from "node:assert/strict";
import { returnCaseState, settlementFromRefund, settlementOf, depositSidePreview } from "../src/features/facility-operations/settlements/settlementModel.js";

test("#16: bảng đối soát lấy đúng số máy chủ (ví dụ Figma M-ĐS 1.985.000 đ)", () => {
  const s = settlementOf({ official: false, scenario: "EarlyStop", deposit: 1150000, cleaning: 115000, damage: 200000, overdue: 0,
    total_deduction: 315000, deposit_refund: 835000, rent_refund: 1150000, total: 1985000, months_total: 3, months_charged: 2 });
  assert.equal(s.official, false);
  assert.equal(s.total, s.depositRefund + s.rentRefund, "tổng hoàn = cọc còn hoàn + tiền thuê được hoàn");
  assert.equal(s.deposit - s.totalDeduction, s.depositRefund);
  assert.equal(s.monthsTotal - s.monthsCharged, 1);
});

test("#16/#19: khoản hoàn chính thức tách phần cọc và tiền thuê, không lệch tổng", () => {
  const s = settlementFromRefund({ deposit: 1150000, cleaning: 115000, damage: 200000, overdue: 0, amount: 1985000, depositRefund: 835000, rentRefund: 1150000 });
  assert.equal(s.official, true);
  assert.equal(s.totalDeduction, 315000);
  assert.equal(s.depositRefund + s.rentRefund, s.total);
  const old = settlementFromRefund({ deposit: 1150000, overdue: 172500, cleaning: 115000, damage: 200000, amount: 662500 });
  assert.equal(old.depositRefund, 662500, "khoản cũ chưa có tách phần: coi toàn bộ là hoàn cọc");
  assert.equal(old.rentRefund, 0);
});

test("#16: khi đang lập biên bản chỉ có phần cọc, khấu trừ tối đa bằng cọc", () => {
  const s = depositSidePreview(1000000, 100000, 2000000, 0);
  assert.equal(s.totalDeduction, 1000000);
  assert.equal(s.depositRefund, 0);
  assert.equal(s.partial, true);
});

test("#15: tách chờ nhân viên kiểm tra / chờ khách phản hồi / sẵn sàng duyệt / đã chốt", () => {
  const board = { deposit_refunds: [{ contractId: "HĐ-3", status: "PENDING" }, { contractId: "HĐ-4", status: "PAID" }] };
  assert.equal(returnCaseState(board, { id: "HĐ-1", state: "ACTIVE" }, { status: "SCHEDULED" })[0], "WAIT_STAFF");
  assert.equal(returnCaseState(board, { id: "HĐ-2", state: "RETURNED" }, { status: "SUBMITTED", deduction_status: "WAITING", damage_workflow_resolved: false })[0], "WAIT_CUSTOMER");
  assert.equal(returnCaseState(board, { id: "HĐ-2", state: "RETURNED" }, { status: "SUBMITTED", deduction_status: "AGREED", damage_workflow_resolved: true })[0], "READY");
  assert.deepEqual(returnCaseState(board, { id: "HĐ-3", state: "CLOSED" }, null).slice(0, 2), ["SETTLED", "Đã chốt · Đang chờ hoàn"]);
  assert.equal(returnCaseState(board, { id: "HĐ-4", state: "CLOSED" }, null)[1], "Đã hoàn tiền");
});
