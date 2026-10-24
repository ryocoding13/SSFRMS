// Kết nối backend SSFRMS (StorageProject.Api).
//   VITE_API_URL          → địa chỉ API (trong production mặc định "" cùng origin qua reverse proxy)
//   VITE_USE_API=false    → tắt API, dùng dữ liệu lưu trong trình duyệt (chỉ để xem giao diện khách hàng)

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : (typeof process !== "undefined" && process.env ? process.env : {});
export const USE_API = String(env.VITE_USE_API ?? "true").toLowerCase() !== "false";

// Khi build production (mode === 'production'), Vite gán __DEV_API_FALLBACK__ = ""
// và sanitize VITE_API_URL loại bỏ hoàn toàn localhost:5151 khỏi bundle JS.
// Trong dev/test cục bộ (npm run dev hoặc node --test), fallback về http://localhost:5151 để kết nối mock/dev server.
const devFallback = typeof __DEV_API_FALLBACK__ !== "undefined"
  ? __DEV_API_FALLBACK__
  : (env.PROD ? "" : "http://localhost:5151");

const rawApiUrl = (env.VITE_API_URL && env.VITE_API_URL !== "/")
  ? String(env.VITE_API_URL)
  : devFallback;

export const API_URL = rawApiUrl.trim().replace(/\/+$/, "");
