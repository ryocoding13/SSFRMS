// D46 / D46b · tạm tính khấu trừ khi kiểm tra ô cũ (máy chủ chốt số chính thức). Hàm thuần, có test.
// Thứ tự trừ như BE (RenewalUnitMove.InspectAsync): quá hạn → vệ sinh 10% cọc → hư hỏng; tổng tối đa bằng cọc đang giữ.
const DAY = 86400000;
const OVERDUE_RATE_PER_DAY = 0.05;

function isoDay(value) { return String(value || "").slice(0, 10); }
function dayNumber(iso) { const [y, m, d] = isoDay(iso).split("-").map(Number); return y ? Date.UTC(y, m - 1, d) / DAY : NaN; }

export function vnTodayIso(now = Date.now()) { return new Date(now + 7 * 3600000).toISOString().slice(0, 10); }

export function oldUnitDeduction(item, form, todayIso = vnTodayIso()) {
  const deposit = Math.max(0, Number(item?.depositHeld) || 0);
  const overdueDays = item?.autoMoved ? Math.max(0, dayNumber(todayIso) - dayNumber(item.oldEndDate)) : 0;
  const cleaningRequired = Boolean(form?.cleaning) || form?.walls === "DIRTY";
  const raw = String(form?.walls === "DAMAGED" ? form?.damage ?? "" : "").trim();
  const damage = raw === "" ? 0 : Number(raw);
  const invalidDamage = !Number.isSafeInteger(damage) || damage < 0;
  const cleaningFee = Math.round(deposit * 0.1);
  let left = deposit;
  const take = x => { const t = Math.min(left, Math.max(0, x)); left -= t; return t; };
  const overdue = take(Math.min(deposit, Math.round(deposit * OVERDUE_RATE_PER_DAY * overdueDays)));
  const cleaning = take(cleaningRequired ? cleaningFee : 0);
  const damageTaken = take(invalidDamage ? 0 : damage);
  return { deposit, overdueDays, overdue, cleaningRequired, cleaningFee, cleaning, damage: invalidDamage ? 0 : damage, damageTaken, invalidDamage,
    total: overdue + cleaning + damageTaken, left };
}
