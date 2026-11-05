import { request, ApiError } from "../../../shared/api/httpClient.js";
import { readPhotoData, verifyPhotoFile } from "../../../shared/utils/refundRequest.js";
import { DAMAGE_STATUS, expectedDamageStatus, prepareDamageAction } from "./damageModel.js";
const pathFor = scope => { if (scope === "customer") return "/api/damage-cases"; if (scope === "manager") return "/api/ops/damage-cases"; throw new Error("Phạm vi hồ sơ không hợp lệ."); };
export function normalizeDamageCase(value) {
  if (!value || typeof value.id !== "string" || !value.id || typeof value.contractId !== "string" || !value.contractId || !Number.isSafeInteger(value.version) || value.version < 1 || !DAMAGE_STATUS[value.status] || !Number.isSafeInteger(value.ownerId) || value.ownerId <= 0 || !Number.isSafeInteger(value.facilityId) || value.facilityId <= 0 || !["OPEN", "FINALIZED"].includes(value.settlementStatus) || typeof value.damageAmount !== "number" || !Number.isFinite(value.damageAmount) || value.damageAmount < 0) throw new Error("Máy chủ trả hồ sơ hư hỏng chưa đầy đủ hoặc sai định dạng.");
  for (const field of ["response", "remediation", "decision", "inspection"]) {
    const record = value[field];
    if (record != null && (typeof record !== "object" || Array.isArray(record))) throw new Error("Nội dung phản hồi/kiểm tra không hợp lệ.");
    if (record && ["note", "at"].some(key => record[key] != null && typeof record[key] !== "string")) throw new Error("Nội dung hoặc thời điểm phản hồi không hợp lệ.");
    if (record?.files != null && (!Array.isArray(record.files) || record.files.some(file => !file || typeof file.fileName !== "string"))) throw new Error("Danh sách tệp đính kèm không hợp lệ.");
  }
  return { ...value, photos: Array.isArray(value.photos) ? value.photos : [] };
}
function explain(error) {
  if ([404,405].includes(error.status)) return new ApiError("Máy chủ chưa hỗ trợ luồng hư hỏng/khắc phục. Dữ liệu chưa được ghi nhận; vui lòng liên hệ cơ sở.", error.status);
  return error;
}
export async function loadDamageCases(scope) {
  try {
    const dto = await request(pathFor(scope));
    if (!dto || !Array.isArray(dto.items)) throw new Error("Máy chủ chưa trả danh sách hồ sơ hư hỏng hợp lệ.");
    return dto.items.map(normalizeDamageCase);
  } catch (error) { throw explain(error); }
}
export async function saveDamageAction(scope, item, action, payload, actor, now = new Date()) {
  if ((scope === "customer") !== ["RESPOND_DAMAGE", "REPORT_DAMAGE_REMEDIATION"].includes(action)) throw new Error("Thao tác không đúng phạm vi tài khoản.");
  const clean = prepareDamageAction(item, action, payload, actor, now);
  const files = payload.files || [];
  const photos = [];
  for (const file of files) { await verifyPhotoFile(file); photos.push(await readPhotoData(file)); }
  let dto;
  try { dto = await request(`${pathFor(scope)}/actions`, { method: "POST", body: { action, ...clean, ...(photos.length ? { photos } : {}) } }); }
  catch (error) { throw explain(error); }
  try {
    const result = normalizeDamageCase(dto?.case);
    if (result.id !== item.id || result.contractId !== item.contractId || String(result.ownerId) !== String(item.ownerId) || String(result.facilityId) !== String(item.facilityId) || result.version <= item.version || result.status !== expectedDamageStatus(action, clean)) throw new Error("Kết quả không khớp thao tác hoặc hồ sơ.");
    if (action === "INSPECT_DAMAGE_REMEDIATION" && clean.result === "PASS" && result.damageDeduction !== 0) throw new Error("Máy chủ chưa xác nhận bỏ khấu trừ hư hỏng.");
    return result;
  } catch (error) { error.uncertain = true; error.message = `Máy chủ chưa xác nhận đầy đủ kết quả. Tải lại hồ sơ trước khi gửi tiếp. ${error.message}`; throw error; }
}
