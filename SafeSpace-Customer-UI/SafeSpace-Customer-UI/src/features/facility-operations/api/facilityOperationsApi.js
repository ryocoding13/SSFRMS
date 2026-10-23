// API khu vận hành (Nhân viên cơ sở / Quản lý cơ sở): StorageProject.Api/Endpoints/FacilityOpsEndpoints.cs,
// tài liệu ở docs/facility-ops-api.md; mock/mock-api.mjs (MOCK_OPS=1) chạy cùng hợp đồng để thử không cần .NET.
// Backend cũ trả 404 cho GET /api/ops/board → giao diện dùng dữ liệu cục bộ trong trình duyệt (ops/store.jsx).
import { request } from "../../../shared/api/httpClient.js";

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

// GET /api/staff/board hoặc /api/manager/board (hỗ trợ /api/ops/board dự phòng)
export async function loadBoard(role) {
  let res;
  const path = role === "MANAGER" ? "/api/manager/board" : (role === "STAFF" ? "/api/staff/board" : "/api/ops/board");
  try {
    res = await request(path);
  } catch (err) {
    if (path !== "/api/ops/board") {
      res = await request("/api/ops/board");
    } else {
      throw err;
    }
  }
  const data = fromApi(res);
  // Board theo vai trò có thể trả null cho danh sách không sử dụng.
  const lists = ["payments", "allocations", "verifications", "handovers", "returns", "tickets", "renewals", "contracts", "assignments", "units", "staff"];
  return {
    version: 1,
    log: [],
    payments: [], allocations: [], verifications: [], handovers: [], returns: [], tickets: [],
    renewals: [], contracts: [], assignments: [], units: [], staff: [],
    revenue: { months: [], by_type: [], as_of: null },
    ...data,
    ...Object.fromEntries(lists.map((key) => [key, Array.isArray(data[key]) ? data[key] : []])),
    revenue: data.revenue ?? { months: [], by_type: [], as_of: null },
  };
}

// Mỗi thao tác của giao diện → một endpoint theo vai trò (staff / manager)
export const OPS_ACTIONS = {
  // Nhân viên (Staff)
  CONFIRM_PAYMENT: ({ id }) => ["POST", `/api/staff/payments/${enc(id)}/confirm`],
  REPORT_MISMATCH: ({ id, note }) => ["POST", `/api/staff/payments/${enc(id)}/mismatch`, { note }],
  VERIFY_CUSTOMER: ({ id, doc_type, doc_no, photo_ok, info_ok }) => [
    "POST", `/api/staff/verifications/${enc(id)}`, { docType: doc_type, docNumber: String(doc_no || "").trim(), photoMatched: Boolean(photo_ok), infoMatched: Boolean(info_ok) },
  ],
  HANDOVER: ({ id, method }) => ["POST", `/api/staff/handovers/${enc(id)}/complete`, { unlockMethod: method }],
  SUBMIT_RETURN: ({ id, report }) => ["POST", `/api/staff/returns/${enc(id)}/inspection`, toApi(report)],
  TICKET_RESPONSE: ({ id, note, next }) => ["POST", `/api/staff/tickets/${enc(id)}/responses`, { note, nextStatus: next }],
  // M02a · F12: đổi trạng thái ô (backend nhận mã ô hoặc id), dùng chung cho nhân viên và quản lý
  UPDATE_UNIT_STATUS: ({ id, code, status, reason }) => ["PUT", `/api/staff/units/${enc(code ?? id)}/status`, { status, reason: String(reason || "").trim() }],
  REVOKE_CREDENTIAL: ({ id }) => ["POST", `/api/staff/credentials/${enc(id)}/revoke`],
  REISSUE_CREDENTIAL: ({ unit, type, reason }) => ["POST", `/api/staff/credentials/reissue`, { unitCode: unit, credentialType: type, reason }],

  // Quản lý (Manager)
  DECIDE_RENEWAL: ({ id, approve, reason }) =>
    approve ? ["POST", `/api/manager/renewals/${enc(id)}/approve`] : ["POST", `/api/manager/renewals/${enc(id)}/reject`, { reason }],
  ALLOCATE: ({ id, unit }) => ["POST", `/api/manager/allocations/${enc(id)}`, { unitCode: unit }],
  ASSIGN: ({ id, staff }) => ["PUT", `/api/manager/assignments/${enc(id)}`, { staffId: staff }],
  REMIND: ({ id, note }) => ["POST", `/api/manager/contracts/${enc(id)}/reminders`, { note: note || "" }],
  CONFIRM_REFUND: ({ id }) => ["POST", `/api/manager/contracts/${enc(id)}/refund`],
  CREATE_UNIT: (data) => ["POST", `/api/manager/units`, toApi(data)],
  UPDATE_UNIT: ({ id, ...data }) => ["PUT", `/api/manager/units/${enc(id)}`, toApi(data)],
  LOCK_UNIT: ({ id, reason }) => ["POST", `/api/manager/units/${enc(id)}/lock`, { reason }],
};

export function callAction(type, payload) {
  const make = OPS_ACTIONS[type];
  if (!make) return null;
  const [method, path, body] = make(payload);
  return request(path, { method, body });
}
