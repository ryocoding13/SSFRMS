// [nhãn hiển thị, tông màu]. Nhãn lấy từ text Figma; giá trị khóa là "hợp đồng" UI ↔ BE.
// Xem BE-CONTRACT.md để đối chiếu với trạng thái backend.

export const RESERVATION_STATUS = {
  PENDING_PAYMENT: ["Chờ thanh toán", "amber"],
  // Từ khi có PayOS (D19), đơn chờ xác nhận chỉ còn là đơn khách chọn trả tại cửa hàng (C04c/C05c)
  PENDING_VERIFICATION: ["Chờ thanh toán tại cửa hàng", "amber"],
  CONFIRMED: ["Đã xác nhận", "green"],
  CHECKED_IN: ["Đã nhận kho", "green"],
  CANCELLED: ["Đã huỷ đặt chỗ", "gray"],
};

export const CONTRACT_STATUS = {
  ACTIVE: ["Đang thuê", "green"],
  EXPIRING: ["Sắp hết hạn", "amber"],
  OVERDUE: ["Quá hạn", "red"],
  ENDED: ["Đã kết thúc", "gray"],
};

export const LEDGER_STATUS = {
  RECONCILED: ["Đã thanh toán", "green"],
  PENDING_VERIFICATION: ["Chờ thanh toán tại cửa hàng", "amber"],
  DEPOSIT_HELD: ["Đang giữ cọc", "blue"],
  RENEWAL_PENDING: ["Chờ duyệt yêu cầu", "amber"],
  UNPAID: ["Chờ thanh toán", "red"],
  REFUNDED: ["Đã hoàn", "gray"],
};

export const APPOINTMENT_STATUS = {
  CONFIRMED: ["Lịch đã xác nhận", "green"],
  PENDING: ["Chờ cơ sở xác nhận", "amber"],
  DONE: ["Đã hoàn tất", "gray"],
  CANCELLED: ["Đã huỷ", "gray"],
};

export const TICKET_STATUS = {
  OPEN: ["Chờ tiếp nhận", "blue"],
  IN_PROGRESS: ["Đang xử lý", "amber"],
  RESOLVED: ["Đã xử lý", "green"],
  CANCELLED: ["Đã huỷ", "gray"],
};

export const TICKET_TOPICS = {
  ACCESS: { label: "Ra vào kho · QR, PIN & chìa khóa", title: "Hỗ trợ ra vào kho", issueType: "ACCESS_CODE" },
  PAYMENT: { label: "Thanh toán & hóa đơn", title: "Thanh toán & hóa đơn", issueType: "PAYMENT" },
  RENEWAL: { label: "Gia hạn hợp đồng", title: "Gia hạn hợp đồng", issueType: "OTHER" },
  RETURN: { label: "Trả kho & kết thúc hợp đồng", title: "Trả kho & kết thúc hợp đồng", issueType: "OTHER" },
  UNIT: { label: "Sự cố kho / khóa cửa", title: "Sự cố kho / khóa cửa", issueType: "UNIT" },
  MAINTENANCE: { label: "Vệ sinh & bảo trì", title: "Vệ sinh & bảo trì", issueType: "UNIT" },
  SCHEDULE: { label: "Lịch hẹn & thông tin hợp đồng", title: "Lịch hẹn & thông tin hợp đồng", issueType: "OTHER" },
  OTHER: { label: "Khác · Tự nhập chủ đề", title: "Yêu cầu hỗ trợ", issueType: "OTHER" },
  LOCK: { label: "Khóa / chìa khóa", title: "Khóa / chìa khóa", issueType: "LOCK", legacy: true },
  ITEMS: { label: "Đồ đạc lưu trữ", title: "Đồ đạc lưu trữ", issueType: "STORED_ITEM", legacy: true },
};

export const ACCESS_REQUESTS = { QR: "Cấp lại mã QR", PIN: "Đặt lại PIN 6 số", KEY: "Cấp lại chìa khóa vật lý" };
export function ticketTitle(form) {
  if (form.topic === "OTHER") return String(form.subject || "").trim();
  if (form.topic === "ACCESS") return ACCESS_REQUESTS[form.access_request] || TICKET_TOPICS.ACCESS.title;
  return TICKET_TOPICS[form.topic]?.title || "";
}
