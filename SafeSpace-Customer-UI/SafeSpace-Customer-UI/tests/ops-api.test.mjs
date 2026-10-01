// Hợp đồng API khu vận hành: giao diện (src/ops/api.js) ↔ máy chủ giả lập (mock/mock-api.mjs, bật ops).
// Đảm bảo mỗi thao tác của nhân viên / quản lý gọi đúng endpoint đề xuất trong BE-CONTRACT.md mục 5.
import test from "node:test";
import assert from "node:assert/strict";
import { startMockApi } from "../mock/mock-api.mjs";
import { OPS_ACTIONS, fromApi } from "../src/ops/api.js";

const PORT = 5287;
const base = `http://localhost:${PORT}`;
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
const act = (type, payload, token) => {
  const [method, path, body] = OPS_ACTIONS[type](payload);
  return call(method, path, body, token);
};

test("khu vận hành qua API: nhân viên xử lý, quản lý phân bổ / duyệt, phân quyền đúng", async () => {
  const { server } = await startMockApi(PORT, { ops: true });
  try {
    const staff = await login("staff01", "Staff@123");
    const manager = await login("manager01", "Manager@123");
    const customer = await login("customer01", "Customer@123");

    assert.equal((await call("GET", "/api/ops/board", undefined, customer)).status, 403, "khách hàng không xem được");
    let board = fromApi((await call("GET", "/api/ops/board", undefined, staff)).data);
    assert.equal(board.me.full_name, "Trần Nhân Viên");
    assert.ok(board.payments.length >= 2 && !board.renewals, "nhân viên không nhận dữ liệu gia hạn");

    // Nhân viên: xác nhận thu đơn chưa có kho → vào hàng phân bổ của quản lý
    assert.equal((await act("CONFIRM_PAYMENT", { id: "SS-20260913-0147" }, staff)).status, 200);
    assert.equal((await act("CONFIRM_PAYMENT", { id: "SS-20260913-0147" }, staff)).status, 400, "không xác nhận hai lần");
    // Xác minh rồi bàn giao
    assert.equal((await act("VERIFY_CUSTOMER", { id: "XM-0142", doc_type: "Căn cước công dân", doc_no: "079123456789", photo_ok: true, info_ok: true }, staff)).status, 200);
    assert.equal((await act("HANDOVER", { id: "BG-0142", method: "CARD" }, staff)).status, 200);
    assert.equal((await act("TICKET_RESPONSE", { id: "HT-0082", note: "Đã cấp lại thẻ", next: "DONE" }, staff)).status, 200);
    assert.equal((await act("SUBMIT_RETURN", { id: "TK-0098", report: { items: "a", walls: "b", keys: "c", proposal: "d" } }, staff)).status, 200);
    // Nhân viên không được làm việc của quản lý
    assert.equal((await act("DECIDE_RENEWAL", { id: "GH-0208", approve: true }, staff)).status, 403);

    board = fromApi((await call("GET", "/api/ops/board", undefined, manager)).data);
    const alloc = board.allocations.find((a) => a.id === "SS-20260913-0147");
    assert.ok(alloc, "đơn vừa đối soát nằm trong hàng phân bổ");
    const unit = board.units.find((u) => u.status === "EMPTY" && u.type === alloc.type && u.area >= alloc.min_area && u.area <= alloc.max_area);
    assert.equal((await act("ALLOCATE", { id: alloc.id, unit: unit.code }, manager)).status, 200);
    assert.equal((await act("DECIDE_RENEWAL", { id: "GH-0077", approve: false, reason: "" }, manager)).status, 400, "từ chối phải có lý do");
    assert.equal((await act("DECIDE_RENEWAL", { id: "GH-0077", approve: false, reason: "Kho đã có đơn" }, manager)).status, 200);
    assert.equal((await act("DECIDE_RENEWAL", { id: "GH-0208", approve: true }, manager)).status, 200);
    assert.equal((await act("ASSIGN", { id: "PC-0147", staff: "NV-02" }, manager)).status, 200, "giao việc bàn giao vừa phân bổ");
    assert.equal((await act("REMIND", { id: "HĐ-0061", note: "Đã gọi điện" }, manager)).status, 200);
    assert.equal((await act("CONFIRM_REFUND", { id: "HĐ-0098" }, manager)).status, 200);

    board = fromApi((await call("GET", "/api/ops/board", undefined, manager)).data);
    assert.equal(board.units.find((u) => u.code === unit.code).status, "WAITING_HANDOVER");
    assert.equal(board.units.find((u) => u.code === "A-102").status, "ACTIVE");
    assert.equal(board.contracts.find((c) => c.id === "HĐ-0098").state, "CLOSED");
    assert.ok(board.revenue.by_type.length === 2, "báo cáo có cơ cấu theo loại kho");
  } finally {
    server.close();
  }
});

test("backend chưa bật ops → GET /api/ops/board trả 404 (giao diện chuyển sang dữ liệu mẫu)", async () => {
  const { server } = await startMockApi(PORT + 1);
  try {
    const url = `http://localhost:${PORT + 1}`;
    const { token } = await (await fetch(`${url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "staff01", password: "Staff@123" }) })).json();
    const res = await fetch(`${url}/api/ops/board`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
