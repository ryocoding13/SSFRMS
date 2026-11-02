const parseTime = value => { if (!value || typeof value !== "string") return null; const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`); return Number.isFinite(date.getTime()) ? date : null; };

export const POLICY_KEYS = ["payment", "access", "renewal", "overdue", "return", "cancellation", "support"];
export const validPolicyVersion = v => Number.isSafeInteger(Number(v)) && Number(v) > 0;
export function requireRentalPolicy(value, expectedVersion) {
  if (!validPolicyVersion(value?.version) || !value?.sections || POLICY_KEYS.some(key => !String(value.sections[key] || "").trim())) throw new Error("Máy chủ chưa cung cấp đầy đủ nội dung và phiên bản chính sách.");
  if (expectedVersion != null && Number(value.version) !== Number(expectedVersion)) throw new Error("Máy chủ trả sai phiên bản chính sách. Chưa thể hiển thị bản đã đồng ý.");
  return { ...value, version: Number(value.version) };
}
export const policyVersionLabel = policy => policy?.displayVersion || (validPolicyVersion(policy?.version) ? `Phiên bản ${policy.version}` : "Chưa có phiên bản");
export function normalizePolicyConsent(value) {
  const version = value?.policyVersion ?? value?.version;
  const acceptedAt = parseTime(value?.acceptedAt ?? value?.accepted_at);
  if (!validPolicyVersion(version) || !acceptedAt || !["WEB", "WEB_CUSTOMER"].includes(value?.channel)) return null;
  return { version: Number(version), accepted_at: acceptedAt.toISOString(), displayVersion: value.displayVersion || null,
    channel: value.channel, customer_id: value.customerId ?? value.customer_id ?? null,
    consent_id: value.consentId ?? value.consent_id ?? null, demo: value.demo === true };
}
export function hasReservationConsent(reservation, customerId, policyVersion) {
  const consent = normalizePolicyConsent(reservation?.policy_consent);
  return Boolean(consent && String(consent.customer_id) === String(customerId) && (policyVersion == null || consent.version === Number(policyVersion)));
}
export const POLICY_REQUIRED = "Vui lòng xác nhận chính sách hiện hành trước khi thanh toán.";
