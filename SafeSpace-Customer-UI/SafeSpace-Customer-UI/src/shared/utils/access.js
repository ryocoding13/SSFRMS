/** #59: thời điểm mở được cửa — ghi "từ 00:00 ngày …", không ghi "sau ngày …" (dễ hiểu là ngày hôm sau). */
export const usableFromText = (iso) => `Có thể mở cửa từ 00:00 ngày ${String(iso || "").slice(0, 10).split("-").reverse().join("/")}`;
export const notYetMessage = (iso) => `Chưa đến ngày sử dụng. ${usableFromText(iso)}.`;

// UI-only simulator. Never use this validator as a physical door authorization boundary.
/** D68: đã hẹn trả kho nhưng chưa tới ngày hẹn → QR/PIN vẫn dùng được. */
export const beforeReturnDay = (contract, date) =>
  contract?.status === "RETURN_PENDING" && Boolean(contract.return_date) && String(contract.return_date).slice(0, 10) > String(date).slice(0, 10);
export const returnLockMessage = (contract) =>
  contract?.return_date ? `Bạn đã hẹn trả kho ngày ${String(contract.return_date).slice(0, 10).split("-").reverse().join("/")}. QR/PIN khoá từ ngày này.` : "QR đã hết hiệu lực do đã gửi trả kho.";

export function accessError(contract, date) {
  if (!contract) return "Không tìm thấy hợp đồng thuộc tài khoản của bạn.";
  const keep = beforeReturnDay(contract, date);
  if (!keep && ["ENDED", "TERMINATED", "CANCELLED", "RETURNED", "RETURN_PENDING", "RETURN_REQUESTED"].includes(contract.status)) return "Mã đã hết hiệu lực — hợp đồng đã trả kho.";
  if (contract.access_issued === false || contract.status === "DRAFT") return "Mã ra vào chưa được cấp.";
  if (!contract.start_date || !contract.end_date || date < contract.start_date.slice(0, 10) || date >= contract.end_date.slice(0, 10)) return "Mã đã hết hiệu lực hoặc hợp đồng chưa đến ngày bắt đầu.";
  if (!keep && !["ACTIVE", "EXPIRING"].includes(contract.status)) return "Hợp đồng không còn hiệu lực.";
  return "";
}
export function validateAccess({ contract, credential, code, unit, owner, date }) {
  const error = accessError(contract, date);
  if (error) return { allowed: false, message: error };
  if (!credential || credential.owner !== owner || credential.contractId !== contract.contract_id || credential.date !== date || credential.unit !== unit || contract.unit_number !== unit || !code || (code !== credential.code && code.replace(/\s/g, "") !== credential.backupCode)) return { allowed: false, message: "Mã không hợp lệ hoặc không đúng ô kho." };
  return { allowed: true };
}
