// T20 trên main: gửi policyVersion + accepted, xác nhận bằng timestamp do server trả.
export async function submitRenewalWithConsent(api, contractId, months, consent) {
  if (!consent?.version || consent.channel !== "WEB" || !Number.isFinite(Date.parse(consent.acceptedAt))) {
    throw new Error("Vui lòng đọc và đồng ý chính sách hiện hành.");
  }
  const policy = await api.currentRentalPolicy();
  if (!Number.isSafeInteger(Number(policy?.version)) || Number(policy.version) <= 0) throw new Error("Máy chủ chưa cung cấp phiên bản chính sách hợp lệ.");
  if (String(policy.version) !== String(consent.version)) throw new Error("Chính sách đã thay đổi. Vui lòng tải lại trang và đọc bản hiện hành.");
  const dto = await api.requestRenewal(contractId, months, consent);
  const acknowledged = String(dto?.policyVersion) === String(consent.version) && Number.isFinite(Date.parse(dto?.acceptedAt));
  return { dto, acknowledged };
}
