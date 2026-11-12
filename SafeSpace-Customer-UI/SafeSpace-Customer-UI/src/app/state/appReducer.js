/**
 * APP REDUCER - QUẢN LÝ TRẠNG THÁI NGHIỆP VỤ PHÍA FRONTEND (PURE FUNCTIONS)
 *
 * Xử lý các action dữ liệu:
 * - Đặt chỗ: RESERVE_UNIT, CANCEL_RESERVATION, CONFIRM_TRANSFER
 * - Hợp đồng: RENEW_CONTRACT, MOVE_OUT_CONTRACT, DEDUCTION_DECISION
 * - Thanh toán: PAY_ORDER, ADD_PAYMENT, REFUND_SETTLEMENT
 * - Hỗ trợ: CREATE_TICKET, REPLY_TICKET
 */
import { requireRentalPolicy } from "../../shared/utils/rentalPolicy.js";
import { storedRefundChoice, validateRefundChoice } from "../../shared/utils/refundRequest.js";
import { isReturnFee, NO_RETURN_COLLECTION } from "../../shared/utils/returnPolicy.js";
import { RENTAL_PLANS, SIZE_BANDS, offerByKey, quote } from "../../shared/utils/catalog.js";
import {
  addDays,
  addMonths,
  dateLabel,
  isEmail,
  localDate,
  shortCode,
  timeoutLabel,
} from "../../shared/utils/format.js";
import { TICKET_TOPICS, ticketTitle } from "../../shared/utils/status.js";
import { CANCEL_DEPOSIT_FEE_RATE, CANCEL_POLICY_NAME } from "../../shared/utils/policy.js";

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
  renewal: state.renewals.some((r) =>
    r.contract_id === contract_id && (
      r.status === "PENDING" ||
      (r.status === "APPROVED" && !state.ledger.some((l) => l.kind === "RENEWAL" && l.contract_id === contract_id && l.period?.to === r.new_end && l.status === "RECONCILED"))
    )),
  ret: state.returns.some((r) => r.contract_id === contract_id && ["PENDING", "SCHEDULED"].includes(r.status)),
});

// C14a · Ước tính hoàn tiền khi huỷ đơn đã thanh toán trước ngày bắt đầu thuê (chế độ trình duyệt).
// Chính sách D27 (shared/utils/policy.js). Chế độ API lấy từ GET /api/reservations/{id}/cancel-preview.
export function cancelPreviewOf(r) {
  const paid = r.initial_total || 0;
  const fee = Math.round((r.deposit || 0) * CANCEL_DEPOSIT_FEE_RATE);
  return { paid, fee, refund: Math.max(0, paid - fee), policy: CANCEL_POLICY_NAME };
}

