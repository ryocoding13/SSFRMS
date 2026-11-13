import { contractCode } from "../../../shared/api/apiMappers.js";
import { dateLabel, money } from "../../../shared/utils/format.js";

// Stable event IDs preserve MARK_READ across refreshes. No credentials are stored in notices.
const ddmm = value => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(value || "")); return m ? `${m[3]}/${m[2]}${m[4] ? ` · ${m[4]}:${m[5]}` : ""}` : ""; };
// Giờ Việt Nam không kèm múi giờ từ BE → ISO để sắp xếp chuông.
const vnIso = value => { const t = Date.parse(/[zZ]|[+-]\d{2}:\d{2}$/.test(String(value || "")) ? value : `${value}+07:00`); return Number.isFinite(t) ? new Date(t).toISOString() : undefined; };

export function customerNotifications({ contracts = [], tickets = [], reservations = [], unitConflicts = [] }) {
  const events = [];
  const add = (id, title, detail, to, at) => events.push({ id: `SERVER-${id}`, title, detail, to, created_at: at || new Date().toISOString(), read: false });
  for (const r of reservations) {
    if (["CONFIRMED", "UNIT_ASSIGNED", "CHECKED_IN"].includes(r.status)) add(`PAID-${r.reservationId}`, "Đã xác nhận thanh toán", "Theo dõi hợp đồng và mã ra vào trong tài khoản.", "reservations", r.paidAt || r.createdAt);
  }
  for (const c of contracts) {
    const to = `units/${contractCode(c)}`;
    if (["ACTIVE", "EXPIRING", "OVERDUE"].includes(c.status)) add(`CONTRACT-${c.contractId}`, "Đã cấp hợp đồng và mã ra vào", `Kho ${c.unitNumber} · QR/PIN có hiệu lực theo kỳ thuê. Chìa khóa nhận tại quầy.`, to, c.activatedAt || c.createdAt);
    if (["ACTIVE", "EXPIRING", "OVERDUE"].includes(c.status) && c.overdue?.overdueDays > 0 && !c.overdue.isSettled) {
      add(`OVERDUE-${c.contractId}-${c.endDate}`, "Hợp đồng đã quá hạn",
        `${contractCode(c)} · Kho ${c.unitNumber} · Hạn thuê ${dateLabel(c.endDate)} · Quá hạn ${c.overdue.overdueDays} ngày · Khấu trừ tạm tính ${money(c.overdue.overdueFee)}. Gia hạn nếu đủ điều kiện, gửi yêu cầu trả kho hoặc liên hệ cơ sở.`,
        to, vnIso(`${c.overdue.asOfDate}T00:00:00`));
    }
    if (c.accessUpdatedAt) add(`ACCESS-${c.contractId}-${c.accessUpdatedAt}`, "Mã ra vào đã được cấp lại", `Kho ${c.unitNumber} · Xem QR/PIN mới trong hợp đồng. Mã cũ cùng loại đã bị vô hiệu hóa.`, to, c.accessUpdatedAt);
    if (c.handover?.handoverAt) add(`KEY-${c.contractId}-${c.handover.handoverAt}`, "Đã ghi nhận nhận chìa khóa", `Kho ${c.unitNumber} · Chìa khóa vật lý đã được nhận tại quầy.`, to, c.handover.handoverAt);
    if (["RETURN_PENDING", "COMPLETED", "TERMINATED", "CANCELLED"].includes(c.status)) add(`CONTRACT-STATUS-${c.contractId}-${c.status}`, "Hợp đồng có cập nhật", `Kho ${c.unitNumber} · Xem trạng thái và thông tin xử lý.`, to, c.completedAt || c.createdAt);
    for (const renewal of c.renewals || []) if (["APPROVED", "REJECTED", "CANCELLED", "PAID"].includes(renewal.status)) add(`RENEWAL-${renewal.renewalId}-${renewal.status}`, "Yêu cầu gia hạn có cập nhật", `Kho ${c.unitNumber} · Xem kết quả và khoản thanh toán gia hạn.`, to, renewal.approvedAt || renewal.requestedAt);
  }
  // D41 / D45 mục 11 (chốt 07/11: chỉ chuông, không email): đề xuất đổi kho trước ngày nhận và kết quả tự đổi.
  for (const x of Array.isArray(unitConflicts) ? unitConflicts : []) {
    if (!x?.id || !x.contractId) continue;
    const to = `units/${x.contractId}/unit-change`;
    if (x.status === "OPEN") add(`UNIT-CHANGE-${x.id}`, `Kho ${x.oldUnit} chưa sẵn sàng ngày ${ddmm(x.startDate)}`,
      `${x.contractId} · Chọn đổi ngang, nâng cấp miễn phí, dời ngày hoặc huỷ hoàn 100%${x.expiresAt ? ` trước ${ddmm(x.expiresAt)}` : ""}.`, to, vnIso(x.detectedAt));
    else if (["AUTO_SWAP", "AUTO_UPGRADE"].includes(x.resolution)) add(`UNIT-CHANGE-${x.id}-AUTO`, "Hệ thống đã tự đổi kho",
      `${x.contractId} · Quá 48 giờ chưa chọn, đơn chuyển sang ô ${x.newUnit || x.proposedUnit || "mới"}. QR/PIN cấp lại cho ô mới.`, to, vnIso(x.resolvedAt));
  }
  for (const t of tickets) {
    const response = t.responses?.at(-1);
    if (response) add(`TICKET-${t.ticketId}-${response.createdAt}`, "Yêu cầu hỗ trợ có phản hồi mới", `${t.title} · ${response.message || "Cơ sở đã phản hồi yêu cầu."}`, "support", response.createdAt);
  }
  return events;
}
