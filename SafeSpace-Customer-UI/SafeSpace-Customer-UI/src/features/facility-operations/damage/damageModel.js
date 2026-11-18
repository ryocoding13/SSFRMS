// Hàm dùng chung cho ảnh bằng chứng và giờ Việt Nam (sự cố cơ sở, hoàn tiền, xử lý quá hạn, biên bản).
// Luồng hồ sơ hư hỏng cũ (Batch06 · T23) đã gỡ theo D48: khấu trừ trả kho đi theo D39 (return-deduction).
export function vnDateTimeInput(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(" ", "T");
}
/**
 * 18/11: các ô chỉ chọn ngày (không chọn giờ). Đổi ngày "YYYY-MM-DD" sang thời điểm giờ Việt Nam cho máy chủ:
 * hôm nay → giờ hiện tại; ngày trước → đầu ngày (start) hoặc cuối ngày (end).
 */
export function vnDayToDateTime(day, edge = "start", now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return "";
  const current = vnDateTimeInput(now);
  if (day === current.slice(0, 10)) return current;
  return `${day}T${edge === "end" ? "23:59" : "00:00"}`;
}
export function parseVnDeadline(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || "")) throw new Error("Chọn hạn khắc phục theo giờ Việt Nam.");
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime()) || vnDateTimeInput(date) !== value) throw new Error("Hạn khắc phục không hợp lệ.");
  return date.toISOString();
}
export function validateDamageFiles(files = []) {
  if (!Array.isArray(files) || files.length > 5) throw new Error("Chỉ đính kèm tối đa 5 ảnh.");
  if (files.some(file => !["image/jpeg", "image/png"].includes(file.type) || !(file.size > 0) || file.size > 5 * 1024 * 1024)) throw new Error("Ảnh phải là JPG/PNG, mỗi ảnh không quá 5 MB.");
}
