// Endpoint khu Quản lý vận hành kinh doanh (StorageProject.Api/Endpoints/OperationsEndpoints.cs), role OPERATIONS.
// Hợp đồng chi tiết: docs/operations-api.md.
import { request, ApiError } from "../../../shared/api/httpClient.js";
import { API_URL } from "../../../app/config/api.js";
async function requestFile(path, { fallbackName = "bao-cao.csv" } = {}) {
  let token;
  try { token = JSON.parse(localStorage.getItem('safespace.customer.session'))?.token; } catch { /* absent session */ }
  let res;
  try { res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); }
  catch { throw new ApiError('Không kết nối được máy chủ. Vui lòng kiểm tra địa chỉ API.', 0); }
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new ApiError(data.error || data.message || `Không xuất được báo cáo (HTTP ${res.status}).`, res.status, data); }
  if(!res.headers.get("content-type")?.toLowerCase().includes("text/csv"))throw new Error("Máy chủ chưa trả tệp CSV hợp lệ. Chưa tải báo cáo.");
  return { blob: await res.blob(), fileName: fallbackName };
}

const q = (params = {}) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const businessApi = {
  // B05 · Cơ sở (UC19)
  facilities: (filter) => request(`/api/operations/facilities${q(filter)}`),
  createFacility: (body) => request("/api/operations/facilities", { method: "POST", body }),
  updateFacility: (id, body) => request(`/api/operations/facilities/${id}`, { method: "PUT", body }),
  setFacilityStatus: (id, status, reason) => request(`/api/operations/facilities/${id}/status`, { method: "PUT", body: { status, reason } }),

  // B02, B03 · Chính sách, khung giá, phí, giảm giá (UC20, UC21)
  policies: (filter) => request(`/api/operations/policies${q(filter)}`),
  createPolicy: (body) => request("/api/operations/policies", { method: "POST", body }),
  updatePolicy: (id, body) => request(`/api/operations/policies/${id}`, { method: "PUT", body }),
  activatePolicy: (id, replaceExisting = false) =>
    request(`/api/operations/policies/${id}/activate${replaceExisting ? "?replaceExisting=true" : ""}`, { method: "POST" }),
  deactivatePolicy: (id) => request(`/api/operations/policies/${id}/deactivate`, { method: "POST" }),
  deletePolicy: (id) => request(`/api/operations/policies/${id}`, { method: "DELETE" }),

  // B03 · Bảng giá thuê
  rates: (filter) => request(`/api/operations/rates${q(filter)}`),
  setRate: (body) => request("/api/operations/rates", { method: "POST", body }),

  // B01, B04 · Báo cáo (UC22, UC23)
  facilityReport: (filter) => request(`/api/operations/reports/facilities${q(filter)}`),
  unitTypeReport: (filter) => request(`/api/operations/reports/unit-types${q(filter)}`),
  revenueTrend: (filter) => request(`/api/operations/reports/revenue-trend${q(filter)}`),
  rentalStatus: (filter) => request(`/api/operations/reports/rental-status${q(filter)}`),
  exportReport: (filter, fallbackName) => requestFile(`/api/operations/reports/export${q(filter)}`, { fallbackName }),

  // Danh mục loại kho (công khai)
  unitTypes: () => request("/api/unit-types", { auth: false }),
};
