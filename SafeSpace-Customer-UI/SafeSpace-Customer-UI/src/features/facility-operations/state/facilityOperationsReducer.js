// Nghiệp vụ vận hành tại cơ sở (thuần, có test). Mỗi action trả { state, result } hoặc ném OpsError.
import { dateLabel, money } from "../../../shared/utils/format.js";

export class OpsError extends Error {}
const fail = (m) => {
  throw new OpsError(m);
};
const find = (list, id, what) => list.find((x) => x.id === id) || fail(`Không tìm thấy ${what}.`);
const patch = (list, id, fn) => list.map((x) => (x.id === id ? { ...x, ...fn(x) } : x));
const patchUnit = (units, code, fn) => units.map((u) => (u.code === code ? { ...u, ...fn(u) } : u));
const iso = (d) => new Date(d).toISOString();

const addLog = (state, now, text, to, role = "ALL") => ({
  ...state,
  log: [{ id: `L-${now.getTime()}-${state.log.length}`, text, to, role, at: iso(now), read: false }, ...state.log].slice(0, 60),
});

// Diện tích từ nhãn gói → khoảng m² ("Kho lạnh · Cỡ M · 15 m²" → [15, 15]; nhãn cũ "10–20 m²" → [10, 20])
export function areaRange(offer = "") {
  const m = offer.match(/(\d+)\s*[–-]\s*(\d+)\s*m²/);
  if (m) return [Number(m[1]), Number(m[2])];
  const one = offer.match(/(\d+)\s*m²/);
  if (one) return [Number(one[1]), Number(one[1])];
  if (/Trên\s*20/.test(offer)) return [20, 999];
  return [0, 999];
}
export const typeOfOffer = (offer = "") => (/nhiệt độ|lạnh/i.test(offer) ? "climate" : "normal");

// Ô trống phù hợp đơn (M05): đúng loại kho, diện tích trong khoảng, đang trống
export const candidateUnits = (state, allocation) =>
  state.units
    .filter((u) => u.status === "EMPTY" && u.type === allocation.type && u.area >= allocation.min_area && u.area <= allocation.max_area)
    .sort((a, b) => a.area - b.area || a.code.localeCompare(b.code));

