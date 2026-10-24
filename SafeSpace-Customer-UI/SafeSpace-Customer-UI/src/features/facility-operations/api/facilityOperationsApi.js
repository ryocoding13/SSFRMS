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
    res = await request("/api/ops/board");
  } catch (err) {
    if (path !== "/api/ops/board" && [404, 405].includes(err.status)) {
      res = await request(path);
    } else {
      throw err;
    }
  }
  const data = fromApi(res);
  const lists = ["payments", "allocations", "verifications", "handovers", "returns", "tickets", "renewals", "contracts", "assignments", "units", "staff"];
  return {
    version: 1,
    log: [],
    payments: [], allocations: [], verifications: [], handovers: [], returns: [], tickets: [],
    renewals: [], contracts: [], refunds: [], fee_collections: [], assignments: [], units: [], staff: [],
    revenue: { months: [], by_type: [], as_of: null },
    ...data,
    ...Object.fromEntries(lists.map(key => [key, Array.isArray(data[key]) ? data[key] : []])),
    revenue: data.revenue ?? { months: [], by_type: [], as_of: null },
  };
}

// Mỗi thao tác của giao diện → một endpoint theo vai trò (staff / manager)
export const OPS_ACTIONS = {
  // Nhân viên (Staff)
  CONFIRM_PAYMENT: ({ id }) => ["POST", `/api/ops/payments/${enc(id)}/confirm`],
  // S09f · Backend chưa có (BACKEND-TODO.md mục S09f)
  CONFIRM_FEE_COLLECTION: ({ id }) => ["POST", `/api/ops/fees/${enc(id)}/confirm`],
  REPORT_MISMATCH: ({ id, note }) => ["POST", `/api/ops/payments/${enc(id)}/mismatch`, { note }],
  VERIFY_CUSTOMER: ({ id, doc_type, doc_no, photo_ok, info_ok }) => [
    "POST", `/api/ops/verifications/${enc(id)}`, { docType: doc_type, docNumber: String(doc_no || "").trim(), photoMatched: Boolean(photo_ok), infoMatched: Boolean(info_ok) },
  ],
  RECORD_KEY_RECEIPT: ({ id }) => ["POST", `/api/ops/keys/${enc(id)}/receipt`],
  SUBMIT_RETURN: ({ id, report }) => ["POST", `/api/ops/returns/${enc(id)}/inspection`, toApi(report)],
  TICKET_RESPONSE: ({ id, note, next }) => ["POST", `/api/ops/tickets/${enc(id)}/responses`, { note, nextStatus: next }],
  // M02a · F12: đổi trạng thái ô (backend nhận mã ô hoặc id), dùng chung cho nhân viên và quản lý
  UPDATE_UNIT_STATUS: ({ id, code, status, reason }) => ["PUT", `/api/staff/units/${enc(code ?? id)}/status`, { status, reason: String(reason || "").trim() }],
  REVOKE_CREDENTIAL: ({ id }) => ["POST", `/api/staff/credentials/${enc(id)}/revoke`],
  REISSUE_CREDENTIAL: ({ unit, type, reason }) => ["POST", `/api/staff/credentials/reissue`, { unitCode: unit, credentialType: type, reason }],

  // Quản lý (Manager)
  DECIDE_RENEWAL: ({ id, approve, reason }) =>
    approve ? ["POST", `/api/ops/renewals/${enc(id)}/approve`] : ["POST", `/api/ops/renewals/${enc(id)}/reject`, { reason }],
  ALLOCATE: ({ id, unit }) => ["POST", `/api/ops/allocations/${enc(id)}`, { unitCode: unit }],
  ASSIGN: ({ id, staff }) => ["PUT", `/api/ops/assignments/${enc(id)}`, { staffId: staff }],
  REMIND: ({ id, note }) => ["POST", `/api/ops/contracts/${enc(id)}/reminders`, { note: note || "" }],
  CONFIRM_REFUND: ({ id }) => ["POST", `/api/ops/contracts/${enc(id)}/refund`],
  // M08 · D27: xác nhận đã chuyển khoản hoàn cho đơn khách huỷ (backend chưa nhận phương thức / mã giao dịch → gửi kèm để lưu sau)
  CONFIRM_RESERVATION_REFUND: ({ id, method, transaction_ref }) => ["POST", `/api/ops/reservations/${enc(id)}/refund`, { method: method || "BANK_TRANSFER", transactionRef: String(transaction_ref || "").trim() || null }],
  // M02b / M02c · CreateStorageUnitRequest / UpdateStorageUnitRequest (OpsDtos.cs). Backend chưa nhận loại kho + cỡ theo tên:
  // gửi kèm unitTypeCode/area để BE chọn đúng UnitType (BACKEND-TODO.md mục M02b).
  CREATE_UNIT: ({ code, location, type, area }) => ["POST", `/api/manager/units`, { unitNumber: code, locationDescription: location || null, unitTypeCode: type, area: Number(area) }],
  UPDATE_UNIT: ({ id, code, location, type, area }) => ["PUT", `/api/manager/units/${enc(id)}`, { unitNumber: code, locationDescription: location || null, unitTypeCode: type, area: Number(area) }],
  LOCK_UNIT: ({ id, reason }) => ["POST", `/api/manager/units/${enc(id)}/lock`, { reason }],
};

export function callAction(type, payload) {
  const make = OPS_ACTIONS[type];
  if (!make) return null;
  const [method, path, body] = make(payload);
  return request(path, { method, body });
}
