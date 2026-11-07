// 3.5 · B04a: hàm thuần cho báo cáo chi tiết một cơ sở (có test). Số tổng FE tự cộng từ danh sách BE trả.
// "Khoản chờ thu" = khoản chưa thanh toán còn hiệu lực (BE: FacilityContractRow.Outstanding); không có công nợ ngoài cọc (D32).
export const OPEN_CONTRACT_STATUSES = ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"];
export const CONTRACT_TONES = { OVERDUE: "red", EXPIRING: "amber", ACTIVE: "green", RETURN_PENDING: "blue", DRAFT: "blue", COMPLETED: "gray", TERMINATED: "gray", CANCELLED: "gray" };

export const contractCodeOf = (row) => `HĐ-${String(row?.startDate || "").slice(0, 4) || "0000"}-${String(row?.contractId ?? "").padStart(4, "0")}`;

export function summarizeFacilityContracts(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const money = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  return {
    active: list.filter((r) => OPEN_CONTRACT_STATUSES.includes(r.status)).length,
    overdue: list.filter((r) => r.status === "OVERDUE").length,
    pending: list.reduce((s, r) => s + money(r.outstanding), 0),
    openCases: list.reduce((s, r) => s + (Number.isSafeInteger(r.overdueCases) && r.overdueCases > 0 ? r.overdueCases : 0), 0),
  };
}

export function facilityContractLine(row, money) {
  const pending = Number(row?.outstanding) > 0 ? `Khoản chờ thu ${money(Number(row.outstanding))}` : "Không có khoản chờ thu";
  const cases = Number(row?.overdueCases) > 0 ? `${row.overdueCases} hồ sơ quá hạn đang mở` : "không có hồ sơ quá hạn";
  return `${pending} · ${cases}`;
}
