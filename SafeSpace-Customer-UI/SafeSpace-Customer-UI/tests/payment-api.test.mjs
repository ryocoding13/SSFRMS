// Hợp đồng API các màn mới (Figma 16/10): PayOS khi đặt chỗ và gia hạn, thanh toán tại cửa hàng, huỷ đơn & hoàn tiền,
// QR mở cửa + máy quét, đổi trạng thái ô (F12). Giao diện (src/api/*.js, src/ops/api.js) ↔ máy chủ giả lập theo BACKEND-TODO.md.
import test from "node:test";
import assert from "node:assert/strict";
import { startMockApi } from "../mock/mock-api.mjs";
import { OPS_ACTIONS } from "../src/ops/api.js";
import { normAccess, normCancelPreview, normPayos, normScan } from "../src/api/payment-access.js";
import { composeData } from "../src/api/mappers.js";

let PORT = 5289;
const nextPort = () => ++PORT;
let base = "";
async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const login = async (username, password) => (await call("POST", "/api/auth/login", { username, password })).data.token;
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test("PayOS đặt chỗ: tạo QR → webhook → đơn đã thanh toán; huỷ đơn đã thanh toán có hoàn tiền", async () => {
  const { server } = await startMockApi((base = `http://localhost:${nextPort()}`, PORT));
  try {
    const t = await login("customer01", "Customer@123");
    const r = (await call("POST", "/api/reservations", { facilityId: 3, unitTypeId: 2, startDate: tomorrow(), rentalPeriodMonths: 3 }, t)).data;
    const res = await call("POST", `/api/reservations/${r.reservationId}/payos`, undefined, t);
    assert.equal(res.status, 200);
    const checkout = normPayos(res.data);
    assert.ok(checkout.qr && checkout.url && checkout.expires_at);
    assert.equal(checkout.amount, r.estimatedAmount + r.requiredDeposit);
    // Gọi lại trả cùng đơn PayOS (không tạo trùng)
    assert.equal((await call("POST", `/api/reservations/${r.reservationId}/payos`, undefined, t)).data.orderCode, res.data.orderCode);
    assert.equal((await call("GET", `/api/reservations/${r.reservationId}`, undefined, t)).data.status, "PENDING_PAYMENT");
    await call("GET", `/__payos/paid?order=${res.data.orderCode}`);
    assert.equal((await call("GET", `/api/reservations/${r.reservationId}`, undefined, t)).data.status, "CONFIRMED");

    const preview = normCancelPreview((await call("GET", `/api/reservations/${r.reservationId}/cancel-preview`, undefined, t)).data);
    assert.equal(preview.paid, r.estimatedAmount + r.requiredDeposit);
    assert.equal(preview.refund, preview.paid - Math.round(r.estimatedAmount * 0.1));
    assert.equal((await call("POST", `/api/reservations/${r.reservationId}/cancel`, { reason: "Đổi kế hoạch" }, t)).status, 200);
    const list = (await call("GET", "/api/reservations", undefined, t)).data;
    const d = composeData({ catalog: { facilities: [], unitTypes: [] }, remote: { reservations: list, reservationDetails: {}, contracts: [], tickets: [] }, overlay: {}, session: { user: { userId: 3 } }, timeoutSeconds: 600 });
    const cancelled = d.reservations.find((x) => x.api_id === r.reservationId);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.refund_status, "PENDING");
    assert.equal(cancelled.refund_amount, preview.refund);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("thanh toán tại cửa hàng: đơn chờ thu tiền (vào hàng chờ S09), không tạo được QR nữa", async () => {
  const { server } = await startMockApi((base = `http://localhost:${nextPort()}`, PORT));
  try {
    const t = await login("customer01", "Customer@123");
    const r = (await call("POST", "/api/reservations", { facilityId: 4, unitTypeId: 2, startDate: tomorrow(), rentalPeriodMonths: 1 }, t)).data;
    const res = await call("POST", `/api/reservations/${r.reservationId}/pay-at-facility`, undefined, t);
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "PENDING_VERIFICATION");
    assert.equal(res.data.paymentMethod, "AT_FACILITY");
    const d = composeData({ catalog: { facilities: [], unitTypes: [] }, remote: { reservations: [res.data], reservationDetails: {}, contracts: [], tickets: [] }, overlay: {}, session: { user: { userId: 3 } }, timeoutSeconds: 600 });
    assert.equal(d.reservations[0].pay_at_facility, true);
    assert.equal((await call("POST", `/api/reservations/${r.reservationId}/payos`, undefined, t)).status, 400);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("gia hạn qua PayOS (C11q): khoản RENEWAL chờ trả → trả xong hợp đồng kéo dài đến ngày mới", async () => {
  const { server } = await startMockApi((base = `http://localhost:${nextPort()}`, PORT));
  try {
    const t = await login("customer01", "Customer@123");
    const contract = (await call("GET", "/api/contracts/1", undefined, t)).data;
    const d = composeData({ catalog: { facilities: [], unitTypes: [] }, remote: { reservations: [], reservationDetails: {}, contracts: [contract], tickets: [] }, overlay: {}, session: { user: { userId: 3 } }, timeoutSeconds: 600 });
    const row = d.ledger.find((l) => l.payable);
    assert.ok(row, "có khoản gia hạn cần thanh toán");
    const res = await call("POST", `/api/payments/${row.api_id}/payos`, undefined, t);
    assert.equal(normPayos(res.data).amount, row.amount);
    assert.equal((await call("GET", `/api/payments/${row.api_id}`, undefined, t)).data.status, "PENDING");
    await call("GET", "/__payos/paid");
    assert.equal((await call("GET", `/api/payments/${row.api_id}`, undefined, t)).data.status, "PAID");
    assert.equal((await call("GET", "/api/contracts/1", undefined, t)).data.endDate, row.period.to);
    // Khách khác không trả hộ được
    const other = await login("customer02", "Customer@123");
    assert.equal((await call("POST", `/api/payments/${row.api_id}/payos`, undefined, other)).status, 404);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("QR mở cửa (C07q) + máy quét (C07r): chủ hợp đồng lấy mã, quét mở cửa; mã sai bị từ chối", async () => {
  const { server } = await startMockApi((base = `http://localhost:${nextPort()}`, PORT));
  try {
    const t = await login("customer01", "Customer@123");
    const access = normAccess((await call("GET", "/api/contracts/1/access-qr", undefined, t)).data);
    assert.ok(access.code && access.backup && access.valid_until);
    const other = await login("customer02", "Customer@123");
    assert.equal((await call("GET", "/api/contracts/1/access-qr", undefined, other)).status, 404);
    assert.equal(normScan((await call("POST", "/api/access/scan", { code: access.code })).data).result, "OPEN");
    assert.equal(normScan((await call("POST", "/api/access/scan", { code: access.backup })).data).result, "OPEN");
    const denied = normScan((await call("POST", "/api/access/scan", { code: "SSQR-0-0000" })).data);
    assert.equal(denied.result, "DENIED");
    assert.ok(denied.reason);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("phản hồi hỗ trợ (C12) có trong chi tiết yêu cầu; quản lý đổi trạng thái ô (M02a, F12)", async () => {
  const { server } = await startMockApi((base = `http://localhost:${nextPort()}`, PORT), { ops: true });
  try {
    const t = await login("customer01", "Customer@123");
    const ticket = (await call("GET", "/api/tickets/2", undefined, t)).data;
    assert.equal(ticket.responses.length, 1);
    const manager = await login("manager01", "Manager@123");
    const staff = await login("staff01", "Staff@123");
    const board = (await call("GET", "/api/ops/board", undefined, manager)).data;
    const empty = board.units.find((u) => u.status === "EMPTY");
    const [method, path, body] = OPS_ACTIONS.UPDATE_UNIT_STATUS({ code: empty.code, status: "MAINTENANCE", reason: "Hỏng khoá cửa" });
    // Backend PUT /api/staff/units/{mã}/status cho cả nhân viên và quản lý (SRS UC09) → nhân viên không bị chặn, chỉ bị kiểm lý do
    assert.equal((await call(method, path, { ...body, reason: "" }, staff)).status, 400, "nhân viên gọi được nhưng phải có lý do");
    assert.equal((await call(method, path, { ...body, reason: "" }, manager)).status, 400, "thiếu lý do");
    assert.equal((await call(method, path, body, manager)).status, 200);
    const after = (await call("GET", "/api/ops/board", undefined, manager)).data.units.find((u) => u.code === empty.code);
    assert.equal(after.status, "MAINTENANCE");
    assert.equal(after.history[0].reason, "Hỏng khoá cửa");
    const rented = board.units.find((u) => u.tenant);
    const [m2, p2, b2] = OPS_ACTIONS.UPDATE_UNIT_STATUS({ code: rented.code, status: "MAINTENANCE", reason: "x" });
    assert.equal((await call(m2, p2, b2, manager)).status, 400, "ô đang có khách không đổi được");
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("PayOS đặt chỗ qua endpoint backend đang có (POST /api/reservations/create-payos-qr) → webhook → CONFIRMED", async () => {
  const { server } = await startMockApi((base = `http://localhost:${nextPort()}`, PORT));
  try {
    const t = await login("customer01", "Customer@123");
    const r = (await call("POST", "/api/reservations", { facilityId: 3, unitTypeId: 2, startDate: tomorrow(), rentalPeriodMonths: 3 }, t)).data;
    const res = await call("POST", "/api/reservations/create-payos-qr", { reservationId: r.reservationId }, t);
    assert.equal(res.status, 200);
    assert.equal(res.data.reservationId, r.reservationId);
    const checkout = normPayos(res.data);
    assert.ok(checkout.qr && checkout.url);
    assert.equal(checkout.amount, r.estimatedAmount + r.requiredDeposit);
    await call("GET", `/__payos/paid?order=${res.data.orderCode}`);
    assert.equal((await call("GET", `/api/reservations/${r.reservationId}`, undefined, t)).data.status, "CONFIRMED");
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
