import { RENTAL_PLANS, SIZE_BANDS, quote } from "../lib/catalog.js";
import {
  addDays,
  addMonths,
  dateLabel,
  isEmail,
  localDate,
  shortCode,
  timeoutLabel,
} from "../lib/format.js";
import { TICKET_TOPICS } from "../lib/status.js";

export class DomainError extends Error {
  constructor(message, code = "INVALID") {
    super(message);
    this.code = code;
  }
}
const fail = (message, code) => {
  throw new DomainError(message, code);
};

const iso = (d) => d.toISOString();
const pad = (n, w = 4) => String(n).padStart(w, "0");
const seqOf = (id) => Number(String(id || "").match(/(\d+)$/)?.[1] || 0);
const nextSeq = (list, key) => Math.max(0, ...list.map((x) => seqOf(x[key]))) + 1;

export const newReservationId = (state, now = new Date()) =>
  `SS-${localDate(now).replaceAll("-", "")}-${pad(nextSeq(state.reservations, "reservation_id"))}`;

const refBase = (id) => `SS-${String(id).match(/(\d{4})$/)?.[1] || pad(seqOf(id))}`;

const notify = (state, title, detail, to, now) => ({
  ...state,
  notifications: [
    { id: `N-${now.getTime()}-${state.notifications.length}`, title, detail, to, created_at: iso(now), read: false },
    ...state.notifications,
  ],
});
const log = (state, text, tone, now) => ({
  ...state,
  activities: [
    { id: `A-${now.getTime()}-${state.activities.length}`, text, tone, at: localDate(now) },
    ...state.activities,
  ],
});

// Đơn chờ chuyển khoản quá hạn giữ chỗ sẽ tự huỷ (C04 → C04b)
export function sweepExpired(state, now = new Date(), timeoutSeconds = 60) {
  let changed = false;
  const reservations = state.reservations.map((r) => {
    if (r.status === "PENDING_PAYMENT" && r.expires_at && new Date(r.expires_at) <= now) {
      changed = true;
      return {
        ...r,
        status: "CANCELLED",
        cancel_reason: `Quá ${timeoutLabel(r.timeout_seconds || timeoutSeconds)} chưa xác nhận`,
        cancelled_at: iso(now),
      };
    }
    return r;
  });
  return changed ? { ...state, reservations } : state;
}

const contractOf = (state, id) => state.contracts.find((c) => c.contract_id === id);
const hasPending = (state, contract_id) => ({
  renewal: state.renewals.some((r) => r.contract_id === contract_id && r.status === "PENDING"),
  ret: state.returns.some((r) => r.contract_id === contract_id && ["PENDING", "SCHEDULED"].includes(r.status)),
});

