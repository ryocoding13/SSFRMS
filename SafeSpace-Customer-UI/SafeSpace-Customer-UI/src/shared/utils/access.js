// UI-only simulator. Never use this validator as a physical door authorization boundary.
export function accessError(contract, date) {
  if (!contract) return "Không tìm thấy hợp đồng thuộc tài khoản của bạn.";
  if (["ENDED", "TERMINATED", "CANCELLED", "RETURNED", "RETURN_PENDING", "RETURN_REQUESTED"].includes(contract.status)) return "Mã đã hết hiệu lực — hợp đồng đã trả kho.";
  if (contract.access_issued === false || contract.status === "DRAFT") return "Mã ra vào chưa được cấp.";
  if (!contract.start_date || !contract.end_date || date < contract.start_date.slice(0, 10) || date >= contract.end_date.slice(0, 10)) return "Mã đã hết hiệu lực hoặc hợp đồng chưa đến ngày bắt đầu.";
  if (!["ACTIVE", "EXPIRING"].includes(contract.status)) return "Hợp đồng không còn hiệu lực.";
  return "";
}
export function validateAccess({ contract, credential, code, unit, owner, date }) {
  const error = accessError(contract, date);
  if (error) return { allowed: false, message: error };
  if (!credential || credential.owner !== owner || credential.contractId !== contract.contract_id || credential.date !== date || credential.unit !== unit || contract.unit_number !== unit || !code || (code !== credential.code && code.replace(/\s/g, "") !== credential.backupCode)) return { allowed: false, message: "Mã không hợp lệ hoặc không đúng ô kho." };
  return { allowed: true };
}