const ACTIONS = {
  // S09
  CONFIRM_PAYMENT(state, { id }, now) {
    const p = find(state.payments, id, "khoản thanh toán");
    if (p.status !== "PENDING") fail("Khoản này đã được xử lý.");
    let next = { ...state, payments: patch(state.payments, id, () => ({ status: "CONFIRMED", handled_at: iso(now) })) };
    // Đơn chưa có ô kho → chuyển quản lý phân bổ (M05)
    const hasUnit = state.verifications.some((v) => v.reservation_id === id);
    if (!hasUnit && !state.allocations.some((a) => a.id === id)) {
      const [min_area, max_area] = areaRange(p.offer);
      next.allocations = [
        { id, customer: p.customer, type: typeOfOffer(p.offer), offer: p.offer, min_area, max_area, start: p.start, end: p.end, pickup: p.pickup, status: "PENDING", unit: null },
        ...state.allocations,
      ];
    }
    next = addLog(next, now, `Đã xác nhận thu ${money(p.amount)} · Đơn ${id}`, hasUnit ? "staff" : "manager/allocate", hasUnit ? "STAFF" : "ALL");
    return { state: next, result: { id } };
  },
  REPORT_MISMATCH(state, { id, note }, now) {
    const p = find(state.payments, id, "khoản thanh toán");
    if (p.status !== "PENDING") fail("Khoản này đã được xử lý.");
    if (!String(note || "").trim()) fail("Vui lòng ghi rõ sai lệch (số tiền, nội dung hoặc thời gian).");
    const next = { ...state, payments: patch(state.payments, id, () => ({ status: "MISMATCH", note: note.trim(), handled_at: iso(now) })) };
    return { state: addLog(next, now, `Báo sai lệch thanh toán · Đơn ${id}`, "manager/contracts", "MANAGER"), result: { id } };
  },

  // S02
  VERIFY_CUSTOMER(state, { id, doc_type, doc_no, photo_ok, info_ok }, now) {
    const v = find(state.verifications, id, "lịch xác minh");
    if (v.status === "DONE") fail("Khách hàng này đã được xác minh.");
    if (!/^\d{9}$|^\d{12}$|^[A-Z]\d{7}$/i.test(String(doc_no || "").trim())) fail("Số giấy tờ gồm 9 hoặc 12 chữ số (CCCD/CMND) hoặc 1 chữ + 7 số (hộ chiếu).");
    if (!photo_ok || !info_ok) fail("Đánh dấu cả hai mục đối chiếu trước khi xác minh.");
    const last4 = String(doc_no).trim().slice(-4);
    const next = { ...state, verifications: patch(state.verifications, id, () => ({ status: "DONE", doc_type, doc_last4: last4, verified_at: iso(now) })) };
    return { state: addLog(next, now, `Đã xác minh ${v.customer} · Kho ${v.unit}`, "staff/handover", "STAFF"), result: { id } };
  },

  // S03
  RECORD_KEY_RECEIPT(state, { id }, now) {
    const h = find(state.handovers, id, "lịch nhận chìa khóa");
    if (h.status === "DONE") return { state, result: { id } };
    const v = state.verifications.find(x => x.id === h.verification_id);
    if (v && v.status !== "DONE") fail("Cần xác minh giấy tờ trước khi nhận chìa khóa.");
    const next = { ...state,
      handovers: patch(state.handovers, id, () => ({ status: "DONE", method: "KEY", done_at: iso(now) })),
      assignments: state.assignments.map(a => a.ref === id ? { ...a, status: "DONE" } : a),
    };
    return { state: addLog(next, now, `Khách đã nhận chìa khóa kho ${h.unit}`, "manager/units", "MANAGER"), result: { id } };
  },

  // S04
  SUBMIT_RETURN(state, { id, report }, now) {
    const r = find(state.returns, id, "lịch trả kho");
    if (r.status === "SUBMITTED") fail("Biên bản trả kho đã được gửi.");
    const need = ["items", "walls", "keys", "proposal"];
    if (need.some((k) => !String(report?.[k] || "").trim())) fail("Điền đủ 4 mục kiểm tra trước khi gửi biên bản.");
    const next = {
      ...state,
      returns: patch(state.returns, id, () => ({ status: "SUBMITTED", report, submitted_at: iso(now) })),
      units: patchUnit(state.units, r.unit, () => ({ status: "INSPECTION" })),
      contracts: state.contracts.map((c) => (c.id === r.contract ? { ...c, state: "RETURNED", due: `Còn phải thu ${money(r.unpaid)}` } : c)),
      assignments: state.assignments.map((a) => (a.ref === id ? { ...a, status: "DONE" } : a)),
    };
    return { state: addLog(next, now, `Biên bản trả kho ${r.unit} chờ quản lý xác nhận`, "manager/contracts", "MANAGER"), result: { id } };
  },

  // S05
  TICKET_RESPONSE(state, { id, note, next: status, staff }, now) {
    const t = find(state.tickets, id, "yêu cầu hỗ trợ");
    if (t.status === "DONE") fail("Yêu cầu đã đóng.");
    if (!String(note || "").trim()) fail("Ghi nhận nội dung xử lý trước khi lưu.");
    if (!["IN_PROGRESS", "WAITING_CUSTOMER", "DONE"].includes(status)) fail("Chọn trạng thái tiếp theo.");
    const next = {
      ...state,
      tickets: patch(state.tickets, id, (x) => ({ status, assignee: x.assignee || staff || null, notes: [...x.notes, { text: note.trim(), at: iso(now), staff }] })),
      assignments: status === "DONE" ? state.assignments.map((a) => (a.ref === id ? { ...a, status: "DONE" } : a)) : state.assignments,
    };
    return { state: addLog(next, now, `Cập nhật ${id}: ${TICKET_STATE[status][0]}`, "manager/assign", "MANAGER"), result: { id } };
  },

  REISSUE_CREDENTIAL(state, { unit, type, reason }, now) {
    if (!["QR", "PIN", "KEY"].includes(type)) fail("Chọn QR, PIN hoặc chìa khóa vật lý.");
    if (!String(reason || "").trim()) fail("Nhập lý do cấp lại.");
    if (!state.units.some(u => u.code === unit)) fail("Không tìm thấy kho tại cơ sở.");
    const next = { ...state, handovers: type === "KEY" ? state.handovers.map(h => h.unit === unit ? { ...h, status: "WAITING", done_at: null } : h) : state.handovers };
    return { state: addLog(next, now, `Cấp lại ${type} · Kho ${unit} · ${reason}`, "staff/support", "STAFF"), result: { unit } };
  },

  // M03
  DECIDE_RENEWAL(state, { id, approve, reason }, now) {
    const r = find(state.renewals, id, "yêu cầu gia hạn");
    if (r.status !== "PENDING") fail("Yêu cầu này đã được xử lý.");
    if (!approve && !String(reason || "").trim()) fail("Nhập lý do từ chối để gửi cho khách hàng.");
    let next = { ...state, renewals: patch(state.renewals, id, () => ({ status: approve ? "APPROVED" : "REJECTED", reason: reason?.trim() || null, decided_at: iso(now) })) };
    if (approve) next.units = patchUnit(next.units, r.unit, (u) => ({ end: r.to, status: u.status === "EXPIRING" || u.status === "OVERDUE" ? "ACTIVE" : u.status }));
    next.contracts = next.contracts.map((c) =>
      c.unit === r.unit && c.state === "RENEWAL"
        ? { ...c, state: "RESOLVED", due: approve ? `Đã duyệt gia hạn đến ${dateLabel(r.to)}` : `Từ chối gia hạn · ${reason.trim()}` }
        : c,
    );
    next = addLog(next, now, `${approve ? "Đã duyệt" : "Đã từ chối"} gia hạn ${r.unit} · ${r.customer}`, "manager/renewals", "MANAGER");
    return { state: next, result: { id } };
  },

  // M05
  ALLOCATE(state, { id, unit }, now) {
    const a = find(state.allocations, id, "đơn cần phân bổ");
    if (a.status !== "PENDING") fail("Đơn này đã được phân bổ kho.");
    if (!candidateUnits(state, a).some((u) => u.code === unit)) fail("Kho đã chọn không còn trống hoặc không khớp đơn đặt chỗ.");
    const ref = id.slice(-4);
    const next = {
      ...state,
      allocations: patch(state.allocations, id, () => ({ status: "DONE", unit, allocated_at: iso(now) })),
      units: patchUnit(state.units, unit, () => ({ status: "ACTIVE", tenant: a.customer, end: a.end })),
      verifications: [{ id: `XM-${ref}`, reservation_id: id, customer: a.customer, unit, appointment: a.pickup, status: "TODO" }, ...state.verifications],
      handovers: [{ id: `BG-${ref}`, verification_id: `XM-${ref}`, unit, customer: a.customer, status: "WAITING", method: null }, ...state.handovers],
      assignments: [...state.assignments, { id: `PC-${ref}`, title: `Nhận chìa khóa ${unit} · ${a.customer}`, when: a.pickup, staff: null, status: "OPEN", ref: `BG-${ref}` }],
    };
    return { state: addLog(next, now, `Đã phân bổ kho ${unit} cho đơn ${id}`, "staff/verify", "ALL"), result: { id, unit } };
  },

  // M06
  ASSIGN(state, { id, staff }, now) {
    const a = find(state.assignments, id, "công việc");
    if (a.status === "DONE") fail("Công việc đã hoàn tất.");
    const s = state.staff.find((x) => x.staff_id === staff) || fail("Chọn nhân viên phụ trách.");
    const next = {
      ...state,
      assignments: patch(state.assignments, id, (x) => ({ staff, status: x.status === "OPEN" ? "WAITING" : x.status })),
      tickets: state.tickets.map((t) => (t.id === a.ref ? { ...t, assignee: staff, status: t.status === "OPEN" ? "IN_PROGRESS" : t.status } : t)),
    };
    return { state: addLog(next, now, `Phân công ${s.full_name}: ${a.title}`, "staff", "STAFF"), result: { id } };
  },

  // M07
  REMIND(state, { id, note }, now) {
    find(state.contracts, id, "hợp đồng");
    const text = String(note || "").trim() || "Đã liên hệ nhắc khách thanh toán / xử lý hợp đồng.";
    const next = { ...state, contracts: patch(state.contracts, id, (c) => ({ reminders: [...c.reminders, { text, at: iso(now) }] })) };
    return { state: addLog(next, now, `Đã ghi nhận nhắc khách · ${id}`, "manager/contracts", "MANAGER"), result: { id } };
  },
  CONFIRM_REFUND(state, { id }, now) {
    const c = find(state.contracts, id, "hợp đồng");
    if (c.state !== "RETURNED") fail("Hợp đồng chưa có biên bản trả kho.");
    const r = state.returns.find((x) => x.contract === id);
    const refund = r ? Math.max(0, r.deposit - r.unpaid) : 0;
    const next = {
      ...state,
      contracts: patch(state.contracts, id, () => ({ state: "CLOSED", due: `Hoàn cọc ${money(refund)} sau khi trừ khoản còn nợ` })),
      units: r ? patchUnit(state.units, r.unit, () => ({ status: "EMPTY", tenant: null, end: null })) : state.units,
    };
    return { state: addLog(next, now, `Đã xác nhận hoàn cọc ${money(refund)} · ${id}`, "manager/contracts", "MANAGER"), result: { id, refund } };
  },

  // M08 · Quản lý xác nhận đã chuyển khoản hoàn tiền cho đơn khách huỷ (D27)
  CONFIRM_RESERVATION_REFUND(state, { id, method, transaction_ref }, now) {
    const r = find(state.refunds || [], id, "yêu cầu hoàn tiền");
    if (r.status !== "PENDING") fail("Khoản hoàn tiền này đã được xác nhận.");
    const ref = String(transaction_ref || "").trim();
    if (method !== "CASH" && !ref) fail("Nhập mã giao dịch hoàn tiền.");
    const next = { ...state, refunds: patch(state.refunds, id, () => ({ status: "PAID", paid_at: iso(now), method: method || "BANK_TRANSFER", transaction_ref: ref || null })) };
    return { state: addLog(next, now, `Đã xác nhận hoàn ${money(r.amount)} · ${id}`, "manager/refunds", "MANAGER"), result: { id, refund: r.amount } };
  },

  // M02a · F12
  UPDATE_UNIT_STATUS(state, { code, status, reason, by }, now) {
    const u = state.units.find((x) => x.code === code) || fail("Không tìm thấy ô kho.");
    if (!(UNIT_TRANSITIONS[u.status] || []).includes(status)) fail("Ô đang có khách thuê hoặc trạng thái này không chuyển được ở đây.");
    if (!String(reason || "").trim()) fail("Nhập lý do đổi trạng thái.");
    const entry = { from: u.status, to: status, reason: reason.trim(), by: by || null, at: iso(now) };
    const next = { ...state, units: patchUnit(state.units, code, (x) => ({ status, history: [entry, ...(x.history || [])].slice(0, 20) })) };
    return { state: addLog(next, now, `Ô ${code}: ${status === "MAINTENANCE" ? "chuyển sang bảo trì" : "mở lại cho thuê"}`, "manager/units", "MANAGER"), result: { code, status } };
  },

  MARK_READ(state, { ids }) {
    return { state: { ...state, log: state.log.map((l) => (!ids || ids.includes(l.id) ? { ...l, read: true } : l)) }, result: {} };
  },
};

