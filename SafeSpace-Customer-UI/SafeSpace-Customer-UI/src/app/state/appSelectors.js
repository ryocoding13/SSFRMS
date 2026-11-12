/**
 * APP SELECTORS - TRÍCH XUẤT VÀ TÍNH TOÁN DỮ LIỆU TỪ STATE ỨNG DỤNG
 *
 * Cung cấp:
 * - selectActiveContracts: Hợp đồng đang hiệu lực của khách hàng.
 * - selectPendingPayments: Các khoản thanh toán cần thanh toán gấp.
 * - selectContractById: Tìm kiếm hợp đồng theo mã hiển thị hoặc số ID.
 */
import { daysBetween, localDate } from "../../shared/utils/format.js";
import { canPayLedger } from "../../shared/utils/returnPolicy.js";

// Luôn trả về một cơ sở (dự phòng khi dữ liệu máy chủ chỉ có tên cơ sở)
export const facilityOf = (data, id, name) =>
  data.facilities.find((f) => f.facility_id === Number(id)) ||
  (name && data.facilities.find((f) => f.name === name)) || {
    facility_id: Number(id) || 0,
    name: name || "SafeSpace",
    district: "",
    city: "",
    hours: "06:00–22:00",
    offers: [],
  };
export const contractOf = (data, id) => data.contracts.find((c) => c.contract_id === id);

// Trạng thái hợp đồng suy ra theo ngày (ACTIVE → EXPIRING trong 30 ngày → OVERDUE)
export function contractStatus(c, now = new Date()) {
  if (c.status === "ENDED") return "ENDED";
  const left = daysBetween(localDate(now), c.end_date);
  if (left < 0) return "OVERDUE";
  if (left <= 30) return "EXPIRING";
  return "ACTIVE";
}

export const activeContracts = (data, now) =>
  data.contracts.filter((c) => contractStatus(c, now) !== "ENDED");

export const expiringContracts = (data, now) =>
  data.contracts.filter((c) => ["EXPIRING", "OVERDUE"].includes(contractStatus(c, now)));

export const payableCount = (data) => (data?.ledger || []).filter(canPayLedger).length;
export const unpaidCount = (data) => payableCount(data);

export const pendingRenewal = (data, contractId) =>
  data.renewals.find((r) => r.contract_id === contractId && (r.status === "PENDING" || (r.status === "APPROVED" && !data.ledger.some(l => l.kind === "RENEWAL" && l.contract_id === contractId && l.period?.to === r.new_end && l.status === "RECONCILED"))));

export const pendingReturn = (data, contractId) => {
  if (!data || contractId == null) return undefined;
  const contract = data.contracts?.find((c) => c.contract_id === contractId || c.api_id === contractId);
  // Hợp đồng từ API dùng trạng thái server; demo lưu yêu cầu riêng trong returns.
  if (contract?.api_id != null && contract.status !== "RETURN_PENDING") return undefined;
  const match = data.returns?.find((r) =>
    (r.contract_id === (contract?.contract_id ?? contractId)
      || r.api_id === (contract?.api_id ?? contractId))
    && ["PENDING", "SCHEDULED"].includes(r.status));
  return match || (contract?.status === "RETURN_PENDING"
    ? { contract_id: contract.contract_id, status: "PENDING" }
    : undefined);
};

export const latestReservation = (data) =>
  [...data.reservations].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

export const sortedReservations = (data) =>
  [...data.reservations].sort((a, b) => b.created_at.localeCompare(a.created_at));

export function upcomingAppointments(data, now = new Date()) {
  const t = localDate(now);
  return data.appointments
    .filter((a) => !["DONE", "CANCELLED"].includes(a.status) && a.date >= t)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// "Mốc sắp tới" ở dashboard (C01): lịch hẹn + ngày kết thúc hợp đồng
export function milestones(data, now = new Date(), limit = 3) {
  const t = localDate(now);
  const items = [];
  for (const a of upcomingAppointments(data, now)) {
    const f = facilityOf(data, a.facility_id);
    items.push({
      key: a.appointment_id,
      date: a.date,
      title: `${a.kind === "CHECK_IN" ? "Nhận kho" : "Trả kho"} ${a.unit_number}`,
      detail: a.kind === "CHECK_IN" && a.slot ? `${a.slot} · ${f.name}` : f.name,
    });
  }
  for (const c of data.contracts) {
    if (c.status === "ENDED" || c.end_date < t) continue;
    let detail = `Kỳ thuê ${c.months} tháng · có thể gia hạn trước 7 ngày`;
    if (pendingRenewal(data, c.contract_id)) detail = "Gia hạn đã xác nhận · chờ thanh toán";
    else if (pendingReturn(data, c.contract_id)) detail = "Yêu cầu trả kho đang chờ cơ sở xác nhận";
    items.push({
      key: `end-${c.contract_id}`,
      date: c.end_date,
      title: `Hợp đồng ${c.unit_number} kết thúc`,
      detail,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

export const unreadCount = (data) => data.notifications.filter((n) => !n.read).length;

// "Hôm nay" / "Hôm qua" / dd/mm/yyyy cho popup thông báo
export function whenLabel(isoDateTime, now = new Date()) {
  const d = localDate(new Date(isoDateTime));
  const t = localDate(now);
  if (d === t) return "Hôm nay";
  if (daysBetween(d, t) === 1) return "Hôm qua";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}
