// Kết nối backend SSFRMS (StorageProject.Api). Mặc định gọi API thật.
//   VITE_API_URL          → địa chỉ API, mặc định http://localhost:5151
//   VITE_USE_API=false    → tắt API, dùng dữ liệu lưu trong trình duyệt (chỉ để xem giao diện khách hàng)
const env = import.meta.env || {};

export const USE_API = String(env.VITE_USE_API ?? "true").toLowerCase() !== "false";
export const API_URL = String(env.VITE_API_URL || "http://localhost:5151").replace(/\/+$/, "");
