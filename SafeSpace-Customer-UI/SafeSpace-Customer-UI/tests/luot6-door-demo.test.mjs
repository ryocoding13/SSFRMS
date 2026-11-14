// Lượt 6 · #45 #54 #59 + #48–51 (phần BE/API Thắng): công cụ demo, QR xem trước ngày thuê, PIN 1–9, đóng cửa.
import test from "node:test";
import assert from "node:assert/strict";
import { startMockApi } from "../mock/mock-api.mjs";
import { SCENARIOS, contractFormError, doorLogLine, expectedState, overdueDays, overdueFee, paymentFormError, pinError, scanScreen, unitOptionLabel } from "../src/features/admin/demo/demoModel.js";
import { notYetMessage, usableFromText } from "../src/shared/utils/access.js";

const PORT = 5296, base = `http://localhost:${PORT}`;
async function call(method, path, body, token) {
  const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const login = async (u, p) => (await call("POST", "/api/auth/login", { username: u, password: p })).data.token;

test("kịch bản demo cho đúng trạng thái dự kiến", () => {
  const t = "2026-11-12";
  const want = { NOT_YET: "Chưa tới ngày thuê", ACTIVE: "Đang thuê", EXPIRING: "Sắp hết hạn", OVERDUE: "Quá hạn 3 ngày", OVERDUE_REMIND: "Quá hạn 12 ngày", OVERDUE_REMOVAL: "Quá hạn 21 ngày" };
  for (const [key, , make] of SCENARIOS) { const d = make(t); assert.equal(expectedState(d.start, d.end, t), want[key], key); }
  assert.equal(expectedState("2026-10-01", t, t), "Quá hạn 0 ngày");
});

test("kiểm tra dữ liệu nhập của form demo", () => {
  assert.match(contractFormError({ start: "2026-11-10", end: "2026-11-10", rate: "1" }), /sau ngày bắt đầu/);
  assert.match(contractFormError({ start: "2026-11-01", end: "2026-12-01", rate: "0" }), /lớn hơn 0/);
  assert.equal(contractFormError({ start: "2026-11-01", end: "2026-12-01", rate: "1500000" }), "");
  assert.match(paymentFormError({ paidAt: "", amount: "" }, "2026-11-12T10:00"), /Nhập/);
  assert.match(paymentFormError({ paidAt: "2026-11-13T09:00", amount: "" }, "2026-11-12T10:00"), /tương lai/);
  assert.equal(paymentFormError({ paidAt: "2026-11-01T09:00", amount: "" }, "2026-11-12T10:00"), "");
});

test("#59 thông báo chưa đến ngày", () => {
  assert.equal(usableFromText("2026-11-20"), "Có thể mở cửa từ 00:00 ngày 20/11/2026");
  assert.equal(notYetMessage("2026-11-20"), "Chưa đến ngày sử dụng. Có thể mở cửa từ 00:00 ngày 20/11/2026.");
});

test("mock: PIN 1–9, quét mở → đóng cửa từ ứng dụng, công cụ demo chỉ admin dùng được", async () => {
  const { server } = await startMockApi(PORT);
  try {
    const cus = await login("customer01", "Customer@123"), admin = await login("admin", "Admin@123");
    const list = (await call("GET", "/api/contracts", undefined, cus)).data;
    const id = list[0].contractId;
    const qr = await call("GET", `/api/contracts/${id}/access-qr`, undefined, cus);
    assert.equal(qr.status, 200);
    assert.match(qr.data.backupCode, /^[1-9]{6}$/);
    assert.equal(typeof qr.data.usableNow, "boolean");

    assert.equal((await call("GET", `/api/contracts/${id}/door`, undefined, cus)).data.door, "LOCKED");
    const scan = await call("POST", "/api/access/scan", { code: qr.data.code });
    if (scan.data.result === "OPEN") assert.equal((await call("GET", `/api/contracts/${id}/door`, undefined, cus)).data.door, "OPEN");
    const closed = await call("POST", `/api/contracts/${id}/door/close`, undefined, cus);
    assert.equal(closed.data.door, "LOCKED");
    if (scan.data.result === "OPEN") {
      assert.equal(closed.data.changed, true);
      const logs = (await call("GET", "/api/admin/door-logs", undefined, admin)).data.items;
      assert.deepEqual(logs.slice(0, 2).map((l) => [l.result, l.method]), [["CLOSED", "CLOSE_APP"], ["OPEN", "QR"]]);
      assert.ok(logs.every((l) => !JSON.stringify(l).includes(qr.data.code)), "nhật ký không chứa nguyên mã");
    }

    assert.equal((await call("GET", "/api/admin/demo/contracts", undefined, cus)).status, 403);
    const rows = (await call("GET", "/api/admin/demo/contracts", undefined, admin)).data;
    const c = rows.find((r) => r.contractId === id);
    assert.ok(c && Array.isArray(c.payments));
    const today = new Date().toISOString().slice(0, 10); // cùng mốc ngày (UTC) với mock
    const od = SCENARIOS.find((s) => s[0] === "OVERDUE")[2](today);
    const bad = await call("PUT", `/api/admin/demo/contracts/${id}`, { startDate: od.end, endDate: od.start }, admin);
    assert.equal(bad.status, 400);
    const ok = await call("PUT", `/api/admin/demo/contracts/${id}`, { startDate: od.start, endDate: od.end, reason: "demo quá hạn" }, admin);
    assert.equal(ok.status, 200);
    assert.equal(ok.data.contract.status, "OVERDUE");
    assert.equal(ok.data.contract.overdueDays, 3);
    assert.ok(ok.data.changes.some((x) => x.field === "Ngày hết hạn"));
    const paid = c.payments.find((p) => p.paidAt);
    if (paid) {
      const r = await call("PUT", `/api/admin/demo/payments/${paid.paymentId}`, { amount: 999000 }, admin);
      assert.equal(r.status, 200);
      assert.equal(r.data.contract.payments.find((p) => p.paymentId === paid.paymentId).amount, 999000);
    }
  } finally { server.close(); }
});

test("máy quét: PIN 1–9, màn hình theo kết quả, phí quá hạn, dòng nhật ký", () => {
  assert.equal(pinError("12345"), "Nhập đủ 6 số.");
  assert.equal(pinError("123450"), "Mã PIN gồm 6 số từ 1 đến 9.");
  assert.equal(pinError("123456"), "");
  assert.equal(scanScreen({ result: "OPEN" }), "OPEN");
  assert.equal(scanScreen({ result: "DENIED", reason: "Chưa đến ngày sử dụng. Có thể mở cửa từ 00:00 ngày 20/11/2026." }), "NOT_YET");
  assert.equal(scanScreen({ result: "DENIED", reason: "Mã không đúng." }), "DENIED");
  assert.equal(overdueDays("2026-11-09", "2026-11-12"), 3);
  assert.equal(overdueFee(1000000, 3), 150000);
  assert.equal(overdueFee(1000000, 30), 1000000);
  assert.equal(doorLogLine({ result: "CLOSED", method: "CLOSE_APP", customerName: "Nguyễn Văn An" }), 'Khách Nguyễn Văn An · bấm "Đóng cửa" trong Kho của tôi');
});

test("mock máy quét theo ô: sai ô bị từ chối, đóng cửa từ thiết bị, gửi hỗ trợ không trùng", async () => {
  const { server } = await startMockApi(PORT + 1);
  const b = `http://localhost:${PORT + 1}`;
  const c2 = async (method, path, body, token) => { const r = await fetch(b + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; };
  try {
    const cus = (await c2("POST", "/api/auth/login", { username: "customer01", password: "Customer@123" })).data.token;
    const id = (await c2("GET", "/api/contracts", undefined, cus)).data[0].contractId;
    const qr = (await c2("GET", `/api/contracts/${id}/access-qr`, undefined, cus)).data;
    const wrong = await c2("POST", "/api/access/scan", { code: qr.backupCode, unitNumber: "KHONG-CO" });
    assert.equal(wrong.data.result, "DENIED");
    // Đúng mã, đúng số ô nhưng máy quét ở cơ sở khác → từ chối (mã ô trùng giữa các cơ sở)
    const otherFacility = await c2("POST", "/api/access/scan", { code: qr.code, unitNumber: qr.unitNumber, facilityId: 999 });
    assert.equal(otherFacility.data.result, "DENIED");
    assert.match(otherFacility.data.reason, /cơ sở này/);
    const ok = await c2("POST", "/api/access/scan", { code: qr.backupCode, unitNumber: qr.unitNumber });
    if (ok.data.result === "OPEN") {
      assert.equal((await c2("GET", `/api/access/door?unitNumber=${qr.unitNumber}`)).data.door, "OPEN");
      const closed = await c2("POST", "/api/access/door/close", { unitNumber: qr.unitNumber });
      assert.equal(closed.data.door, "LOCKED"); assert.equal(closed.data.changed, true);
      assert.equal((await c2("POST", "/api/access/door/close", { unitNumber: qr.unitNumber })).data.changed, false);
    }
    const s1 = await c2("POST", "/api/access/support", { unitNumber: qr.unitNumber });
    const s2 = await c2("POST", "/api/access/support", { unitNumber: qr.unitNumber });
    assert.equal(s1.data.duplicate, false); assert.equal(s2.data.duplicate, true); assert.equal(s1.data.ticketCode, s2.data.ticketCode);
    assert.equal((await c2("GET", "/api/access/door?unitNumber=KHONG-CO")).status, 404);
  } finally { server.close(); }
});

test("mock: admin không nhận được IP của khách trong lịch sử đăng nhập và nhật ký", async () => {
  const { server } = await startMockApi(PORT + 2);
  const b = `http://localhost:${PORT + 2}`;
  const post = (path, body) => fetch(b + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  try {
    await post("/api/auth/login", { username: "customer01", password: "Customer@123" });
    const admin = (await post("/api/auth/login", { username: "admin", password: "Admin@123" })).token;
    const rows = (await fetch(b + "/api/admin/logs/login-history", { headers: { Authorization: `Bearer ${admin}` } }).then((r) => r.json())).items;
    const cus = rows.find((r) => r.username === "customer01"), adm = rows.find((r) => r.username === "admin");
    assert.equal(cus.ipAddress, null); assert.equal(cus.deviceInfo, null);
    assert.ok(adm.ipAddress);
  } finally { server.close(); }
});

test("máy quét mô phỏng: nhãn ô kho ở danh sách xổ và màn hình máy", () => {
  assert.equal(unitOptionLabel({ unitNumber: "B-015", climateControlled: true, sizeM2: 15 }), "B-015 · Kho lạnh 15 m²");
  assert.equal(unitOptionLabel({ unitNumber: "K01", climateControlled: false, sizeM2: 7.5 }), "K01 · Kho thường 7,5 m²");
  assert.equal(unitOptionLabel({ unitNumber: "B-015", climateControlled: true, sizeM2: 15 }, true), "B-015 · Kho lạnh");
  assert.equal(unitOptionLabel({ unitNumber: "K02" }), "K02 · Kho thường");
});
