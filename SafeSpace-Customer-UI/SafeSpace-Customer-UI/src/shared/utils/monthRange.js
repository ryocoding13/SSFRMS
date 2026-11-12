/**
 * #58 · Bộ lọc từ tháng đến tháng cho mọi báo cáo theo thời gian (Quản lý cơ sở, Vận hành KD).
 * Tháng dạng "YYYY-MM". Qua năm được (11/2026 – 02/2027); tháng bắt đầu không sau tháng kết thúc; tối đa 24 tháng.
 */
export const MAX_MONTHS = 24;
const RE = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/;

export const isMonth = (v) => RE.test(String(v || ""));
const index = (m) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo - 1; };
const ofIndex = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

export const monthLabel = (m) => (isMonth(m) ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : "");
export const monthCount = (from, to) => index(to) - index(from) + 1;
export const addMonth = (m, n) => ofIndex(index(m) + n);

/** Mặc định: tháng 1 năm nay → tháng hiện tại (như Figma B-BC 01/2026 – 11/2026). */
export function defaultRange(today) {
  const cur = today.slice(0, 7);
  return { from: `${cur.slice(0, 4)}-01`, to: cur };
}

/** Lỗi của khoảng tháng, rỗng nếu hợp lệ. */
export function rangeError({ from, to }) {
  if (!isMonth(from) || !isMonth(to)) return "Chọn đủ Từ tháng và Đến tháng.";
  const n = monthCount(from, to);
  if (n < 1) return "Tháng bắt đầu phải trước hoặc bằng tháng kết thúc.";
  if (n > MAX_MONTHS) return `Khoảng xem tối đa ${MAX_MONTHS} tháng.`;
  return "";
}

/** Đọc khoảng tháng từ URL (?from=YYYY-MM&to=YYYY-MM); sai thì dùng mặc định. */
export function rangeFromQuery(query, today) {
  const r = { from: query?.get?.("from") || "", to: query?.get?.("to") || "" };
  return rangeError(r) ? defaultRange(today) : r;
}

/** "01/2026 – 11/2026 · 11 tháng" */
export const rangeText = ({ from, to }) => `${monthLabel(from)} – ${monthLabel(to)} · ${monthCount(from, to)} tháng`;

/** Ngày đầu/cuối của khoảng để gọi API (ngày cuối không vượt hôm nay). */
export function rangePeriod({ from, to }, today) {
  const [y, m] = to.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${to}-${String(last).padStart(2, "0")}`;
  return { from: `${from}-01`, to: end > today ? today : end };
}

/** Tham số theo tháng cho API theo tháng (không cắt theo hôm nay, để trục hiện đủ mọi tháng trong khoảng). */
export const rangeMonths = ({ from, to }) => ({ from: `${from}-01`, to: `${to}-01` });

/** Cùng kỳ năm trước (để so sánh tăng/giảm). */
export const previousYear = ({ from, to }) => ({ from: addMonth(from, -12), to: addMonth(to, -12) });

/** Danh sách tháng trong khoảng, theo thứ tự. */
export const monthsIn = ({ from, to }) => Array.from({ length: Math.max(0, monthCount(from, to)) }, (_, i) => addMonth(from, i));

/** % thay đổi; null khi kỳ so sánh bằng 0 (không chia cho 0). */
export function change(current, previous) {
  const a = Number(current) || 0, b = Number(previous) || 0;
  if (!b) return null;
  return ((a - b) / b) * 100;
}

/** Bậc chia trục đẹp (1, 2, 2.5, 5 × 10^n), luôn có mốc 0. */
export function niceTicks(max, count = 5) {
  const top = Math.max(0, Number(max) || 0);
  if (top <= 0) return [0, 250000, 500000, 750000, 1000000].reverse();
  const raw = top / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || 10 * mag;
  const ticks = [];
  for (let v = 0; v <= top + step * 0.001 || ticks.length < 2; v += step) ticks.push(Math.round(v));
  if (ticks.at(-1) < top) ticks.push(Math.round(ticks.at(-1) + step));
  return ticks.reverse();
}
