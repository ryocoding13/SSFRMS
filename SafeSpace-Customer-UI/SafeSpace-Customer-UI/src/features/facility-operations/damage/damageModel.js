export const DAMAGE_STATUS = {
  AWAITING_RESPONSE: "Chờ bạn phản hồi", RESPONSE_SUBMITTED: "Chờ cơ sở xử lý", CUSTOMER_ACCEPTED: "Đã đồng ý khấu trừ",
  REMEDIATION_ALLOWED: "Được khắc phục · Chờ bạn hoàn tất", AWAITING_INSPECTION: "Chờ kiểm tra khắc phục",
  REJECTED: "Cơ sở đã từ chối", REMEDIATED: "Khắc phục đạt · Bỏ khấu trừ hư hỏng", REMEDIATION_FAILED: "Khắc phục chưa đạt",
};
export const DAMAGE_CHOICES = { AGREE: "Đồng ý khấu trừ theo biên bản", REMEDIATE: "Đề nghị tự khắc phục hoặc mua vật dụng tương đương", DISPUTE: "Khiếu nại nội dung biên bản" };
export const DAMAGE_ACTIONS = ["RESPOND_DAMAGE", "REPORT_DAMAGE_REMEDIATION", "DECIDE_DAMAGE_RESPONSE", "INSPECT_DAMAGE_REMEDIATION"];
const manager = actor => actor.roles?.some(role => ["MANAGER", "FACILITY_MANAGER"].includes(role));
const customer = actor => actor.roles?.includes("CUSTOMER");
export function selectDamageCases(cases, actor, scope) {
  return (cases || []).filter(item => scope === "customer" ? customer(actor) && actor.id != null && item.ownerId != null && String(item.ownerId) === String(actor.id) : manager(actor) && item.facilityId != null && actor.facilityId != null && String(item.facilityId) === String(actor.facilityId));
}
export function vnDateTimeInput(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(" ", "T");
}
export function parseVnDeadline(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || "")) throw new Error("Chọn hạn khắc phục theo giờ Việt Nam.");
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime()) || vnDateTimeInput(date) !== value) throw new Error("Hạn khắc phục không hợp lệ.");
  return date.toISOString();
}
const text = (value, required, label) => {
  const result = String(value || "").trim();
  if (required && !result) throw new Error(`Vui lòng nhập ${label}.`);
  if (result.length > 1000) throw new Error(`${label} không quá 1.000 ký tự.`);
  return result;
};
export function validateDamageFiles(files = []) {
  if (!Array.isArray(files) || files.length > 5) throw new Error("Chỉ đính kèm tối đa 5 ảnh.");
  if (files.some(file => !["image/jpeg", "image/png"].includes(file.type) || !(file.size > 0) || file.size > 5 * 1024 * 1024)) throw new Error("Ảnh phải là JPG/PNG, mỗi ảnh không quá 5 MB.");
}
export function prepareDamageAction(item, action, payload, actor, now = new Date()) {
  if (!item || !DAMAGE_ACTIONS.includes(action)) throw new Error("Không tìm thấy hồ sơ hoặc thao tác hợp lệ.");
  const isCustomer = ["RESPOND_DAMAGE", "REPORT_DAMAGE_REMEDIATION"].includes(action);
  if (!selectDamageCases([item], actor, isCustomer ? "customer" : "manager").length) throw new Error("Bạn không có quyền xử lý hồ sơ này.");
  if (item.settlementStatus !== "OPEN") throw new Error("Hồ sơ đã chốt đối soát hoặc chưa có trạng thái đối soát hợp lệ. Vui lòng liên hệ cơ sở.");
  if (!Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion !== item.version) throw new Error("Hồ sơ đã thay đổi. Vui lòng tải lại trước khi gửi.");
  const result = { id: item.id, expectedVersion: item.version };
  if (action === "RESPOND_DAMAGE") {
    if (item.status !== "AWAITING_RESPONSE") throw new Error("Hồ sơ này đã có phản hồi. Vui lòng tải lại.");
    if (!DAMAGE_CHOICES[payload.choice]) throw new Error("Chọn một phương án phản hồi.");
    validateDamageFiles(payload.files || []);
    return { ...result, choice: payload.choice, note: text(payload.note, payload.choice !== "AGREE", "nội dung phản hồi") };
  }
  if (action === "DECIDE_DAMAGE_RESPONSE") {
    if (item.status !== "RESPONSE_SUBMITTED") throw new Error("Hồ sơ không ở bước chờ cơ sở xử lý.");
    if (!["ALLOW", "REJECT"].includes(payload.decision)) throw new Error("Chọn quyết định của cơ sở.");
    const note = text(payload.note, payload.decision === "REJECT", "lý do xử lý");
    if (payload.decision === "REJECT") return { ...result, decision: "REJECT", note };
    const deadline = parseVnDeadline(payload.deadline);
    if (Date.parse(deadline) <= now.getTime()) throw new Error("Hạn khắc phục phải ở tương lai theo giờ Việt Nam.");
    return { ...result, decision: "ALLOW", note, deadline };
  }
  if (action === "REPORT_DAMAGE_REMEDIATION") {
    if (item.status !== "REMEDIATION_ALLOWED") throw new Error("Cơ sở chưa cho phép khắc phục hoặc bạn đã gửi kết quả.");
    if (!item.deadline || !Number.isFinite(Date.parse(item.deadline)) || Date.parse(item.deadline) <= now.getTime()) throw new Error("Đã hết hạn khắc phục. Liên hệ cơ sở để được xử lý; không tự gửi lại.");
    validateDamageFiles(payload.files || []);
    return { ...result, note: text(payload.note, true, "nội dung đã khắc phục") };
  }
  if (item.status !== "AWAITING_INSPECTION") throw new Error("Khách chưa báo khắc phục xong hoặc hồ sơ đã được kiểm tra.");
  if (!["PASS", "FAIL"].includes(payload.result)) throw new Error("Chọn kết quả kiểm tra.");
  return { ...result, result: payload.result, note: text(payload.note, true, "ghi chú kiểm tra") };
}
export function expectedDamageStatus(action, payload) {
  if (action === "RESPOND_DAMAGE") return payload.choice === "AGREE" ? "CUSTOMER_ACCEPTED" : "RESPONSE_SUBMITTED";
  if (action === "DECIDE_DAMAGE_RESPONSE") return payload.decision === "ALLOW" ? "REMEDIATION_ALLOWED" : "REJECTED";
  return action === "REPORT_DAMAGE_REMEDIATION" ? "AWAITING_INSPECTION" : payload.result === "PASS" ? "REMEDIATED" : "REMEDIATION_FAILED";
}
// Chỉ dùng cho mô phỏng opt-in. Không gọi hàm này để quyết toán dữ liệu API thật.
export function applyDamageAction(cases, action, payload, actor, now = new Date()) {
  const item = cases.find(c => c.id === payload.id);
  const clean = prepareDamageAction(item, action, payload, actor, now);
  const next = { ...structuredClone(item), status: expectedDamageStatus(action, clean), version: item.version + 1 };
  const files = (payload.files || []).map(file => ({ fileName: file.name, contentType: file.type, size: file.size }));
  if (action === "RESPOND_DAMAGE") next.response = { choice: clean.choice, note: clean.note, files, at: now.toISOString() };
  if (action === "DECIDE_DAMAGE_RESPONSE") { next.decision = { decision: clean.decision, note: clean.note, at: now.toISOString() }; if (clean.deadline) next.deadline = clean.deadline; }
  if (action === "REPORT_DAMAGE_REMEDIATION") next.remediation = { note: clean.note, files, at: now.toISOString() };
  if (action === "INSPECT_DAMAGE_REMEDIATION") { next.inspection = { result: clean.result, note: clean.note, at: now.toISOString() }; if (clean.result === "PASS") next.damageDeduction = 0; }
  if ([next.deposit, next.otherDeductions, next.damageDeduction].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
    next.refundPreview = Math.max(0, next.deposit - Math.min(next.deposit, next.otherDeductions + next.damageDeduction));
    next.refundIfRemedied = Math.max(0, next.deposit - Math.min(next.deposit, next.otherDeductions));
  }
  next.history = [...(next.history || []), { action, by: actor.name || actor.id, at: now.toISOString() }];
  return cases.map(c => c.id === item.id ? next : c);
}
export function createDamageSeed(now = new Date()) {
  const basic = { facilityId: 1, unit: "B-015", item: "Cửa kho cong bản lề", damageAmount: 200000, damageDeduction: 200000, deposit: 1150000, otherDeductions: 287500, refundPreview: 662500, refundIfRemedied: 862500, status: "AWAITING_RESPONSE", version: 1, settlementStatus: "OPEN", recordedBy: "Trần Văn Long", recordedAt: now.toISOString(), photos: [], history: [] };
  return [
    { ...basic, id: "HH-local-0086", ownerId: 101, customer: "Nguyễn Thị Mai", contractId: "HĐ-2026-0086" },
    { ...basic, id: "HH-api-0001", ownerId: 3, customer: "Nguyễn Văn An", contractId: "HĐ-2026-0001" },
    { ...basic, id: "HH-inspect-0086", ownerId: 101, customer: "Nguyễn Thị Mai", contractId: "HĐ-2026-0086", item: "Kệ lưu trữ bị cong", status: "AWAITING_INSPECTION", version: 4, response: { choice: "REMEDIATE", note: "Đề nghị thay kệ tương đương.", at: now.toISOString(), files: [] }, deadline: new Date(now.getTime() + 86400000).toISOString(), remediation: { note: "Đã thay kệ mới, đề nghị kiểm tra.", at: now.toISOString(), files: [] } },
  ];
}