const handlers = {
  ACCEPT_RESERVATION_POLICY(state, p, ctx) {
    if (p.accepted !== true) fail("Vui lòng đọc và đồng ý với chính sách.");
    const reservation = state.reservations.find(r => r.reservation_id === p.reservation_id);
    if (!reservation) fail("Không tìm thấy đơn đặt chỗ.");
    if (!["PENDING_PAYMENT", "PENDING_VERIFICATION"].includes(reservation.status)) fail("Đơn không còn chờ thanh toán.");
    let policy;
    try { policy = requireRentalPolicy(p.policy_snapshot, p.policy_version); } catch (e) { fail(e.message); }
    const consent = { version: policy.version, accepted_at: ctx.now.toISOString(), channel: "WEB", customer_id: state.user.user_id, consent_id: null, displayVersion: policy.displayVersion || null, demo: true };
    return { state: { ...state, policy_versions: { ...(state.policy_versions || {}), [policy.version]: structuredClone(policy) }, reservations: state.reservations.map(r => r === reservation ? { ...r, policy_consent: consent } : r) }, result: { consent } };
  },

  CREATE_RESERVATION(state, p, ctx) {
    const facility = state.facilities.find((f) => f.facility_id === Number(p.facility_id));
    if (!facility) fail("Không tìm thấy cơ sở.");
    if (!p.offer_key && p.band && !SIZE_BANDS.some((b) => b.id === p.band)) fail("Vui lòng chọn diện tích.");
    const offer = offerByKey(facility, p.offer_key || `${p.type}-${p.band}`);
    if (!offer) fail("Cơ sở này chưa có loại kho bạn chọn.");
    const months = Number(p.months);
    if (!RENTAL_PLANS.includes(months)) fail("Gói thuê chỉ gồm 1, 3 hoặc 6 tháng.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start_date || "")) fail("Vui lòng chọn ngày bắt đầu.");
    if (p.start_date < localDate(ctx.now)) fail("Ngày bắt đầu không được ở quá khứ.");

    // Tránh tạo trùng khi bấm hai lần: dùng lại đơn đang chờ chuyển khoản cùng thông số
    const dup = state.reservations.find(
      (r) =>
        r.status === "PENDING_PAYMENT" &&
        r.facility_id === facility.facility_id &&
        r.offer_key === offer.key &&
        r.months === months &&
        r.start_date === p.start_date,
    );
    if (dup) return { state, result: { reservation_id: dup.reservation_id } };

    const q = quote({ offer, months, start_date: p.start_date });
    const reservation_id = newReservationId(state, ctx.now);
    const timeout = ctx.timeoutSeconds;
    const reservation = {
      reservation_id,
      facility_id: facility.facility_id,
      type: offer.type,
      band: offer.band,
      offer_key: offer.key,
      size_label: offer.size_label,
      unit_code: p.unit_code || null, // ô khách chọn trên sơ đồ (quản lý phân bổ chính thức ở M05)
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
    next = notify(next, "Đã nhận thông tin đặt chỗ", `${shortCode(r.reservation_id)} · Chờ cơ sở xác nhận thanh toán.`, "reservations", ctx.now);
    next = log(next, `Đơn ${shortCode(r.reservation_id)} đã gửi — chờ xác nhận thanh toán`, "amber", ctx.now);
    return { state: next, result: { reservation_id: r.reservation_id } };
  },

  // C04c → C05c: khách chọn thanh toán tại cửa hàng. Đơn giữ chỗ chờ nhân viên thu tiền ở S09.
  PAY_AT_FACILITY(state, p, ctx) {
    const out = handlers.CONFIRM_TRANSFER(state, p, ctx);
    const r = out.state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r || r.pay_at_facility) return out;
    let next = {
      ...out.state,
      // Bỏ thông báo / hoạt động kiểu "chờ đối soát" của bước chuyển khoản cũ
      notifications: out.state.notifications.slice(1),
      activities: out.state.activities.slice(1),
      reservations: out.state.reservations.map((x) => (x.reservation_id === r.reservation_id ? { ...x, pay_at_facility: true } : x)),
    };
    next = notify(next, "Đã giữ chỗ cho bạn", `${shortCode(r.reservation_id)} · Thanh toán tại cửa hàng khi nhận kho.`, `reservations/${r.reservation_id}`, ctx.now);
    next = log(next, `Đơn ${shortCode(r.reservation_id)} chờ thanh toán tại cửa hàng`, "amber", ctx.now);
    return { state: next, result: out.result };
  },

  // PayOS báo đã thanh toán (webhook ở backend; chế độ trình duyệt tự gọi để mô phỏng).
  // reservation_id → đơn đặt chỗ đã trả tiền thuê + cọc; ref → khoản gia hạn ở C11.
  // C11fc → C11fcp: khách chọn trả phí phát sinh tại quầy; công nợ chỉ giảm khi nhân viên xác nhận đã thu (S09f)
  CHOOSE_RENEWAL_AT_COUNTER(state, { renewal_id }) {
    const r = state.renewals.find(x => x.renewal_id === renewal_id);
    if (!r || r.status !== "APPROVED") fail("Yêu cầu chưa được duyệt hoặc đã được thanh toán.");
    return { state: { ...state, renewals: state.renewals.map(x => x === r ? { ...x, at_counter: true } : x) }, result: { renewal_id } };
  },
  CHOOSE_FEE_AT_COUNTER() { fail(NO_RETURN_COLLECTION); },
  PAYOS_PAID(state, p, ctx) {
    if (p.ref) {
      const l = state.ledger.find((x) => x.ref === p.ref);
      if (!l) fail("Không tìm thấy khoản thanh toán.", "NOT_FOUND");
      if (isReturnFee(l)) fail(NO_RETURN_COLLECTION);
      if (l.status === "RECONCILED") return { state, result: { ref: l.ref } };
      const c = contractOf(state, l.contract_id);
      let next = {
        ...state,
        ledger: state.ledger.map((x) => (x.ref === l.ref ? { ...x, status: "RECONCILED", payable: false } : x)),
        contracts: state.contracts.map((x) => (c && x.contract_id === c.contract_id && l.period?.to ? { ...x, end_date: l.period.to, status: "ACTIVE" } : x)),
      };
      if (l.fee) {
        next = notify(next, "Đã thanh toán phí phát sinh", `${l.label} · ${l.amount.toLocaleString("vi-VN")} đ.`, "payments", ctx.now);
        return { state: log(next, `Đã thanh toán ${l.label.toLowerCase()} qua QR`, "green", ctx.now), result: { ref: l.ref } };
      }
      next = notify(next, "Đã thanh toán gia hạn", `Kho ${l.unit_number || c?.unit_number || ""} · gia hạn đến ${l.period?.to ? dateLabel(l.period.to) : "kỳ mới"}.`, "payments", ctx.now);
      next = log(next, `Đã thanh toán gia hạn ${l.unit_number || ""} qua QR`, "green", ctx.now);
      return { state: next, result: { ref: l.ref } };
    }
    const r = state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r) fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
    if (r.status !== "PENDING_PAYMENT") return { state, result: { reservation_id: r.reservation_id } };
    const base = refBase(r.reservation_id);
    let next = {
      ...state,
      reservations: state.reservations.map((x) =>
        x.reservation_id === r.reservation_id ? { ...x, status: "CONFIRMED", paid_at: iso(ctx.now), expires_at: null } : x,
      ),
      ledger: [
        ...state.ledger,
        { ref: `${base}-RENT`, kind: "RENT", label: `Thuê kho · ${r.months} tháng`, reservation_id: r.reservation_id, amount: r.rent_total, status: "RECONCILED" },
        { ref: `${base}-DEP`, kind: "DEPOSIT", label: "Cọc hợp đồng", reservation_id: r.reservation_id, amount: r.deposit, status: "DEPOSIT_HELD" },
      ],
    };
    next = notify(next, "Đã thanh toán đặt chỗ", `${shortCode(r.reservation_id)} · Cơ sở sẽ phân bổ kho và xác nhận lịch nhận kho.`, `reservations/${r.reservation_id}`, ctx.now);
    next = log(next, `Đơn ${shortCode(r.reservation_id)} đã thanh toán qua QR`, "green", ctx.now);
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
    const contract = state.contracts.find((c) => c.reservation_id === r.reservation_id);
    // Giống backend: huỷ được đơn chờ thanh toán hoặc đã thanh toán nhưng chưa nhận kho (C14a)
    if (r.status !== "PENDING_PAYMENT" && !(r.status === "CONFIRMED" && !contract?.handed_over))
      fail(r.status === "PENDING_VERIFICATION" ? "Đơn chờ thanh toán tại cửa hàng, vui lòng liên hệ cơ sở để huỷ." : "Đơn đã nhận kho, không huỷ được.");
    if (r.status === "CONFIRMED" && r.start_date && r.start_date <= localDate(ctx.now)) fail("Đã đến ngày bắt đầu thuê. Vui lòng sử dụng quy trình trả kho.");
    const preview = r.status === "CONFIRMED" ? cancelPreviewOf(r) : null;
    if (preview) {
      const error = validateRefundChoice(p.bank, contract?.customer_name || r.customer_name || state.user?.full_name);
      if (error) fail(error);
      if (p.bankConfirmed !== true) fail("Vui lòng xác nhận thông tin nhận hoàn.");
    }
    let next = {
      ...state,
      reservations: state.reservations.map((x) =>
        x.reservation_id === r.reservation_id
          ? {
              ...x,
              status: "CANCELLED",
              refund_bank: preview ? storedRefundChoice(p.bank) : null,
              cancel_reason: p.reason || "Khách hàng huỷ đặt chỗ",
              cancelled_at: iso(ctx.now),
              refund_amount: preview?.refund ?? null,
              refund_status: preview?.refund ? "PENDING" : null,
            }
          : x,
      ),
      contracts: contract ? state.contracts.map((c) => (c === contract ? { ...c, status: "ENDED" } : c)) : state.contracts,
      appointments: state.appointments.map((a) => (a.reservation_id === r.reservation_id && a.status !== "DONE" ? { ...a, status: "CANCELLED" } : a)),
    };
    if (preview?.refund) {
      next = notify(next, "Đã huỷ đơn đặt chỗ", `${shortCode(r.reservation_id)} · Đang hoàn ${preview.refund.toLocaleString("vi-VN")} đ.`, "reservations", ctx.now);
      next = log(next, `Đã huỷ đơn ${shortCode(r.reservation_id)} — đang hoàn tiền`, "gray", ctx.now);
    }
    return { state: next, result: { reservation_id: r.reservation_id, refund: preview?.refund ?? 0 } };
  },

  CANCEL_RENEWAL(state, p, ctx) {
    const r = state.renewals.find((x) => x.renewal_id === p.renewal_id);
    if (!r) fail("Không tìm thấy yêu cầu gia hạn.", "NOT_FOUND");
    if (r.status !== "PENDING") fail("Chỉ huỷ được yêu cầu gia hạn đang chờ quản lý duyệt.");
    let next = {
      ...state,
      renewals: state.renewals.map((x) => (x.renewal_id === r.renewal_id ? { ...x, status: "CANCELLED", cancelled_at: iso(ctx.now) } : x)),
      ledger: state.ledger.filter((l) => !(l.status === "RENEWAL_PENDING" && l.contract_id === r.contract_id)),
    };
    next = notify(next, "Đã huỷ yêu cầu gia hạn", `${r.renewal_id} · kỳ thuê hiện tại giữ nguyên`, `units/${r.contract_id}`, ctx.now);
    next = log(next, `Yêu cầu gia hạn ${r.renewal_id} đã huỷ`, "gray", ctx.now);
    return { state: next, result: { renewal_id: r.renewal_id } };
  },

  REQUEST_RENEWAL(state, p, ctx) {
    const c = contractOf(state, p.contract_id);
    if (!c || c.status === "ENDED" || c.end_date <= localDate(ctx.now)) fail("Hợp đồng chưa thể gia hạn.");
    const months = Number(p.months);
    if (!RENTAL_PLANS.includes(months)) fail("Gói gia hạn chỉ gồm 1, 3 hoặc 6 tháng.");
    const pending = hasPending(state, c.contract_id);
    if (pending.renewal) fail("Hợp đồng đã có gia hạn đang xử lý hoặc chờ thanh toán.");
    if (pending.ret) fail("Hợp đồng đang có yêu cầu trả kho.");
    const approvedAt = iso(ctx.now);
    const paymentDeadlineAt = new Date(ctx.now.getTime() + 86400000).toISOString();
    const renewal = {
      renewal_id: `GH-${pad(nextSeq(state.renewals, "renewal_id"))}`,
      contract_id: c.contract_id,
      months,
      old_end: c.end_date,
      new_end: addMonths(c.end_date, months),
      amount: months * c.monthly_rate,
      status: "APPROVED",
      requested_at: approvedAt,
      approved_at: approvedAt,
      payment_deadline_at: paymentDeadlineAt,
      ...(p.policy_consent ? { policy_consent: { ...p.policy_consent } } : {}),
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
          kind: "RENEWAL",
          label: `Gia hạn ${months} tháng`,
          contract_id: c.contract_id,
          unit_number: c.unit_number,
          period: { from: renewal.old_end, to: renewal.new_end, months },
          amount: renewal.amount,
          status: "UNPAID",
          payable: true,
        },
      ],
    };
    next = notify(next, "Gia hạn đã xác nhận — mở thanh toán", `Kho ${c.unit_number} · thanh toán ${renewal.amount.toLocaleString("vi-VN")} đ trong 24 giờ.`, "payments", ctx.now);
    next = log(next, `Gia hạn ${c.unit_number} tự động xác nhận — chờ thanh toán`, "green", ctx.now);
    return { state: next, result: { renewal_id: renewal.renewal_id } };
  },

  REQUEST_RETURN(state, p, ctx) {
    const c = contractOf(state, p.contract_id);
    if (!c || ["ENDED", "RETURN_PENDING"].includes(c.status) || c.start_date > localDate(ctx.now)) fail("Hợp đồng chưa thể đăng ký trả kho.");
    const pending = hasPending(state, c.contract_id);
    if (state.returns.some(r => r.contract_id === c.contract_id && !["CANCELLED", "REJECTED"].includes(r.status))) fail("Đã có yêu cầu trả kho đang chờ xử lý.");
    if (pending.renewal) fail("Hợp đồng đang có yêu cầu gia hạn chờ duyệt.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "") || p.date < localDate(ctx.now))
      fail("Ngày trả kho không được ở quá khứ.");
    const invalid = validateRefundChoice(p.bank, c.customer_name || state.user?.full_name);
    if (invalid) fail(invalid);
    if (p.emptied !== true) fail("Vui lòng xác nhận đã chuyển hết đồ ra khỏi kho.");
    const ret = {
      refund_bank: storedRefundChoice(p.bank),
      photos: [],
      emptied: true,
      return_id: `TK-${pad(nextSeq(state.returns, "return_id"))}`,
      contract_id: c.contract_id,
      date: p.date,
      slot: "",
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
      slot: "",
      status: "PENDING",
      note: "Dọn hết đồ, trả thẻ / chìa khóa và chờ nhân viên kiểm tra thực tế.",
    };
    let next = { ...state, returns: [ret, ...state.returns], appointments: [appointment, ...state.appointments], contracts: state.contracts.map(x => x.contract_id === c.contract_id ? { ...x, access_issued: false } : x) };
    next = notify(next, "Đã gửi lịch trả kho", `Kho ${c.unit_number} · ngày ${dateLabel(p.date)}. Chờ cơ sở kiểm tra thực tế.`, "payments", ctx.now);
    next = log(next, `Yêu cầu trả kho ${c.unit_number} đã gửi — chờ xác nhận`, "amber", ctx.now);
    return { state: next, result: { return_id: ret.return_id } };
  },

  CREATE_TICKET(state, p, ctx) {
    if (!TICKET_TOPICS[p.topic]) fail("Vui lòng chọn chủ đề.");
    const title = ticketTitle(p);
    if (p.topic === "OTHER" && (!title || title.length > 100)) fail("Chủ đề của bạn phải có từ 1 đến 100 ký tự.");
    const rawDesc = (p.description || "").trim();
    if (rawDesc.length > 1000) fail("Mô tả không quá 1000 ký tự.");
    if (p.contract_id && !contractOf(state, p.contract_id)) fail("Vui lòng chọn kho / hợp đồng của bạn.");
    const keyDate = p.topic === "KEY_PICKUP" ? (p.preferred_date || "") : "";
    if (p.topic === "KEY_PICKUP" && keyDate && !/^\d{4}-\d{2}-\d{2}$/.test(keyDate)) fail("Ngày muốn nhận chìa khóa không hợp lệ.");
    const description = rawDesc || (keyDate ? `Ngày muốn nhận chìa khóa: ${keyDate.split("-").reverse().join("/")}` : "");
    const attachments = (p.attachments || []).slice(0, 3);
    const ticket = {
      ticket_id: `HT-${pad(nextSeq(state.tickets, "ticket_id"))}`,
      contract_id: p.contract_id || null,
      topic: p.topic,
      title,
      description,
      preferred_date: keyDate || null,
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

  // C13 / Task #12: lưu tên hiển thị, email (nếu gửi kèm) và số điện thoại
  UPDATE_NAME(state, p) {
    const name = (p.name || "").trim();
    if (name.length < 2) fail("Vui lòng nhập tên hiển thị.");
    if (name.length > 100) fail("Tên không quá 100 ký tự.");
    let email = state.user?.email || "";
    if (p.email !== undefined) {
      email = String(p.email || "").trim();
      if (!email || email.length > 150 || !isEmail(email)) fail("Email chưa đúng định dạng.");
    }
    const phone = p.phone === undefined ? state.user?.phone : String(p.phone || "").replace(/[\s.-]/g, "");
    if (p.phone !== undefined && phone && !/^(0\d{9}|\+84\d{9})$/.test(phone)) fail("Số điện thoại chưa đúng định dạng.");
    const nextUser = { ...state.user, full_name: name, ...(p.email !== undefined ? { email } : {}), ...(p.phone !== undefined ? { phone } : {}) };
    return { state: { ...state, user: nextUser }, result: { name, ...(p.email !== undefined ? { email } : {}), ...(p.phone !== undefined ? { phone } : {}) } };
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

  // Nghiệp vụ phía nhân viên (Figma S09 Thu tiền tại kho): xác nhận chuyển khoản, tạo hợp đồng + lịch nhận kho.
  // Giao diện khách hàng không gọi lệnh này.
  STAFF_CONFIRM_PAYMENT(state, p, ctx) {
    const r = state.reservations.find((x) => x.reservation_id === p.reservation_id);
    if (!r || r.status !== "PENDING_VERIFICATION") fail("Chỉ xác nhận thu được đơn đang chờ thanh toán tại cửa hàng.");
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
    next = log(next, `Đã thu tiền đơn ${shortCode(r.reservation_id)} tại cửa hàng`, "green", ctx.now);
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

export const validateRegister = ({ name, username, email, phone, password, confirm }) => {
  const e = {};
  if (!name?.trim()) e.name = "Vui lòng nhập họ và tên.";
  if (!String(username || "").trim()) e.username = "Vui lòng nhập tên đăng nhập.";
  else if (String(username).trim().length > 50 || /\s|@/.test(String(username).trim())) e.username = "Tên đăng nhập tối đa 50 ký tự, không chứa khoảng trắng hoặc @.";
  if (!isEmail(email)) e.email = "Nhập email hợp lệ, ví dụ ban@vidu.com.";
  if (!/^(0\d{9}|\+84\d{9})$/.test(String(phone || "").replace(/[\s.-]/g, "")))
    e.phone = "Nhập số điện thoại hợp lệ, ví dụ 0901 234 567.";
  if (!password) e.password = "Vui lòng tạo mật khẩu.";
  else if (password.length < 8) e.password = "Mật khẩu cần ít nhất 8 ký tự.";
  if (!confirm) e.confirm = "Vui lòng nhập lại mật khẩu.";
  else if (confirm !== password) e.confirm = "Mật khẩu xác nhận chưa khớp.";
  return e;
};

