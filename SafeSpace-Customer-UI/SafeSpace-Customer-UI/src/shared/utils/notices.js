// Chuông thông báo (18/11): đã đọc thì xoá khỏi chuông và nhớ khoá để thông báo sinh từ máy chủ không quay lại.
// Thông báo quá hạn gắn thêm nội dung để khi số ngày quá hạn đổi thì hiện lại.
export const noticeKey = (n) => (typeof n?.id === "string" && n.id.startsWith("SERVER-OVERDUE-") ? `${n.id}|${n.detail}` : n?.id);