const handlers = {
  CREATE_RESERVATION(state, p, ctx) {
    const facility = state.facilities.find((f) => f.facility_id === Number(p.facility_id));
    if (!facility) fail("Không tìm thấy cơ sở.");
    if (!["normal", "climate"].includes(p.type) || (p.type === "climate" && !facility.has_climate))
      fail("Cơ sở này chưa có loại kho bạn chọn.");
    if (!SIZE_BANDS.some((b) => b.id === p.band)) fail("Vui lòng chọn diện tích.");
    const months = Number(p.months);
    if (!RENTAL_PLANS.includes(months)) fail("Gói thuê chỉ gồm 1, 3 hoặc 6 tháng.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start_date || "")) fail("Vui lòng chọn ngày bắt đầu.");
    if (p.start_date < localDate(ctx.now)) fail("Ngày bắt đầu không được ở quá khứ.");

    // Tránh tạo trùng khi bấm hai lần: dùng lại đơn đang chờ chuyển khoản cùng thông số
    const dup = state.reservations.find(
      (r) =>
        r.status === "PENDING_PAYMENT" &&
        r.facility_id === facility.facility_id &&
        r.type === p.type &&
        r.band === p.band &&
        r.months === months &&
        r.start_date === p.start_date,
    );
    if (dup) return { state, result: { reservation_id: dup.reservation_id } };

    const q = quote({ facility, type: p.type, band: p.band, months, start_date: p.start_date });
    const reservation_id = newReservationId(state, ctx.now);
    const timeout = ctx.timeoutSeconds;
    const reservation = {
      reservation_id,
      facility_id: facility.facility_id,
      type: p.type,
      band: p.band,
      months,
      start_date: p.start_date,
      end_date: q.end_date,
      monthly_rate: q.monthly_rate,
      deposit: q.deposit,
      rent_total: q.rent_total,
      initial_total: q.initial_total,
      status: "PENDING_PAYMENT",
      created_at: iso(ctx.now),
      timeout_seconds: timeout,
      expires_at: iso(new Date(ctx.now.getTime() + timeout * 1000)),
    };
    return {
      state: { ...state, reservations: [reservation, ...state.reservations] },
      result: { reservation_id },
    };
  },

  CONFIRM_TRANSFER(state, p, ctx) {
    const r = state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r) fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
    if (r.status === "CANCELLED") fail("Đơn đặt chỗ đã hết thời gian giữ chỗ.", "EXPIRED");
    if (r.status !== "PENDING_PAYMENT") return { state, result: { reservation_id: r.reservation_id } };
    const base = refBase(r.reservation_id);
    let next = {
      ...state,
      reservations: state.reservations.map((x) =>
        x.reservation_id === r.reservation_id
          ? { ...x, status: "PENDING_VERIFICATION", transfer_confirmed_at: iso(ctx.now), expires_at: null }
          : x,
      ),
      ledger: [
        ...state.ledger,
        {
          ref: `${base}-RENT`,
          label: `Thuê kho · ${r.months} tháng`,
          reservation_id: r.reservation_id,
          amount: r.rent_total,
          status: "PENDING_VERIFICATION",
        },
        {
          ref: `${base}-DEP`,
          label: "Cọc hợp đồng",
          reservation_id: r.reservation_id,
          amount: r.deposit,
          status: "PENDING_VERIFICATION",
        },
      ],
    };
    next = notify(next, "Đã nhận thông tin đặt chỗ", `${shortCode(r.reservation_id)} · Chờ nhân viên đối soát chuyển khoản.`, "reservations", ctx.now);
    next = log(next, `Đơn ${shortCode(r.reservation_id)} đã gửi — chờ đối soát thanh toán`, "amber", ctx.now);
    return { state: next, result: { reservation_id: r.reservation_id } };
  },

  EXPIRE_RESERVATION(state, p) {
    const r = state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r) fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
    return { state, result: { status: r.status } };
  },

  CANCEL_RESERVATION(state, p, ctx) {
    const r = state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r) fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
    if (r.status !== "PENDING_PAYMENT") fail("Đơn này đã gửi thông tin thanh toán, vui lòng liên hệ cơ sở để huỷ.");
    return {
      state: {
        ...state,
        reservations: state.reservations.map((x) =>
          x.reservation_id === r.reservation_id
            ? { ...x, status: "CANCELLED", cancel_reason: p.reason || "Khách hàng huỷ đặt chỗ", cancelled_at: iso(ctx.now) }
            : x,
        ),
      },
      result: { reservation_id: r.reservation_id },
    };
  },

  REQUEST_RENEWAL(state, p, ctx) {
    const c = contractOf(state, p.contract_id);
    if (!c || c.status === "ENDED") fail("Hợp đồng chưa thể gia hạn.");
    const months = Number(p.months);
    if (!RENTAL_PLANS.includes(months)) fail("Gói gia hạn chỉ gồm 1, 3 hoặc 6 tháng.");
    const pending = hasPending(state, c.contract_id);
    if (pending.renewal) fail("Đã có yêu cầu gia hạn đang chờ cơ sở duyệt.");
    if (pending.ret) fail("Hợp đồng đang có yêu cầu trả kho.");
    const renewal = {
      renewal_id: `GH-${pad(nextSeq(state.renewals, "renewal_id"))}`,
      contract_id: c.contract_id,
      months,
      old_end: c.end_date,
      new_end: addMonths(c.end_date, months),
      amount: months * c.monthly_rate,
      status: "PENDING",
      requested_at: iso(ctx.now),
    };
    const base = refBase(c.contract_id);
    const n = state.renewals.filter((r) => r.contract_id === c.contract_id).length;
    let next = {
      ...state,
      renewals: [renewal, ...state.renewals],
      ledger: [
        ...state.ledger,
        {
          ref: `${base}-REN${n ? n + 1 : ""}`,
          label: "Gia hạn đề xuất",
          contract_id: c.contract_id,
          amount: renewal.amount,
          status: "RENEWAL_PENDING",
        },
      ],
    };
    next = notify(next, "Đã gửi yêu cầu gia hạn", `Kho ${c.unit_number} · chờ cơ sở duyệt.`, `units/${c.contract_id}`, ctx.now);
    next = log(next, `Yêu cầu gia hạn ${c.unit_number} đã gửi — chờ duyệt`, "amber", ctx.now);
    return { state: next, result: { renewal_id: renewal.renewal_id } };
  },

  REQUEST_RETURN(state, p, ctx) {
    const c = contractOf(state, p.contract_id);
    if (!c || c.status === "ENDED") fail("Hợp đồng chưa thể đăng ký trả kho.");
    const pending = hasPending(state, c.contract_id);
    if (pending.ret) fail("Đã có yêu cầu trả kho đang chờ xử lý.");
    if (pending.renewal) fail("Hợp đồng đang có yêu cầu gia hạn chờ duyệt.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "") || p.date < localDate(ctx.now))
      fail("Ngày trả kho không được ở quá khứ.");
    if (!p.slot) fail("Vui lòng chọn khung giờ.");
    const ret = {
      return_id: `TK-${pad(nextSeq(state.returns, "return_id"))}`,
      contract_id: c.contract_id,
      date: p.date,
      slot: p.slot,
      notes: (p.notes || "").trim(),
      status: "PENDING",
      requested_at: iso(ctx.now),
    };
    const appointment = {
      appointment_id: `LH-${pad(nextSeq(state.appointments, "appointment_id") + 1000)}`,
      kind: "MOVE_OUT",
      contract_id: c.contract_id,
      reservation_id: c.reservation_id,
      facility_id: c.facility_id,
      unit_number: c.unit_number,
      date: p.date,
      slot: p.slot,
      status: "PENDING",
      note: "Dọn hết đồ, trả thẻ / chìa khóa và có mặt để kiểm tra cùng nhân viên.",
    };
    let next = { ...state, returns: [ret, ...state.returns], appointments: [appointment, ...state.appointments] };
    next = notify(next, "Đã gửi lịch trả kho", `Kho ${c.unit_number} · ${dateLabel(p.date)} · ${p.slot}. Chờ cơ sở xác nhận.`, "payments", ctx.now);
    next = log(next, `Yêu cầu trả kho ${c.unit_number} đã gửi — chờ xác nhận`, "amber", ctx.now);
    return { state: next, result: { return_id: ret.return_id } };
  },

  CREATE_TICKET(state, p, ctx) {
    if (!TICKET_TOPICS[p.topic]) fail("Vui lòng chọn chủ đề.");
    const description = (p.description || "").trim();
    if (!description) fail("Vui lòng mô tả vấn đề.");
    if (description.length > 1000) fail("Mô tả không quá 1000 ký tự.");
    if (p.contract_id && !contractOf(state, p.contract_id)) fail("Vui lòng chọn kho / hợp đồng của bạn.");
    const attachments = (p.attachments || []).slice(0, 3);
    const ticket = {
      ticket_id: `HT-${pad(nextSeq(state.tickets, "ticket_id"))}`,
      contract_id: p.contract_id || null,
      topic: p.topic,
      description,
      attachments,
      status: "OPEN",
      staff_note: "Cơ sở sẽ tiếp nhận và phản hồi qua thông báo.",
      created_at: iso(ctx.now),
      updated_at: iso(ctx.now),
    };
    let next = { ...state, tickets: [ticket, ...state.tickets] };
    next = notify(next, "Đã gửi yêu cầu hỗ trợ", `${ticket.ticket_id} · ${TICKET_TOPICS[p.topic].title}`, "support", ctx.now);
    next = log(next, `Yêu cầu hỗ trợ ${ticket.ticket_id} đã được gửi`, "blue", ctx.now);
    return { state: next, result: { ticket_id: ticket.ticket_id } };
  },

  CANCEL_TICKET(state, p, ctx) {
    const t = state.tickets.find((x) => x.ticket_id === p.ticket_id);
    if (!t) fail("Không tìm thấy yêu cầu.", "NOT_FOUND");
    if (t.status !== "OPEN") fail("Yêu cầu đã được cơ sở tiếp nhận nên không thể huỷ.");
    return {
      state: {
        ...state,
        tickets: state.tickets.map((x) =>
          x.ticket_id === t.ticket_id
            ? { ...x, status: "CANCELLED", staff_note: "Bạn đã huỷ yêu cầu này.", updated_at: iso(ctx.now) }
            : x,
        ),
      },
      result: { ticket_id: t.ticket_id },
    };
  },

  UPDATE_NAME(state, p) {
    const name = (p.name || "").trim();
    if (name.length < 2) fail("Vui lòng nhập tên hiển thị.");
    if (name.length > 100) fail("Tên không quá 100 ký tự.");
    return { state: { ...state, user: { ...state.user, full_name: name } }, result: { name } };
  },

  CHANGE_PASSWORD(state, p) {
    if (state.user.password && p.current !== state.user.password)
      fail("Mật khẩu hiện tại chưa đúng.", "BAD_PASSWORD");
    if (!p.next || p.next.length < 8) fail("Mật khẩu mới cần ít nhất 8 ký tự.");
    if (p.next === p.current) fail("Mật khẩu mới cần khác mật khẩu hiện tại.");
    return { state: { ...state, user: { ...state.user, password: p.next } }, result: {} };
  },

  MARK_READ(state, p) {
    const all = !p.ids;
    return {
      state: {
        ...state,
        notifications: state.notifications.map((n) => (all || p.ids.includes(n.id) ? { ...n, read: true } : n)),
      },
      result: {},
    };
  },

  // Nghiệp vụ phía nhân viên (Figma S09 Đối soát thanh toán): xác nhận chuyển khoản, tạo hợp đồng + lịch nhận kho.
  // Giao diện khách hàng không gọi lệnh này.
  STAFF_CONFIRM_PAYMENT(state, p, ctx) {
    const r = state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r || r.status !== "PENDING_VERIFICATION") fail("Chỉ đối soát được đơn đang chờ đối soát.");
    const facility = state.facilities.find((f) => f.facility_id === r.facility_id);
    const n = state.contracts.length + 1;
    const prefix = r.type === "climate" ? "B" : "A";
    const unit_number = `${prefix}-${100 + n * 7}`;
    const contract = {
      contract_id: `HĐ-2026-${pad(seqOf(r.reservation_id))}`,
      reservation_id: r.reservation_id,
      facility_id: r.facility_id,
      unit_number,
      type: r.type,
      band: r.band,
      size_m2: { S: 5, M: 12, L: 25 }[r.band],
      location: `Tầng 1 · Dãy ${prefix}`,
      months: r.months,
      start_date: r.start_date,
      end_date: r.end_date,
      monthly_rate: r.monthly_rate,
      deposit: r.deposit,
      status: "ACTIVE",
      handed_over: false,
    };
    const appointment = {
      appointment_id: `LH-${pad(nextSeq(state.appointments, "appointment_id") + 1000)}`,
      kind: "CHECK_IN",
      contract_id: contract.contract_id,
      reservation_id: r.reservation_id,
      facility_id: r.facility_id,
      unit_number,
      date: r.start_date > localDate(ctx.now) ? r.start_date : addDays(localDate(ctx.now), 1),
      slot: "09:00–09:30",
      status: "CONFIRMED",
      note: "Mang giấy đăng ký và mã đặt chỗ. Nhân viên xác minh, hướng dẫn và bàn giao kho.",
    };
    let next = {
      ...state,
      reservations: state.reservations.map((x) => (x.reservation_id === r.reservation_id ? { ...x, status: "CONFIRMED" } : x)),
      contracts: [contract, ...state.contracts],
      appointments: [appointment, ...state.appointments],
      ledger: state.ledger.map((l) =>
        l.reservation_id === r.reservation_id
          ? {
              ...l,
              contract_id: contract.contract_id,
              status: l.ref.endsWith("-DEP") ? "DEPOSIT_HELD" : "RECONCILED",
            }
          : l,
      ),
    };
    next = notify(next, "Lịch nhận kho đã xác nhận", `${dateLabel(appointment.date)} · 09:00 tại ${facility.name.replace("SafeSpace ", "")}.`, "payments", ctx.now);
    next = log(next, `Thanh toán ${shortCode(r.reservation_id)} đã đối soát`, "green", ctx.now);
    return { state: next, result: { contract_id: contract.contract_id } };
  },
};

