import { request } from "../../../shared/api/httpClient.js";

// Hợp đồng FE dự kiến; 404/405 được báo rõ, tuyệt đối không fallback thành công.
const RESOURCES = { customerRefunds: "/api/deposit-refunds", discrepancies: "/api/ops/discrepancies", overdue: "/api/ops/overdue-cases", depositRefunds: "/api/ops/deposit-refunds", counterRenewals: "/api/ops/counter-renewals", inquiries: "/api/support/inquiries", policy: "/api/rental-policy" };
export async function loadWorkflow(resource) {
  if (!RESOURCES[resource]) throw new Error("Nguồn dữ liệu không hợp lệ.");
  try { return await request(RESOURCES[resource], { auth: resource !== "policy" }); }
  catch (error) { if ([404, 405].includes(error.status)) throw new Error("Máy chủ chưa cung cấp dữ liệu cho chức năng này. Vui lòng thử lại sau hoặc liên hệ cơ sở."); throw error; }
}
export async function saveWorkflow(resource, action, payload) {
  if (!RESOURCES[resource]) throw new Error("Nguồn dữ liệu không hợp lệ.");
  try { return await request(`${RESOURCES[resource]}/actions`, { method: "POST", body: { action, ...payload } }); }
  catch (error) { if ([404, 405].includes(error.status)) throw new Error("Máy chủ chưa hỗ trợ lưu màn này. Dữ liệu chưa được ghi nhận."); throw error; }
}
