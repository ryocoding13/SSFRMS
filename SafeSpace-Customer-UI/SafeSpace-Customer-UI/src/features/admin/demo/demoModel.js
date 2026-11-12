// Lượt 6 · #45 #54: các kịch bản ngày để demo nhanh (tính theo hôm nay), và kiểm tra dữ liệu nhập.
import { addDays, addMonths } from "../../../shared/utils/format.js";

export const SCENARIOS = [
  ["NOT_YET", "Chưa tới ngày thuê", (t) => ({ start: addDays(t, 2), end: addMonths(addDays(t, 2), 3) })],
  ["ACTIVE", "Đang thuê", (t) => ({ start: addDays(t, -30), end: addDays(t, 60) })],
  ["EXPIRING", "Sắp hết hạn", (t) => ({ start: addDays(t, -85), end: addDays(t, 5) })],
  ["OVERDUE", "Quá hạn", (t) => ({ start: addDays(t, -95), end: addDays(t, -3) })],
];

/** Trạng thái dự kiến sau khi lưu (giống BE DemoToolsService.RunningStatus; hết hạn tính từ 00:00 ngày hết hạn). */
export function expectedState(start, end, today) {
  if (!start || !end) return null;
  if (start > today) return "Chưa tới ngày thuê";
  if (end <= today) return `Quá hạn ${Math.round((Date.parse(today) - Date.parse(end)) / 86400000)} ngày`;
  return Math.round((Date.parse(end) - Date.parse(today)) / 86400000) <= 14 ? "Sắp hết hạn" : "Đang thuê";
}

export function contractFormError({ start, end, rate }) {
  if (!start || !end) return "Chọn ngày bắt đầu và ngày hết hạn.";
  if (end <= start) return "Ngày hết hạn phải sau ngày bắt đầu.";
  if (rate !== "" && rate != null && !(Number(rate) > 0)) return "Giá thuê tháng phải lớn hơn 0.";
  return "";
}

export function paymentFormError({ paidAt, amount }, nowLocal) {
  if (!paidAt && (amount === "" || amount == null)) return "Nhập ngày thanh toán hoặc số tiền cần chỉnh.";
  if (paidAt && paidAt > nowLocal) return "Ngày thanh toán không được ở tương lai.";
  if (amount !== "" && amount != null && !(Number(amount) > 0)) return "Số tiền phải lớn hơn 0.";
  return "";
}

// Lượt 6b · trang thẻ chọn Công cụ demo (Figma A-DEMO): [đường dẫn con, biểu tượng, tiêu đề, mô tả, ghi chú, chữ link]
export const TOOLS = [
  ["scanner", "QR", "Máy quét", "Mô phỏng máy quét ở cửa kho: nhập PIN 6 số hoặc quét mã QR để mở cửa, bấm Đóng cửa, gọi hỗ trợ cho cơ sở.", "Chọn cơ sở và ô kho trước khi quét", "Mở máy quét →"],
  ["price", "₫", "Chỉnh giá", "Đổi giá thuê tháng của hợp đồng và số tiền của giao dịch đã phát sinh để kiểm tra đối soát và báo cáo doanh thu.", "Tiền cọc chỉ xem, không chỉnh", "Chỉnh giá →"],
  ["dates", "31", "Chỉnh ngày hợp đồng", "Đổi ngày bắt đầu, ngày hết hạn và ngày giao dịch. Có sẵn 4 kịch bản: chưa tới ngày thuê, đang thuê, sắp hết hạn, quá hạn.", "Trạng thái hợp đồng và ô kho tự tính lại", "Chỉnh ngày →"],
  ["door-logs", "≡", "Nhật ký cửa", "Xem các lần mở, đóng và từ chối ở từng ô; lọc theo cơ sở, ô kho, kết quả và ngày. Không hiện nguyên mã QR hay PIN.", "Mỗi lần mở, đóng, từ chối là một dòng", "Xem nhật ký →"],
];
export const toolTitle = (key) => TOOLS.find((t) => t[0] === key)?.[2] || "";

/** Số ngày quá hạn (giống BE: hôm nay − ngày hết hạn) và phí quá hạn 5% cọc/ngày, tối đa bằng cọc (D31). */
export function overdueDays(end, today) {
  if (!end || end > today) return 0;
  return Math.round((Date.parse(today) - Date.parse(end)) / 86400000);
}
export const overdueFee = (deposit, days) => Math.min(Number(deposit) || 0, Math.round((Number(deposit) || 0) * 0.05 * days));

// ---- Máy quét (D51): PIN 6 số chỉ gồm 1–9, cửa không tự khoá
export const PIN_LENGTH = 6;
export function pinError(pin) {
  if (!/^\d*$/.test(pin)) return "Mã PIN chỉ gồm chữ số.";
  if (pin.includes("0")) return "Mã PIN gồm 6 số từ 1 đến 9.";
  if (pin.length !== PIN_LENGTH) return "Nhập đủ 6 số.";
  return "";
}
/** Màn hình máy quét theo kết quả quét: OPEN | NOT_YET | DENIED */
export function scanScreen(scan) {
  if (!scan) return "IDLE";
  if (scan.result === "OPEN") return "OPEN";
  return /^Chưa đến ngày sử dụng/.test(scan.reason || "") ? "NOT_YET" : "DENIED";
}

// ---- Nhật ký cửa (#49)
export const DOOR_RESULT = { OPEN: ["Mở cửa", "green"], DENIED: ["Từ chối", "red"], CLOSED: ["Đóng cửa", "gray"] };
export const DOOR_METHOD = { QR: "xác thực bằng QR", PIN: "xác thực bằng PIN", CLOSE_DEVICE: "nút Đóng cửa trên máy quét", CLOSE_APP: "bấm \"Đóng cửa\" trong Kho của tôi" };
export function doorLogLine(row) {
  const who = row.customerName ? `Khách ${row.customerName}` : row.result === "CLOSED" && row.method === "CLOSE_DEVICE" ? "Máy quét" : "Không xác định được khách";
  const how = DOOR_METHOD[row.method] || "";
  const parts = [who];
  if (row.contractCode && row.result === "DENIED") parts[0] = `Mã của ${row.contractCode}`;
  if (how) parts.push(how);
  if (row.reason) parts.push(`Lý do: ${row.reason}`);
  return parts.join(" · ");
}
