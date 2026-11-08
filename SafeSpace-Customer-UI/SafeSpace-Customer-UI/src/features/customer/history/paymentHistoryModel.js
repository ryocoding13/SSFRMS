// 3.6 · Figma C11h / LS02: hàm thuần cho lịch sử thanh toán (có test).
export const KIND_LABELS = { RENT: "Tiền thuê", RENEWAL: "Gia hạn", DEPOSIT: "Tiền cọc", REFUND: "Hoàn tiền", CLEANING_FEE: "Phí vệ sinh", DAMAGE_FEE: "Phí hư hỏng", OVERDUE_FEE: "Phí quá hạn" };
export const METHOD_LABELS = { PAYMENT_GATEWAY: "PayOS", BANK_TRANSFER: "Chuyển khoản", CASH: "Tiền mặt tại quầy", CARD: "Thẻ", E_WALLET: "Ví điện tử" };
export const RECORDED = ["RECONCILED", "REFUNDED", "DEPOSIT_HELD", "DEDUCTED"];

// Khoá tháng theo giờ Việt Nam: "2026-10"
export const vnMonthOf = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? new Date(t + 7 * 3600000).toISOString().slice(0, 7) : null; };
export const monthLabel = (key) => `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}`;

export function methodLabel(row) {
  if (row?.deducted) return "trừ vào cọc";
  return METHOD_LABELS[row?.method] || "Chưa có dữ liệu";
}

export function historyRows(ledger = [], { contract = "", kind = "", month = "" } = {}) {
  return (Array.isArray(ledger) ? ledger : [])
    .filter((r) => RECORDED.includes(r.status))
    .filter((r) => (!contract || r.contract_id === contract) && (!kind || r.kind === kind) && (!month || vnMonthOf(r.paid_at) === month))
    .sort((a, b) => (Date.parse(b.paid_at || "") || 0) - (Date.parse(a.paid_at || "") || 0));
}

export function historyMonths(ledger = []) {
  return [...new Set((Array.isArray(ledger) ? ledger : []).filter((r) => RECORDED.includes(r.status)).map((r) => vnMonthOf(r.paid_at)).filter(Boolean))].sort().reverse();
}
