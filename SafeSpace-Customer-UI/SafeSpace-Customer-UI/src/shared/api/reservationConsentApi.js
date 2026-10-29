import { normalizePolicyConsent, requireRentalPolicy } from "../utils/rentalPolicy.js";

export async function recordReservationConsent(api, reservationId, customerId, version) {
  const policy = requireRentalPolicy(await api.currentRentalPolicy());
  if (policy.version !== Number(version)) throw new Error("Chính sách đã thay đổi. Vui lòng tải lại và đọc bản hiện hành trước khi đồng ý.");
  const dto = await api.acceptReservationPolicy(reservationId, policy.version);
  const consent = normalizePolicyConsent(dto);
  if (!consent || consent.version !== policy.version || String(consent.customer_id) !== String(customerId) || !Number.isSafeInteger(Number(consent.consent_id)) || Number(consent.consent_id) <= 0 || consent.demo) {
    throw new Error("Máy chủ chưa xác nhận đầy đủ bằng chứng đồng ý. Chưa mở thanh toán; hãy kiểm tra lại hoặc liên hệ cơ sở.");
  }
  return consent;
}
