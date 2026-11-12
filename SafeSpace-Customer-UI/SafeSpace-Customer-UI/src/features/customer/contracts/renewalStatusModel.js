/**
 * Trạng thái hiển thị của một yêu cầu gia hạn (lượt 3 · #26 #27 #28).
 * Một nguồn cho màn Theo dõi gia hạn, Kho của tôi và Thanh toán:
 * - CHOOSE: đã xác nhận, chưa thanh toán, chưa chọn tại quầy → cho chọn PayOS hoặc tại quầy.
 * - COUNTER: đã chọn tại quầy → không đưa QR nữa.
 * - PAID, EXPIRED, REJECTED, CANCELLED, PENDING.
 */

/** Dòng sổ thu khớp yêu cầu gia hạn (cùng hợp đồng, kỳ mới kết thúc đúng ngày). */
export const renewalLedgerOf = (data, r) => (data.ledger || []).find(l => l.kind === "RENEWAL" && l.contract_id === r.contract_id && l.period?.to === r.new_end) || null;

/** Yêu cầu đã chọn thanh toán tại quầy (cờ trên yêu cầu hoặc dòng sổ thu đã chuyển AT_COUNTER). */
export const renewalAtCounter = (r, row) => Boolean(r?.at_counter || row?.status === "AT_COUNTER");

export function renewalState(data, r, now = Date.now()) {
  const row = renewalLedgerOf(data, r);
  if (r.status === "PAID" || row?.status === "RECONCILED") return "PAID";
  if (r.status === "REJECTED") return "REJECTED";
  if (r.status === "CANCELLED") return "CANCELLED";
  if (r.status === "EXPIRED" || (r.status === "APPROVED" && r.payment_deadline_at && Date.parse(r.payment_deadline_at) <= now)) return "EXPIRED";
  if (r.status !== "APPROVED") return "PENDING";
  return renewalAtCounter(r, row) ? "COUNTER" : "CHOOSE";
}

const LABEL = {
  CHOOSE: ["Đã xác nhận · Chờ thanh toán", "amber"],
  COUNTER: ["Chờ thu tại quầy", "amber"],
  PAID: ["Đã thanh toán · Đã gia hạn", "green"],
  EXPIRED: ["Đã hết hạn thanh toán", "gray"],
  REJECTED: ["Không gia hạn được", "red"],
  CANCELLED: ["Bạn đã huỷ yêu cầu", "gray"],
  PENDING: ["Đang kiểm tra", "blue"],
};

export function renewalView(data, r, now = Date.now()) {
  const state = renewalState(data, r, now), row = renewalLedgerOf(data, r);
  const counter = renewalAtCounter(r, row);
  const methodLabel = state === "PAID" ? (counter ? "Tại quầy" : "PayOS") : counter ? "Tại quầy" : "Chưa chọn";
  // Chỉ đưa dòng sổ thu cho PayOS khi còn được trả qua QR.
  const ledger = state === "CHOOSE" && row && row.status === "UNPAID" && row.payable !== false ? row : null;
  return { renewal: r, state, label: LABEL[state][0], tone: LABEL[state][1], methodLabel, ledger };
}