// Trả về { state, result } hoặc { state, error } (state vẫn giữ kết quả quét đơn hết hạn)
export function reduce(state, action, ctx = {}) {
  const context = { now: ctx.now || new Date(), timeoutSeconds: ctx.timeoutSeconds || 60 };
  const swept = sweepExpired(state, context.now, context.timeoutSeconds);
  const handler = handlers[action.type];
  if (!handler) return { state: swept, error: new DomainError(`Thao tác không được hỗ trợ: ${action.type}`, "UNKNOWN") };
  try {
    return handler(swept, action.payload || {}, context);
  } catch (e) {
    if (e instanceof DomainError) return { state: swept, error: e };
    throw e;
  }
}

export const validateRegister = ({ name, email, phone, password, confirm }) => {
  const e = {};
  if (!name?.trim()) e.name = "Vui lòng nhập họ và tên.";
  if (!isEmail(email)) e.email = "Nhập email hợp lệ, ví dụ ban@vidu.com.";
  if (!/^(0\d{9}|\+84\d{9})$/.test(String(phone || "").replace(/[\s.-]/g, "")))
    e.phone = "Nhập số điện thoại hợp lệ, ví dụ 0901 234 567.";
  if (!password) e.password = "Vui lòng tạo mật khẩu.";
  else if (password.length < 8) e.password = "Mật khẩu cần ít nhất 8 ký tự.";
  if (!confirm) e.confirm = "Vui lòng nhập lại mật khẩu.";
  else if (confirm !== password) e.confirm = "Mật khẩu xác nhận chưa khớp.";
  return e;
};

