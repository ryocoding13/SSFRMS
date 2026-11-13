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
  // Khách đã gửi trả kho: mã QR/PIN hết hiệu lực, chờ nhân viên kiểm tra (không còn hiện "Đang thuê")
  RETURN_PENDING: ["Chờ trả kho", "blue"],
  ENDED: ["Đã kết thúc", "gray"],
};

export const LEDGER_STATUS = {
  REFUND_PENDING: ["Chờ hoàn", "amber"],
  RECONCILED: ["Đã thanh toán", "green"],
  PENDING_VERIFICATION: ["Chờ thanh toán tại cửa hàng", "amber"],
  DEPOSIT_HELD: ["Đang giữ cọc", "blue"],
  RENEWAL_PENDING: ["Chờ duyệt yêu cầu", "amber"],
  EXPIRED: ["Hết hạn thanh toán", "gray"],
  UNPAID: ["Chờ thanh toán", "red"],
  AT_COUNTER: ["Chờ thu tại quầy", "amber"], // C11fcp: khách chọn trả phí tại quầy, nhân viên chưa thu
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
  // D36: lần đầu nhận chìa khóa — gửi yêu cầu thì cơ sở mới xếp lịch giao chìa (BE lưu tiêu đề cố định)
  KEY_PICKUP: { label: "Nhận chìa khóa · lần đầu nhận kho", title: "Nhận chìa khóa · lần đầu nhận kho", issueType: "KEY_PICKUP" },
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
// Figma C12-* · câu hỏi thứ hai theo chủ đề; ghép với chủ đề thành tiêu đề yêu cầu.
export const TICKET_OPTIONS = {
  ACCESS: { question: "Bạn cần hỗ trợ gì?", options: ACCESS_REQUESTS, hint: "Mã QR/PIN cũ ngừng hoạt động ngay khi cơ sở cấp mã mới." },
  PAYMENT: { question: "Vấn đề thanh toán", options: { NOT_RECORDED: "Đã trả nhưng chưa ghi nhận", VAT: "Cần hóa đơn VAT", WRONG_AMOUNT: "Số tiền bị trừ sai" }, hint: "Ghi rõ ngày giờ và số tiền đã trả khi nhân viên liên hệ. Không gửi số thẻ, mã OTP hay mật khẩu ngân hàng." },
  RENEWAL: { question: "Bạn cần hỏi gì?", options: { PRICE: "Giá gia hạn", MONTHS: "Đổi số tháng gia hạn", REJECTED: "Yêu cầu gia hạn bị từ chối" }, hint: "Gửi yêu cầu gia hạn ở mục Kho của tôi; ở đây chỉ hỏi thêm thông tin. Ô đã có khách đặt trước thì gia hạn sang ô khác." },
  RETURN: { question: "Bạn cần hỗ trợ gì?", options: { REFUND: "Hỏi khoản hoàn cọc", RESCHEDULE: "Đổi lịch kiểm tra trả kho", DISPUTE: "Khiếu nại biên bản kiểm tra" }, hint: "Gửi yêu cầu trả kho ở mục Kho của tôi. Khoản khấu trừ và cách nhận hoàn xem trong biên bản trả kho." },
  UNIT: { question: "Sự cố gặp phải", options: { STUCK: "Cửa kẹt, không mở được", LOCK: "Khóa hỏng", LEAK: "Kho dột hoặc ẩm" }, hint: "Khẩn cấp (không ra được, có nguy hiểm): gọi hotline của cơ sở. Cơ sở cử nhân viên kiểm tra tại kho." },
  MAINTENANCE: { question: "Khu vực cần xử lý", options: { CLEANING: "Khu chung chưa đạt tiêu chuẩn vệ sinh", PEST: "Côn trùng", POWER: "Đèn hoặc điện hỏng" }, hint: "Cơ sở xếp lịch xử lý theo thứ tự gửi và báo lại trên chuông thông báo." },
  SCHEDULE: { question: "Bạn cần thay đổi gì?", options: { APPOINTMENT: "Đổi lịch hẹn", PROFILE: "Sửa thông tin cá nhân", COPY: "Xin bản sao hợp đồng" }, hint: "Đổi tên chủ hợp đồng cần mang CCCD đến quầy. Thông tin đã sửa hiện trong hợp đồng sau khi cơ sở xác nhận." },
};
export const firstOption = topic => Object.keys(TICKET_OPTIONS[topic]?.options || {})[0] || "";
export function ticketTitle(form) {
  if (form.topic === "OTHER") return String(form.subject || "").trim();
  // Thắng chốt 06/11: tiêu đề = chủ đề · lựa chọn (vd "Thanh toán & hóa đơn · Cần hóa đơn VAT")
  const topic = TICKET_TOPICS[form.topic]?.title || "";
  const option = TICKET_OPTIONS[form.topic]?.options[form.topic === "ACCESS" ? (form.access_request || form.option) : form.option];
  return option ? `${topic} · ${option}` : topic;
}
