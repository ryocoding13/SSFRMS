// D32: chỉ dùng tính minh hoạ khi kiểm kê/demo; số quyết toán chính thức do BE trả.
export const CLEANING_DEPOSIT_RATE = 0.1;
export const NO_RETURN_COLLECTION = "Phí trả kho chỉ khấu trừ trong tiền cọc; không thu thêm tại quầy hoặc qua QR.";
export const isReturnFee = row => Boolean(row?.fee) || ["DAMAGE_FEE", "CLEANING_FEE", "OVERDUE_FEE"].includes(row?.kind);
export const canPayLedger = row => !isReturnFee(row) && row?.kind === "RENEWAL" && row?.payable && row?.status === "UNPAID";
export const cleaningFee = (deposit, required) => required ? Math.round(Number(deposit) * CLEANING_DEPOSIT_RATE) : 0;
// D49 · Trả kho sớm sau StartDate: hoàn 100% cọc nếu đạt chuẩn vệ sinh và không hư hỏng/quá hạn
// (nếu có vi phạm vệ sinh/hư hỏng/quá hạn thì trừ vào cọc như trả kho khi đến hạn) + hoàn tiền thuê tháng chưa bắt đầu.
export const EARLY_STOP_KEEP_RATE = 0;
const addMonthsIso = (iso, n) => { const [y, m, d] = String(iso).split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); };
// D59 · Ngày hẹn trong kỳ thuê (trả kho, nhận chìa khóa): từ hôm nay (hoặc ngày bắt đầu thuê nếu chưa tới) đến trước ngày hết hạn
// (QR/PIN mở cửa trong [StartDate, EndDate)).
// Hợp đồng đã tới/quá ngày hết hạn chỉ hẹn được trong hôm nay. Cùng quy tắc với máy chủ (ContractService / SupportTicketService).
const isoDay = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || "")) ? String(value).slice(0, 10) : "";
const dayBefore = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10); };
export function contractVisitRange(endDate, todayIso, startDate) {
  const end = isoDay(endDate), start = isoDay(startDate), min = start > isoDay(todayIso) ? start : isoDay(todayIso);
  const max = !end ? "" : dayBefore(end) > min ? dayBefore(end) : min; // không có hợp đồng → không giới hạn trên
  return { min, max };
}
export function visitDateError(date, endDate, todayIso, what = "trả kho", startDate) {
  const { min, max } = contractVisitRange(endDate, todayIso, startDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return `Vui lòng chọn ngày ${what}.`;
  if (date < min) return min > isoDay(todayIso) ? `Ngày ${what} phải từ ngày bắt đầu thuê ${min.split("-").reverse().join("/")}.` : `Ngày ${what} không được ở quá khứ.`;
  if (max && date > max) return max === min ? `Hợp đồng đã đến ngày hết hạn: chỉ hẹn ${what} trong hôm nay.` : `Ngày ${what} phải trước ngày hết hạn hợp đồng (chậm nhất ${max.split("-").reverse().join("/")}).`;
  return "";
}
export const isEarlyStop = (endDate, moveOutDate) => Boolean(endDate && moveOutDate && moveOutDate < endDate);
export const earlyStopKeep = deposit => Math.round(Math.max(0, Number(deposit) || 0) * EARLY_STOP_KEEP_RATE);
export function contractMonths(start, end) { let m = 0; while (addMonthsIso(start, m) < end) m++; return Math.max(1, m); }
export function unusedRent(monthlyRate, start, end, moveOutDate) {
  if (!start || !end || !(Number(monthlyRate) > 0)) return 0;
  const total = contractMonths(start, end); let begun = 0;
  while (begun < total && addMonthsIso(start, begun) <= moveOutDate) begun++;
  return Math.round(Number(monthlyRate) * (total - begun));
}
export function returnDeductions(ret) {
  const deposit = Math.max(0, Number(ret?.deposit) || 0);
  const report = ret?.report || {};
  const fees = [report.damage_fee, report.overdue_fee, cleaningFee(deposit, report.cleaning_required)];
  const total = fees.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return { owed: total, deduction: Math.min(deposit, total), refund: Math.max(0, deposit - total), debt: 0 };
}
// Máy chủ phải công bố khả năng sau khi T05–T09 được kiểm chứng; không bật bằng env phía FE.
export const supportsReturnPolicy = board => board?.return_policy_version === "D32";
export const RETURN_POLICY_PENDING = "Chức năng chốt trả kho đang chờ cập nhật chính sách tiền cọc. Vui lòng liên hệ quản lý và thử lại sau.";
