// Kết nối backend SSFRMS (StorageProject.Api).
//   VITE_USE_API=true   → gọi API thật cho các luồng backend đã có
//   VITE_API_URL        → địa chỉ API, mặc định http://localhost:5151
const env = import.meta.env || {};

export const USE_API = String(env.VITE_USE_API || "").toLowerCase() === "true";
export const API_URL = String(env.VITE_API_URL || "http://localhost:5151").replace(/\/+$/, "");
