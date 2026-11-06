// D42/D44 · Khoản hoàn tiền mặt tại quầy (GET /api/ops/cash-refunds).
export const CASH_STATUS = {
  WAITING_APPROVAL: ["Chờ quản lý duyệt", "amber"],
  READY: ["Đã duyệt · chờ khách đến", "blue"],
  REMIND: ["Cần gọi nhắc khách", "amber"],
  APPOINTMENT: ["Khách đã hẹn ngày đến", "blue"],
  EXPIRED: ["Quá 30 ngày · khách mất khoản hoàn", "red"],
  FORFEITED: ["Quá 30 ngày · khách mất khoản hoàn", "red"],
  SWITCHED: ["Khách đổi sang chuyển khoản", "green"],
  PAID: ["Đã chi tại quầy", "green"],
};
export const CASH_SOURCE = { RESERVATION: "Huỷ đơn", DEPOSIT: "Hoàn cọc", INCIDENT: "Sự cố cơ sở" };
export const cashPath = (id, action) => `/api/ops/cash-refunds/${encodeURIComponent(id)}/${action}`;
