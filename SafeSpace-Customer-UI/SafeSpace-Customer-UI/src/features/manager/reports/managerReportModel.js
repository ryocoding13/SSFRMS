import { monthLabel, monthsIn } from "../../../shared/utils/monthRange.js";

// Lượt 5 (#58): dòng doanh thu theo từng tháng trong khoảng đã chọn (tháng không có số liệu = 0 đ, known=false).
const pad = (n) => String(n).padStart(2, "0");
export function managerRevenueRows(months = [], range) {
  const inRange = monthsIn(range);
  const by = new Map(months.map((m) => [`${m.year}-${pad(m.month)}`, Number(m.value) || 0]));
  return inRange.map((k) => ({ key: k, label: monthLabel(k), value: by.get(k) ?? 0, known: by.has(k) }));
}

