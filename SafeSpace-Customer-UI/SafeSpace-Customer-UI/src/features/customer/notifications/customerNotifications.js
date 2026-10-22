import { contractCode } from "../../../shared/api/apiMappers.js";

// Stable event IDs preserve MARK_READ across refreshes. No credentials are stored in notices.
export function customerNotifications({ contracts = [], tickets = [], reservations = [] }) {
  const events = [];
  const add = (id, title, detail, to, at) => events.push({ id: `SERVER-${id}`, title, detail, to, created_at: at || new Date().toISOString(), read: false });
  for (const r of reservations) {
    if (["CONFIRMED", "UNIT_ASSIGNED", "CHECKED_IN"].includes(r.status)) add(`PAID-${r.reservationId}`, "Đã xác nhận thanh toán", "Theo dõi hợp đồng và mã ra vào trong tài khoản.", "reservations", r.paidAt || r.createdAt);
  }
  for (const c of contracts) {
    const to = `units/${contractCode(c)}`;
    if (["ACTIVE", "EXPIRING", "OVERDUE"].includes(c.status)) add(`CONTRACT-${c.contractId}`, "Đã cấp hợp đồng và mã ra vào", `Kho ${c.unitNumber} · QR/PIN có hiệu lực theo kỳ thuê. Chìa khóa nhận tại quầy.`, to, c.activatedAt || c.createdAt);
    if (c.accessUpdatedAt) add(`ACCESS-${c.contractId}-${c.accessUpdatedAt}`, "Mã ra vào đã được cấp lại", `Kho ${c.unitNumber} · Xem QR/PIN mới trong hợp đồng. Mã cũ cùng loại đã bị vô hiệu hóa.`, to, c.accessUpdatedAt);
    if (c.handover?.handoverAt) add(`KEY-${c.contractId}-${c.handover.handoverAt}`, "Đã ghi nhận nhận chìa khóa", `Kho ${c.unitNumber} · Chìa khóa vật lý đã được nhận tại quầy.`, to, c.handover.handoverAt);
    if (["RETURN_PENDING", "COMPLETED", "TERMINATED", "CANCELLED"].includes(c.status)) add(`CONTRACT-STATUS-${c.contractId}-${c.status}`, "Hợp đồng có cập nhật", `Kho ${c.unitNumber} · Xem trạng thái và thông tin xử lý.`, to, c.completedAt || c.createdAt);
    for (const renewal of c.renewals || []) if (["APPROVED", "REJECTED", "CANCELLED", "PAID"].includes(renewal.status)) add(`RENEWAL-${renewal.renewalId}-${renewal.status}`, "Yêu cầu gia hạn có cập nhật", `Kho ${c.unitNumber} · Xem kết quả và khoản thanh toán gia hạn.`, to, renewal.approvedAt || renewal.requestedAt);
  }
  for (const t of tickets) {
    const response = t.responses?.at(-1);
    if (response) add(`TICKET-${t.ticketId}-${response.createdAt}`, "Yêu cầu hỗ trợ có phản hồi mới", `${t.title} · ${response.message || "Cơ sở đã phản hồi yêu cầu."}`, "support", response.createdAt);
  }
  return events;
}
