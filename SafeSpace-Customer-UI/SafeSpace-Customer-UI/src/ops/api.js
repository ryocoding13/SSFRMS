// API khu vận hành (Nhân viên cơ sở / Quản lý cơ sở). Backend StorageProject.Api CHƯA có các endpoint này;
// hợp đồng đề xuất nằm ở BE-CONTRACT.md mục 5 và được mock/mock-api.mjs làm mẫu chạy được.
// Khi backend trả 404 cho GET /api/ops/board, giao diện tự dùng dữ liệu mẫu trong trình duyệt.
import { request } from "../api/http.js";

const enc = encodeURIComponent;

// JSON backend dùng camelCase; giao diện dùng snake_case → đổi khoá đệ quy
const toSnake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
function mapKeys(v, fn) {
  if (Array.isArray(v)) return v.map((x) => mapKeys(x, fn));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [fn(k), mapKeys(x, fn)]));
  return v;
}
export const fromApi = (v) => mapKeys(v, toSnake);
export const toApi = (v) => mapKeys(v, toCamel);

// GET /api/ops/board — toàn bộ dữ liệu vận hành của cơ sở được gán cho tài khoản (lọc theo vai trò)
export async function loadBoard() {
  const data = fromApi(await request("/api/ops/board"));
  return {
    version: 1,
    log: [],
    payments: [], allocations: [], verifications: [], handovers: [], returns: [], tickets: [],
    renewals: [], contracts: [], assignments: [], units: [], staff: [],
    revenue: { months: [], by_type: [], as_of: null },
    ...data,
  };
}

// Mỗi thao tác của giao diện → một endpoint. Thân request theo camelCase như các endpoint hiện có.
export const OPS_ACTIONS = {
  // Nhân viên
  CONFIRM_PAYMENT: ({ id }) => ["POST", `/api/ops/payments/${enc(id)}/confirm`],
  REPORT_MISMATCH: ({ id, note }) => ["POST", `/api/ops/payments/${enc(id)}/mismatch`, { note }],
  VERIFY_CUSTOMER: ({ id, doc_type, doc_no, photo_ok, info_ok }) => [
    "POST", `/api/ops/verifications/${enc(id)}`, { docType: doc_type, docNumber: String(doc_no || "").trim(), photoMatched: Boolean(photo_ok), infoMatched: Boolean(info_ok) },
  ],
  HANDOVER: ({ id, method }) => ["POST", `/api/ops/handovers/${enc(id)}/complete`, { unlockMethod: method }],
  SUBMIT_RETURN: ({ id, report }) => ["POST", `/api/ops/returns/${enc(id)}/inspection`, toApi(report)],
  TICKET_RESPONSE: ({ id, note, next }) => ["POST", `/api/ops/tickets/${enc(id)}/responses`, { note, nextStatus: next }],
  // Quản lý
  DECIDE_RENEWAL: ({ id, approve, reason }) =>
    approve ? ["POST", `/api/ops/renewals/${enc(id)}/approve`] : ["POST", `/api/ops/renewals/${enc(id)}/reject`, { reason }],
  ALLOCATE: ({ id, unit }) => ["POST", `/api/ops/allocations/${enc(id)}`, { unitCode: unit }],
  ASSIGN: ({ id, staff }) => ["PUT", `/api/ops/assignments/${enc(id)}`, { staffId: staff }],
  REMIND: ({ id, note }) => ["POST", `/api/ops/contracts/${enc(id)}/reminders`, { note: note || "" }],
  CONFIRM_REFUND: ({ id }) => ["POST", `/api/ops/contracts/${enc(id)}/refund`],
};

export function callAction(type, payload) {
  const make = OPS_ACTIONS[type];
  if (!make) return null;
  const [method, path, body] = make(payload);
  return request(path, { method, body });
}