export function reduceOps(state, { type, payload = {} }, now = new Date()) {
  const fn = ACTIONS[type];
  if (!fn) return { state, error: new OpsError(`Thao tác không hợp lệ: ${type}`) };
  try {
    return fn(state, payload, now);
  } catch (e) {
    if (e instanceof OpsError) return { state, error: e };
    throw e;
  }
}

// Chuyển trạng thái ô quản lý được đổi tay ở M02a (SRS 8.1: INSPECTION → AVAILABLE hoặc MAINTENANCE; bảo trì xong mở lại).
// Ô đang có khách (ACTIVE, EXPIRING, OVERDUE, WAITING_HANDOVER) không đổi ở đây.
export const UNIT_TRANSITIONS = {
  EMPTY: ["MAINTENANCE"],
  MAINTENANCE: ["EMPTY"],
  INSPECTION: ["EMPTY", "MAINTENANCE"],
};

export const TICKET_STATE = {
  OPEN: ["Chưa phân công", "red"],
  IN_PROGRESS: ["Đang xử lý", "blue"],
  WAITING_CUSTOMER: ["Chờ khách xác nhận", "amber"],
  DONE: ["Đã hoàn tất", "green"],
};
export const ASSIGN_STATE = {
  OPEN: ["Cần xử lý", "red"],
  WAITING: ["Chờ thực hiện", "amber"],
  ACCEPTED: ["Đã nhận việc", "blue"],
  DONE: ["Đã hoàn tất", "green"],
};
export const PAYMENT_STATE = {
  PENDING: ["Chờ thu tại kho", "amber"],
  CONFIRMED: ["Đã thu tiền", "green"],
  MISMATCH: ["Báo sai lệch", "red"],
};
