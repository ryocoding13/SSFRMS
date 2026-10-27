// D32: chỉ dùng tính minh hoạ khi kiểm kê/demo; số quyết toán chính thức do BE trả.
export const CLEANING_DEPOSIT_RATE = 0.1;
export const NO_RETURN_COLLECTION = "Phí trả kho chỉ khấu trừ trong tiền cọc; không thu thêm tại quầy hoặc qua QR.";
export const isReturnFee = row => Boolean(row?.fee) || ["DAMAGE_FEE", "CLEANING_FEE", "OVERDUE_FEE"].includes(row?.kind);
export const canPayLedger = row => !isReturnFee(row) && row?.kind === "RENEWAL" && row?.payable && row?.status === "UNPAID";
export const cleaningFee = (deposit, required) => required ? Math.round(Number(deposit) * CLEANING_DEPOSIT_RATE) : 0;
export function returnDeductions(ret) {
  const deposit = Math.max(0, Number(ret?.deposit) || 0);
  const report = ret?.report || {};
  const fees = [report.damage_fee, report.overdue_fee, cleaningFee(deposit, report.cleaning_required)];
  const total = fees.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return { owed: total, deduction: Math.min(deposit, total), refund: Math.max(0, deposit - total), debt: 0 };
}
// Máy chủ phải công bố khả năng sau khi T05–T09 được kiểm chứng; không bật bằng env phía FE.
export const supportsReturnPolicy = board => board?.return_policy_version === "D32";
export const RETURN_POLICY_PENDING = "Chức năng chốt trả kho đang chờ cập nhật chính sách tiền cọc. Vui lòng liên hệ quản lý và thử lại sau.";
