// Mục "Hoàn tiền" của Quản lý (#7 · 12/11): ba loại hoàn tiền lọc trong cùng một trang.
export const REFUND_KINDS = [["", "Tất cả"], ["cancel", "Đơn huỷ"], ["deposit", "Hoàn cọc trả kho"], ["cash", "Tiền mặt tại quầy"]];
export const refundKindOf = (k) => (REFUND_KINDS.some(([key]) => key === k) ? k : "");
export function refundPendingCounts(ops) {
  const n = (list, test) => (list || []).filter(test).length;
  return {
    cancel: n(ops?.refunds, (r) => r.status === "PENDING"),
    deposit: n(ops?.deposit_refunds, (r) => r.status === "PENDING"),
    cash: n(ops?.cash_refunds, (r) => r.status === "WAITING_APPROVAL"),
  };
}
