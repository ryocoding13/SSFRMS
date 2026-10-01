// Render SSR mọi route (kể cả khi đã đăng nhập) để bắt lỗi runtime cơ bản. Luồng thao tác nằm ở e2e.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("../", import.meta.url));
const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
globalThis.window = { location: { hash: "" }, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
globalThis.document = { title: "", addEventListener() {}, removeEventListener() {}, activeElement: null, body: { style: {} } };

process.env.VITE_USE_API = "false";
const vite = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { default: App } = await vite.ssrLoadModule("/src/CustomerApp.jsx");
  const { STORAGE_KEY } = await vite.ssrLoadModule("/src/state/store.jsx");
  const { createSeedData } = await vite.ssrLoadModule("/src/data/seed.js");
  const { OPS_ACCOUNTS } = await vite.ssrLoadModule("/src/ops/data.js");
  const seed = (authed, opsUser = null) => memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed, data: createSeedData(), opsUser }));

  const publicRoutes = ["home", "login", "register", "pricing", "guide", "find", "find?type=climate&band=S", "find/map", "find/map?type=climate", "find/map?area=Kh%C3%B4ng%20c%C3%B3", "find/1", "find/1?view=map&unit=K02", "find/8?type=climate&view=map", "find/999", "nope"];
  const privateRoutes = [
    "overview", "units", "units/HĐ-2026-0142", "units/HĐ-2026-0086/renew", "units/HĐ-2026-0142/return", "units/unknown",
    "sent?type=renew&contract=HĐ-2026-0086", "reservations", "reservations/SS-20260914-0142", "reservations/none",
    "confirmation/SS-20260914-0142", "checkout/SS-20260914-0142", "payments", "support", "support?contract=HĐ-2026-0142&topic=SCHEDULE", "profile",
  ];
  let count = 0;
  for (const authed of [false, true]) {
    seed(authed);
    for (const r of [...publicRoutes, ...(authed ? privateRoutes : [])]) {
      window.location.hash = `#/${r}`;
      const html = renderToStaticMarkup(React.createElement(App));
      assert.ok(html.includes("Điều hướng chính"), r);
      assert.ok(!html.includes("NaN") && !html.includes("undefined"), `${r} chứa NaN/undefined`);
      count++;
    }
  }
  // Khu vận hành: nhân viên (S01–S09) và quản lý cơ sở (M01–M08)
  const opsRoutes = {
    STAFF: [
      "staff", "staff?page=2", "staff/reconcile", "staff/verify", "staff/handover", "staff/return", "staff/support",
      "staff/reconcile?id=SS-20260914-0142", "staff/verify?id=XM-0142", "staff/handover?id=BG-0115", "staff/return?id=TK-0098",
      "staff/support?id=HT-0082", "staff/done?kind=payment", "staff/nope",
    ],
    MANAGER: ["manager", "manager/units", "manager/units?tab=OVERDUE", "manager/allocate", "manager/assign", "manager/renewals", "manager/contracts", "manager/report", "manager/done", "staff"],
  };
  for (const acc of OPS_ACCOUNTS) {
    seed(true, acc);
    for (const r of opsRoutes[acc.role]) {
      window.location.hash = `#/${r}`;
      const html = renderToStaticMarkup(React.createElement(App));
      assert.ok(html.includes(acc.full_name), `${r}: thiếu tên ${acc.full_name}`);
      assert.ok(!html.includes("NaN") && !html.includes("undefined"), `${r} chứa NaN/undefined`);
      count++;
    }
  }
  // Lưới 3x3: trang 1 có đủ 9 thẻ, có phân trang
  seed(true, OPS_ACCOUNTS[0]);
  window.location.hash = "#/staff";
  const grid = renderToStaticMarkup(React.createElement(App));
  assert.equal((grid.match(/class="panel task-card"/g) || []).length, 9, "S01 hiện 9 thẻ / trang");
  assert.ok(grid.includes("aria-label=\"Phân trang\"") && grid.includes("trên 10"), "S01 có phân trang (10 việc)");
  // Không có việc → thông báo trống (S01-trống, S09a-trống)
  const { OPS_KEY } = await vite.ssrLoadModule("/src/ops/store.jsx");
  const { createOpsData } = await vite.ssrLoadModule("/src/ops/data.js");
  const none = { ...createOpsData(), payments: [], verifications: [], handovers: [], returns: [], tickets: [] };
  memory.set(OPS_KEY, JSON.stringify(none));
  for (const [r, text] of [["staff", "Chưa có công việc nào hôm nay"], ["staff/reconcile", "Chưa có khoản nào cần đối soát"], ["staff/support", "Chưa có yêu cầu hỗ trợ"]]) {
    window.location.hash = `#/${r}`;
    assert.ok(renderToStaticMarkup(React.createElement(App)).includes(text), `${r}: thiếu "${text}"`);
    count++;
  }
  memory.delete(OPS_KEY);
  // Khách hàng chưa có kho → một dòng thông báo (C01/C06/C14-trống)
  const { createEmptyData } = await vite.ssrLoadModule("/src/data/seed.js");
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: createEmptyData({ user_id: 9, full_name: "Lê Hoàng Nam", email: "nam@example.com", phone: "0900000000", password: "x" }) }));
  for (const [r, text] of [["units", "Bạn chưa thuê kho nào"], ["overview", "Bạn chưa thuê kho nào"], ["reservations", "Bạn chưa có đơn đặt chỗ nào"]]) {
    window.location.hash = `#/${r}`;
    const html = renderToStaticMarkup(React.createElement(App));
    assert.ok(html.includes(text) && html.includes("empty-line"), `${r}: thiếu thông báo trống`);
    count++;
  }
  seed(true);
  window.location.hash = "#/overview";
  const overview = renderToStaticMarkup(React.createElement(App));
  for (const t of ["Xin chào, Nguyễn Thị Mai", "Thanh toán &amp; lịch hẹn", "Mốc sắp tới", "Hoạt động gần đây"]) assert.ok(overview.includes(t), t);
  console.log(JSON.stringify({ renderedRoutes: count, result: "PASS" }));
} finally {
  await vite.close();
}
