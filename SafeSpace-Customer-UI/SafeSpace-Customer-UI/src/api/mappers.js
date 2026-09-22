// Chuyển dữ liệu backend (DTO camelCase, id số, trạng thái BE) sang dạng dữ liệu các trang đang dùng,
// rồi ghép với phần lưu trong trình duyệt ("overlay") cho những luồng backend chưa có API.
import { bandOfArea, SIZE_BANDS } from "../lib/catalog.js";
import { localDate, timeoutLabel } from "../lib/format.js";
import { TICKET_TOPICS } from "../lib/status.js";

const TICKET_TOPIC_KEYS = Object.keys(TICKET_TOPICS);

// ASP.NET trả DateTime đọc từ DB không kèm múi giờ nhưng thực chất là UTC → thêm "Z"
export function parseUtc(value) {
  if (!value) return null;
  const s = String(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const isoOf = (value) => parseUtc(value)?.toISOString() ?? null;
const pad = (n, w = 4) => String(n).padStart(w, "0");
const dateOnly = (v) => (v ? String(v).slice(0, 10) : null);

export const reservationCode = (dto) => {
  const d = parseUtc(dto.createdAt) || new Date();
  return `SS-${localDate(d).replaceAll("-", "")}-${pad(dto.reservationId)}`;
};
export const contractCode = (dto) => `HĐ-${String(dto.startDate || "").slice(0, 4) || "0000"}-${pad(dto.contractId)}`;
export const ticketCode = (id) => `HT-${pad(id)}`;

function monthsBetween(start, end) {
  if (!start || !end) return 0;
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

const areaText = (n) => `${Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m²`;

// "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh" → quận + thành phố
function splitAddress(address = "") {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return { district: parts.length >= 2 ? parts[parts.length - 2] : "", city: parts[parts.length - 1] || "" };
}
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

// Thứ tự hiển thị theo Figma C02; cơ sở khác xếp sau theo id
const FIGMA_ORDER = ["Nguyễn Lương Bằng", "Him Lam", "Phú Xuân", "Tân Thuận", "Phú Mỹ Hưng", "Bình Thạnh", "Nhà Bè", "Bình Chánh", "Thủ Đức"];
const rank = (f) => {
  const i = FIGMA_ORDER.findIndex((n) => f.name.includes(n));
  return i >= 0 ? i : 100 + f.facility_id;
};

// ---------- Danh mục (công khai) ----------
export function mapCatalog({ facilities = [], unitTypes = [], rates = [] }) {
  const typeById = new Map(unitTypes.map((t) => [t.unitTypeId, t]));
  const mapped = facilities
    .filter((f) => !f.status || f.status === "ACTIVE")
    .map((f) => {
      const offers = rates
        .filter((r) => r.facilityId === f.facilityId && typeById.has(r.unitTypeId))
        .map((r) => {
          const t = typeById.get(r.unitTypeId);
          return {
            key: `ut-${t.unitTypeId}`,
            unit_type_id: t.unitTypeId,
            name: t.typeName,
            type: t.climateControlled ? "climate" : "normal",
            band: bandOfArea(Number(t.area)),
            area: Number(t.area),
            size_label: areaText(t.area),
            monthly_rate: Number(r.monthlyRate),
            description: t.description || "",
          };
        })
        .sort((a, b) => a.area - b.area || a.monthly_rate - b.monthly_rate);
      const { district, city } = splitAddress(f.address);
      const open = hhmm(f.openingTime);
      const close = hhmm(f.closingTime);
      return {
        facility_id: f.facilityId,
        name: f.name,
        address: f.address,
        district,
        city,
        phone: f.contactPhone || "",
        hours: open && close ? `${open}–${close}` : "06:00–22:00",
        distance_km: null,
        camera: true,
        has_climate: offers.some((o) => o.type === "climate"),
        offers,
      };
    })
    .sort((a, b) => rank(a) - rank(b));
  return { facilities: mapped, unitTypes };
}

// ---------- Trạng thái ----------
const RESERVATION = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  UNIT_ASSIGNED: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  COMPLETED: "CHECKED_IN",
  CANCELLED: "CANCELLED",
  EXPIRED: "CANCELLED",
};
const CONTRACT = { ACTIVE: "ACTIVE", ENDED: "ENDED", COMPLETED: "ENDED", TERMINATED: "ENDED", CANCELLED: "ENDED" };
const TICKET = { OPEN: "OPEN", ASSIGNED: "IN_PROGRESS", IN_PROGRESS: "IN_PROGRESS", RESOLVED: "RESOLVED", CLOSED: "RESOLVED", CANCELLED: "CANCELLED" };
const TICKET_NOTE = {
  OPEN: "Cơ sở sẽ tiếp nhận và phản hồi qua thông báo.",
  IN_PROGRESS: "Nhân viên cơ sở đang xử lý.",
  RESOLVED: "Yêu cầu đã được xử lý.",
  CANCELLED: "Bạn đã huỷ yêu cầu này.",
};
const RENEWAL = { PENDING_PAYMENT: "PENDING", PENDING_APPROVAL: "PENDING", APPROVED: "APPROVED", COMPLETED: "APPROVED", REJECTED: "REJECTED", CANCELLED: "REJECTED" };

function offerOfType(unitTypes, id, name) {
  const t = unitTypes.find((x) => x.unitTypeId === id) || unitTypes.find((x) => x.typeName === name);
  if (!t) return { type: "normal", band: "M", size_label: SIZE_BANDS[1].label, area: null, key: null };
  return {
    type: t.climateControlled ? "climate" : "normal",
    band: bandOfArea(Number(t.area)),
    size_label: areaText(t.area),
    area: Number(t.area),
    key: `ut-${t.unitTypeId}`,
    unit_type_id: t.unitTypeId,
  };
}

const EMPTY_OVERLAY = {
  holds: {}, // reservationId → thời điểm tạo trong trình duyệt này (ms), dùng cho đồng hồ giữ chỗ
  transfers: {}, // reservationId → thời điểm khách bấm "Tôi đã chuyển khoản"
  expired: {}, // reservationId → hết thời gian giữ chỗ, đang huỷ trên máy chủ
  attachments: {}, // ticketId → tên file ảnh đính kèm
  returns: [],
  appointments: [],
  notifications: [],
  activities: [],
  name: null,
  phone: null,
};
export const emptyOverlay = () => JSON.parse(JSON.stringify(EMPTY_OVERLAY));

// ---------- Ghép dữ liệu khách hàng ----------
export function composeData({ catalog, remote, overlay: ov, session, timeoutSeconds, now = new Date() }) {
  const overlay = { ...EMPTY_OVERLAY, ...(ov || {}) };
  const facilities = catalog?.facilities || [];
  const unitTypes = catalog?.unitTypes || [];
  const facilityByName = (name) => facilities.find((f) => f.name === name);
  const user = session
    ? {
        user_id: session.user.userId,
        username: session.user.username,
        full_name: overlay.name || session.user.fullName,
        email: session.user.email,
        phone: overlay.phone || "",
      }
    : null;
  const base = {
    user,
    facilities,
    reservations: [],
    contracts: [],
    ledger: [],
    appointments: [...overlay.appointments],
    renewals: [],
    returns: [...overlay.returns],
    tickets: [],
    notifications: [...overlay.notifications],
    activities: [...overlay.activities],
  };
  if (!remote) return base;

  // Đặt chỗ
  const codeByReservation = new Map();
  const reservations = remote.reservations.map((r) => {
    const id = r.reservationId;
    const code = reservationCode(r);
    codeByReservation.set(id, code);
    const created = parseUtc(r.createdAt) || now;
    const hold = overlay.holds[id];
    let status = RESERVATION[r.status] || "PENDING_VERIFICATION";
    let cancel_reason = r.cancellationReason || null;
    let expires_at = null;
    let timeout_seconds = null;
    if (status === "PENDING_PAYMENT") {
      if (overlay.transfers[id]) status = "PENDING_VERIFICATION";
      else {
        const expires = hold ? new Date(hold + timeoutSeconds * 1000) : parseUtc(r.expiresAt);
        timeout_seconds = hold ? timeoutSeconds : expires ? Math.round((expires - created) / 1000) : null;
        expires_at = expires ? expires.toISOString() : null;
        if (overlay.expired[id] || (expires && expires <= now)) {
          status = "CANCELLED";
          cancel_reason = `Quá ${timeoutLabel(timeout_seconds || timeoutSeconds)} chưa xác nhận`;
        }
      }
    }
    const offer = offerOfType(unitTypes, r.unitTypeId, r.unitTypeName);
    const rent = Number(r.estimatedAmount);
    const deposit = Number(r.requiredDeposit);
    return {
      reservation_id: code,
      api_id: id,
      facility_id: r.facilityId,
      facility_name: r.facilityName,
      type: offer.type,
      band: offer.band,
      offer_key: offer.key,
      size_label: offer.size_label,
      months: r.rentalPeriodMonths,
      start_date: dateOnly(r.startDate),
      end_date: dateOnly(r.expectedEndDate),
      monthly_rate: Number(r.quotedMonthlyRate),
      rent_total: rent,
      deposit,
      initial_total: rent + deposit,
      status,
      cancel_reason,
      created_at: created.toISOString(),
      expires_at,
      timeout_seconds,
      transfer_confirmed_at: overlay.transfers[id] ? new Date(overlay.transfers[id]).toISOString() : null,
      contract_api_id: remote.reservationDetails?.[id]?.contractId ?? null,
    };
  });

  // Hợp đồng + thanh toán + gia hạn
  const contracts = [];
  const ledger = [];
  const renewals = [];
  const contractCodeById = new Map();
  for (const c of remote.contracts) {
    const code = contractCode(c);
    contractCodeById.set(c.contractId, code);
    const facility = facilityByName(c.facilityName);
    const offer = offerOfType(unitTypes, null, c.unitTypeName);
    const start = dateOnly(c.startDate);
    const end = dateOnly(c.endDate);
    const handover = c.handover || null;
    contracts.push({
      contract_id: code,
      api_id: c.contractId,
      reservation_id: codeByReservation.get(c.reservationId) || null,
      facility_id: facility?.facility_id ?? null,
      facility_name: c.facilityName,
      unit_number: c.unitNumber,
      type: offer.type,
      band: offer.band,
      size_m2: offer.area,
      unit_type_name: c.unitTypeName,
      location: null,
      months: monthsBetween(start, end),
      start_date: start,
      end_date: end,
      monthly_rate: Number(c.agreedMonthlyRate),
      deposit: Number(c.depositAmount),
      status: CONTRACT[c.status] || "ACTIVE",
      handed_over: Boolean(handover && (["HANDED_OVER", "COMPLETED"].includes(handover.status) || (handover.customerConfirmed && handover.staffConfirmed))),
      handover_api_id: handover?.handoverId ?? null,
      handover_pending_customer: Boolean(handover && !handover.customerConfirmed && handover.staffConfirmed),
    });
    const paidRenewals = new Set();
    for (const p of c.payments || []) {
      if (p.renewalId) paidRenewals.add(p.renewalId);
      const kind = p.paymentType || "OTHER";
      const label =
        kind === "RENT" ? `Thuê kho ${c.unitNumber}` : kind === "DEPOSIT" ? `Cọc hợp đồng ${c.unitNumber}` : kind === "RENEWAL" ? `Gia hạn kho ${c.unitNumber}` : `Khoản thu kho ${c.unitNumber}`;
      const paid = p.status === "PAID";
      ledger.push({
        ref: p.transactionReference || `TT-${pad(p.paymentId)}`,
        kind,
        label,
        contract_id: code,
        amount: Number(p.amount),
        status: paid ? (kind === "DEPOSIT" ? "DEPOSIT_HELD" : "RECONCILED") : p.status === "REFUNDED" ? "REFUNDED" : "UNPAID",
      });
    }
    for (const r of c.renewals || []) {
      const status = RENEWAL[r.status] || "PENDING";
      renewals.push({
        renewal_id: `GH-${pad(r.renewalId)}`,
        api_id: r.renewalId,
        contract_id: code,
        months: r.renewalPeriodMonths,
        old_end: dateOnly(r.oldEndDate),
        new_end: dateOnly(r.newEndDate),
        amount: Number(r.renewalAmount),
        status,
        requested_at: isoOf(r.requestedAt),
      });
      if (status === "PENDING" && !paidRenewals.has(r.renewalId)) {
        ledger.push({ ref: `GH-${pad(r.renewalId)}`, kind: "RENEWAL", label: "Gia hạn đề xuất", contract_id: code, amount: Number(r.renewalAmount), status: "RENEWAL_PENDING" });
      }
    }
  }
  for (const r of reservations) r.contract_id = r.contract_api_id ? contractCodeById.get(r.contract_api_id) || null : null;

  // Khoản đã báo chuyển khoản, chờ nhân viên đối soát
  for (const r of reservations.filter((x) => x.status === "PENDING_VERIFICATION")) {
    const refBase = `SS-${pad(r.api_id)}`;
    ledger.unshift(
      { ref: `${refBase}-DEP`, kind: "DEPOSIT", label: "Cọc hợp đồng", reservation_id: r.reservation_id, amount: r.deposit, status: "PENDING_VERIFICATION" },
      { ref: `${refBase}-RENT`, kind: "RENT", label: `Thuê kho · ${r.months} tháng`, reservation_id: r.reservation_id, amount: r.rent_total, status: "PENDING_VERIFICATION" },
    );
  }

  // Lịch hẹn nhận kho từ backend (chi tiết đơn) + lịch trả kho lưu cục bộ
  const appointments = [];
  for (const r of reservations) {
    const d = remote.reservationDetails?.[r.api_id];
    const at = parseUtc(d?.checkInAppointmentAt);
    if (!at || r.status === "CANCELLED") continue;
    const end = new Date(at.getTime() + 30 * 60000);
    const t = (x) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
    appointments.push({
      appointment_id: `LH-${pad(r.api_id)}`,
      kind: "CHECK_IN",
      contract_id: r.contract_id,
      reservation_id: r.reservation_id,
      facility_id: r.facility_id,
      unit_number: d.assignedUnitNumber || "đang phân bổ",
      date: localDate(at),
      slot: `${t(at)}–${t(end)}`,
      status: r.status === "CHECKED_IN" ? "DONE" : "CONFIRMED",
      note: "Mang giấy tờ đã đăng ký và mã đặt chỗ. Nhân viên xác minh, hướng dẫn và bàn giao kho.",
    });
  }

  // Yêu cầu hỗ trợ
  const tickets = remote.tickets.map((t) => {
    const status = TICKET[t.status] || "OPEN";
    return {
      ticket_id: ticketCode(t.ticketId),
      api_id: t.ticketId,
      contract_id: contractCodeById.get(t.contractId) || null,
      topic: TICKET_TOPIC_KEYS.includes(t.issueType) ? t.issueType : "OTHER",
      title: t.title,
      description: t.description || "",
      attachments: overlay.attachments[t.ticketId] || [],
      status,
      staff_note: TICKET_NOTE[status],
      created_at: isoOf(t.createdAt),
      updated_at: isoOf(t.closedAt || t.resolvedAt || t.assignedAt || t.createdAt),
    };
  });

  return {
    ...base,
    reservations,
    contracts,
    ledger,
    renewals,
    tickets,
    appointments: [...appointments, ...base.appointments],
  };
}

// Đơn đã hết giờ giữ chỗ nhưng máy chủ còn để "chờ thanh toán" → cần gọi huỷ
export function reservationsToExpire({ remote, overlay, timeoutSeconds, now = new Date() }) {
  if (!remote) return [];
  return remote.reservations.filter((r) => {
    if (r.status !== "PENDING_PAYMENT" || overlay.transfers[r.reservationId]) return false;
    const hold = overlay.holds[r.reservationId];
    const expires = hold ? new Date(hold + timeoutSeconds * 1000) : parseUtc(r.expiresAt);
    return expires && expires <= now;
  });
}

// Tên đăng nhập backend (≤ 50 ký tự) sinh từ email để khách đăng nhập được bằng email như Figma
export function usernameFromEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (e.length <= 50) return e;
  return `${e.split("@")[0].slice(0, 40)}${Date.now().toString(36).slice(-6)}`;
}

