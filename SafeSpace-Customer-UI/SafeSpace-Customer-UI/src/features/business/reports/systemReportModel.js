/**
 * Lượt 5 · dựng dữ liệu hiển thị cho báo cáo theo khoảng tháng (Figma B-BC / B04a).
 * Một nguồn: thẻ tổng quan, biểu đồ và bảng chi tiết cùng lấy từ phản hồi của cùng một bộ lọc.
 */
import { change, monthLabel } from "../../../shared/utils/monthRange.js";
import { shortFacility } from "../utils/businessFormat.js";

const num = (v) => Number(v) || 0;
const monthKey = (m) => `${m.year}-${String(m.month).padStart(2, "0")}`;

/** Cột doanh thu theo cơ sở, cao xuống thấp; cơ sở 0 đ vẫn có cột (nằm cuối). */
export const facilityColumns = (facilities = []) =>
  [...facilities]
    .sort((a, b) => num(b.metrics?.rentalAndFeeRevenue) - num(a.metrics?.rentalAndFeeRevenue))
    .map((f) => ({ key: String(f.facilityId), label: shortFacility(f.facilityName), value: num(f.metrics?.rentalAndFeeRevenue) }));

/** Cột doanh thu theo tháng (đúng thứ tự thời gian); tháng hiện tại tô đậm. */
export const trendColumns = (months = [], today = "") =>
  months.map((m) => ({ key: monthKey(m), label: monthLabel(monthKey(m)), value: num(m.rentalAndFeeRevenue), highlight: monthKey(m) === today.slice(0, 7) }));

export const trendTotal = (months = []) => months.reduce((s, m) => s + num(m.rentalAndFeeRevenue), 0);

/** Thẻ tổng quan + so sánh cùng kỳ năm trước (null khi không có số liệu cùng kỳ). */
export function systemKpis(current, previous) {
  const t = current?.totals || {}, p = previous?.totals || null;
  return {
    revenue: num(t.rentalAndFeeRevenue),
    revenueChange: p ? change(t.rentalAndFeeRevenue, p.rentalAndFeeRevenue) : null,
    forfeited: num(t.forfeitedRefunds),
    occupancy: t.occupancyRate ?? null, // phần trăm 0–100; null = không áp dụng (cơ sở chưa có ô khai thác)
    occupancyPoints: p && t.occupancyRate != null && p.occupancyRate != null ? Math.round(num(t.occupancyRate) - num(p.occupancyRate)) : null,
    overdue: num(t.overdueContracts),
    overdueDiff: p ? num(t.overdueContracts) - num(p.overdueContracts) : null,
  };
}

/** Bảng chi tiết theo tháng của một cơ sở (mới nhất trước). */
export const monthRows = (months = []) =>
  [...months].reverse().map((m) => ({
    key: monthKey(m), label: monthLabel(monthKey(m)),
    collected: num(m.collected), deposit: num(m.depositCollected), refunded: num(m.refunded), revenue: num(m.rentalAndFeeRevenue),
  }));

/** Gộp nhiều bảng CSV đã đọc thành một sheet, có dòng trống giữa các phần. */
export const joinSheets = (...parts) => parts.filter((p) => p?.length).flatMap((p, i) => (i ? [[], ...p] : p));
