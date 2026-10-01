// Nghiệp vụ vận hành tại cơ sở (thuần, có test). Mỗi action trả { state, result } hoặc ném OpsError.
import { dateLabel, money } from "../lib/format.js";

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

// Diện tích từ nhãn gói ("Kho thường · 10–20 m²") → khoảng m²
export function areaRange(offer = "") {
  const m = offer.match(/(\d+)\s*[–-]\s*(\d+)\s*m²/);
  if (m) return [Number(m[1]), Number(m[2])];
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
  HANDOVER(state, { id, method }, now) {
    const h = find(state.handovers, id, "phiếu bàn giao");
    if (h.status === "DONE") fail("Kho này đã được bàn giao.");
    const v = state.verifications.find((x) => x.id === h.verification_id);
    if (v && v.status !== "DONE") fail("Cần xác minh khách hàng trước khi bàn giao kho.");
    if (!["CARD", "PIN", "FINGER"].includes(method)) fail("Chọn phương thức mở khoá.");
    const next = {
      ...state,
      handovers: patch(state.handovers, id, () => ({ status: "DONE", method, done_at: iso(now) })),
      units: patchUnit(state.units, h.unit, () => ({ status: "ACTIVE" })),
      assignments: state.assignments.map((a) => (a.ref === id ? { ...a, status: "DONE" } : a)),
    };
    return { state: addLog(next, now, `Đã bàn giao kho ${h.unit} cho ${h.customer}`, "manager/units", "MANAGER"), result: { id } };
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
      contracts: state.contracts.map((c) => (c.id === r.contract ? { ...c, state: "RETURNED", due: `${money(r.unpaid)} · Chờ quản lý xác nhận hoàn cọc` } : c)),
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
      units: patchUnit(state.units, unit, () => ({ status: "WAITING_HANDOVER", tenant: a.customer, end: a.end })),
      verifications: [{ id: `XM-${ref}`, reservation_id: id, customer: a.customer, unit, appointment: a.pickup, status: "TODO" }, ...state.verifications],
      handovers: [{ id: `BG-${ref}`, verification_id: `XM-${ref}`, unit, customer: a.customer, status: "WAITING", method: null }, ...state.handovers],
      assignments: [...state.assignments, { id: `PC-${ref}`, title: `Bàn giao ${unit} · ${a.customer}`, when: a.pickup, staff: null, status: "OPEN", ref: `BG-${ref}` }],
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
  PENDING: ["Chờ đối soát", "amber"],
  CONFIRMED: ["Đã xác nhận thu", "green"],
  MISMATCH: ["Báo sai lệch", "red"],
};
export const UNLOCK_METHODS = [
  ["CARD", "Thẻ từ"],
  ["PIN", "Mã PIN"],
  ["FINGER", "Vân tay"],
];
