/**
 * #47 (Lượt 4 · Figma M-KHO): ba trạng thái độc lập của một ô trên bảng quản lý.
 * - Sử dụng: có người thuê / trống — lấy theo hợp đồng, không đổi tay.
 * - Vận hành: hoạt động / bảo trì / chờ kiểm tra — theo trạng thái kỹ thuật và sự cố đang mở.
 * - Cửa: đang mở / đã khóa — mô phỏng theo nhật ký quét mã, chưa kết nối thiết bị thật.
 * Máy chủ trả sẵn usage / operation / door / door_at; dữ liệu cũ không có thì suy ra từ status.
 */
export const USAGE = { RENTED: ["Có người thuê", "green"], FREE: ["Trống", "blue"] };
export const OPERATION = { ACTIVE: ["Hoạt động", "green"], MAINTENANCE: ["Bảo trì", "amber"], INSPECTION: ["Chờ kiểm tra", "gray"] };
export const DOOR = { OPEN: ["Đang mở", "amber"], LOCKED: ["Đã khóa", "gray"] };

const RENTED_STATUS = ["ACTIVE", "EXPIRING", "OVERDUE"];

export function unitBoardView(u) {
  const usage = USAGE[u.usage] ? u.usage : RENTED_STATUS.includes(u.status) ? "RENTED" : "FREE";
  const operation = OPERATION[u.operation] ? u.operation : u.status === "MAINTENANCE" ? "MAINTENANCE" : u.status === "INSPECTION" ? "INSPECTION" : "ACTIVE";
  const door = DOOR[u.door] ? u.door : "LOCKED";
  const bookedFrom = u.booked_from || (usage === "FREE" && u.status === "WAITING_HANDOVER" ? u.start || null : null);
  return {
    usage, operation, door,
    doorAt: u.door_at || null,
    contract: u.contract || null,
    incident: u.incident || null,
    bookedFrom,
    waiting: usage === "FREE" && (Boolean(bookedFrom) || u.status === "WAITING_HANDOVER"),
  };
}

/** Bộ lọc: theo sử dụng, vận hành hoặc cửa đang mở. */
export const BOARD_TABS = [
  ["", "Tất cả", () => true],
  ["RENTED", "Có người thuê", v => v.usage === "RENTED"],
  ["FREE", "Trống", v => v.usage === "FREE"],
  ["MAINTENANCE", "Bảo trì", v => v.operation === "MAINTENANCE"],
  ["INSPECTION", "Chờ kiểm tra", v => v.operation === "INSPECTION"],
  ["OPEN", "Cửa đang mở", v => v.door === "OPEN"],
];

/**
 * Thao tác của một ô:
 * - Có người thuê: ghi nhận / xem sự cố (không đổi tay thành trống).
 * - Trống: đổi trạng thái vận hành (Trống ↔ Bảo trì) và sửa thông tin ô.
 */
export function unitActions(u, view, transitions) {
  if (view.usage === "RENTED") return { incident: view.incident ? "VIEW" : "RECORD", status: false, edit: false };
  return { incident: null, status: Boolean(transitions[u.status]), edit: u.status === "EMPTY" && !view.waiting };
}

export const incidentLink = (view) => `manager/incidents?${view.incident ? `id=${encodeURIComponent(view.incident)}` : `contract=${encodeURIComponent(view.contract || "")}`}`;
