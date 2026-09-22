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
  const seed = (authed) => memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed, data: createSeedData() }));

  const publicRoutes = ["home", "login", "register", "pricing", "guide", "find", "find?type=climate&band=S", "find/1", "find/8?type=climate", "find/999", "nope"];
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
  seed(true);
  window.location.hash = "#/overview";
  const overview = renderToStaticMarkup(React.createElement(App));
  for (const t of ["Xin chào, Nguyễn Thị Mai", "Thanh toán &amp; lịch hẹn", "Mốc sắp tới", "Hoạt động gần đây"]) assert.ok(overview.includes(t), t);
  console.log(JSON.stringify({ renderedRoutes: count, result: "PASS" }));
} finally {
  await vite.close();
}
