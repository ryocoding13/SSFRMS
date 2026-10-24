// Kết nối backend SSFRMS (StorageProject.Api). Mặc định gọi API thật.
//   VITE_API_URL          → địa chỉ API (đặt "/" hoặc "" cho same-origin relative URL /api)
//   VITE_USE_API=false    → tắt API, dùng dữ liệu lưu trong trình duyệt (chỉ để xem giao diện khách hàng)
const env = import.meta.env || {};

export const USE_API = String(env.VITE_USE_API ?? "true").toLowerCase() !== "false";

// Khi chạy production build (Nginx reverse proxy), mặc định gọi same-origin ("") trừ khi có VITE_API_URL khác.
// Khi chạy dev server cục bộ (npm run dev), mặc định gọi backend localhost:5151.
const defaultApiUrl = env.PROD ? "" : "http://localhost:5151";
const rawApiUrl = env.VITE_API_URL !== undefined ? String(env.VITE_API_URL) : defaultApiUrl;
export const API_URL = rawApiUrl.trim() === "/" ? "" : rawApiUrl.trim().replace(/\/+$/, "");

