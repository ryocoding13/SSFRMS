// D46 / D46b / D48 · tạm tính khấu trừ khi kiểm tra ô cũ (máy chủ chốt số chính thức). Hàm thuần, có test.
// Thứ tự trừ như BE (RenewalUnitMove.InspectAsync): vệ sinh 10% cọc → hư hỏng; tổng tối đa bằng cọc đang giữ.
// D48: không tính phí quá hạn ô cũ (kể cả khi hệ thống tự chuyển); đồ còn lại coi là đồ khách bỏ, không trừ phí.

export function vnTodayIso(now = Date.now()) { return new Date(now + 7 * 3600000).toISOString().slice(0, 10); }

export function oldUnitDeduction(item, form) {
  const deposit = Math.max(0, Number(item?.depositHeld) || 0);
  const cleaningRequired = Boolean(form?.cleaning) || form?.walls === "DIRTY";
  const raw = String(form?.walls === "DAMAGED" ? form?.damage ?? "" : "").trim();
  const damage = raw === "" ? 0 : Number(raw);
  const invalidDamage = !Number.isSafeInteger(damage) || damage < 0;
  const cleaningFee = Math.round(deposit * 0.1);
  let left = deposit;
  const take = x => { const t = Math.min(left, Math.max(0, x)); left -= t; return t; };
  const cleaning = take(cleaningRequired ? cleaningFee : 0);
  const damageTaken = take(invalidDamage ? 0 : damage);
  return { deposit, cleaningRequired, cleaningFee, cleaning, damage: invalidDamage ? 0 : damage, damageTaken, invalidDamage,
    total: cleaning + damageTaken, left };
}
