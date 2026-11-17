import test from "node:test";
import assert from "node:assert/strict";
import { paidBeforeExpiry } from "../src/shared/api/paymentStatus.js";

const noWait = async () => {};

test("hết giờ giữ chỗ: khách vừa trả tiền thì không huỷ đơn", async () => {
  const calls = [];
  const paid = await paidBeforeExpiry(7, async (id) => { calls.push(id); return { status: "UNIT_ASSIGNED", isPaid: true }; }, noWait);
  assert.equal(paid, true);
  assert.deepEqual(calls, [7]);
});

test("hết giờ giữ chỗ: hỏi lại một lần (máy chủ chỉ đối soát PayOS 5 giây/lần) rồi mới cho huỷ", async () => {
  const replies = [{ status: "PENDING_PAYMENT", isPaid: false }, { status: "UNIT_ASSIGNED", isPaid: true }];
  let waited = 0;
  assert.equal(await paidBeforeExpiry(7, async () => replies.shift(), async () => { waited++; }), true);
  assert.equal(waited, 1);

  const pending = { status: "PENDING_PAYMENT", isPaid: false };
  assert.equal(await paidBeforeExpiry(7, async () => pending, noWait), false);
});

test("hết giờ giữ chỗ: đơn đã đóng thì không hỏi lại; lỗi mạng thì để lần sau", async () => {
  let n = 0;
  assert.equal(await paidBeforeExpiry(7, async () => { n++; return { status: "CANCELLED", isPaid: false }; }, noWait), false);
  assert.equal(n, 1);
  assert.equal(await paidBeforeExpiry(7, async () => { throw new Error("offline"); }, noWait), null);
});
