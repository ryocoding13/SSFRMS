// [nhãn hiển thị, tông màu]. Nhãn lấy từ text Figma; giá trị khóa là "hợp đồng" UI ↔ BE.
// Xem BE-CONTRACT.md để đối chiếu với trạng thái backend.

export const RESERVATION_STATUS = {
  PENDING_PAYMENT: ["Chờ chuyển khoản", "amber"],
  PENDING_VERIFICATION: ["Chờ đối soát", "amber"],
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
  RECONCILED: ["Đã đối soát", "green"],
  PENDING_VERIFICATION: ["Chờ đối soát", "amber"],
  DEPOSIT_HELD: ["Đang giữ cọc", "blue"],
  RENEWAL_PENDING: ["Chờ duyệt yêu cầu", "amber"],
  UNPAID: ["Chưa thanh toán", "red"],
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
  ACCESS: { label: "Thẻ ra vào / mã truy cập", title: "Lỗi mã truy cập" },
  LOCK: { label: "Khóa / chìa khóa", title: "Khóa / chìa khóa" },
  UNIT: { label: "Tình trạng kho", title: "Tình trạng kho" },
  PAYMENT: { label: "Thanh toán / đối soát", title: "Thanh toán / đối soát" },
  ITEMS: { label: "Đồ đạc lưu trữ", title: "Đồ đạc lưu trữ" },
  SCHEDULE: { label: "Đổi lịch hẹn", title: "Đổi lịch hẹn" },
  OTHER: { label: "Vấn đề khác", title: "Yêu cầu hỗ trợ" },
};
