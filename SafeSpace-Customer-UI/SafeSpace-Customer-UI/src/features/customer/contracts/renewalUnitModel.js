// D46 / D46b · Gia hạn sang ô khác và gia hạn sau nâng cấp miễn phí (D41). Hàm thuần, có test.

export const UNIT_MOVE_STATUS = {
  REQUESTED: ["Chờ cơ sở duyệt", "amber"],
  HELD: ["Đã giữ ô · chờ thanh toán", "blue"],
  PAID: ["Đang chuyển sang ô mới", "blue"],
  MOVED: ["Đã chuyển · chờ kiểm tra ô cũ", "green"],
  INSPECTED: ["Đã chuyển xong", "green"],
};

// Lựa chọn khi gia hạn: KEEP = giữ ô lớn sau nâng cấp (giá ô lớn, không chuyển đồ, đi luồng gia hạn thường);
// còn lại là một ô cụ thể khách chọn (SWAP cùng loại, ORIGINAL_TYPE về loại đã đặt ban đầu).
export function renewalUnitChoices(options) {
  const list = Array.isArray(options?.options) ? options.options : [];
  const units = list.map(o => ({ key: `UNIT-${o.unitId}`, unitId: o.unitId, kind: o.kind, unitNumber: o.unitNumber, typeName: o.unitTypeName,
    monthlyRate: Number(o.monthlyRate) || 0, depositTopUp: Number(o.depositTopUp) || 0, depositRequired: Number(o.depositRequired) || 0 }));
  if (!options?.upgraded) return units.filter(u => u.kind === "SWAP");
  return [{ key: "KEEP", unitId: null, kind: "KEEP", unitNumber: options.currentUnit }, ...units.filter(u => u.kind === "ORIGINAL_TYPE"), ...units.filter(u => u.kind === "SWAP")];
}

// Tạm tính khoản phải trả khi được duyệt: tiền gia hạn + cọc chênh (gộp một khoản, D46b). Giá chốt khi quản lý duyệt.
export function renewalEstimate(choice, months, currentRate) {
  const m = Math.max(1, Number(months) || 1);
  const rate = choice && choice.kind !== "KEEP" ? choice.monthlyRate : Number(currentRate) || 0;
  const topUp = choice && choice.kind !== "KEEP" ? choice.depositTopUp : 0;
  return { rate, rent: rate * m, topUp, total: rate * m + topUp };
}

// Ngày bắt đầu được chuyển đồ: 3 ngày cuối kỳ cũ (gồm ngày hết hạn). Chuỗi ISO yyyy-mm-dd.
export function moveWindowStart(oldEndDate) {
  const [y, mo, d] = String(oldEndDate || "").slice(0, 10).split("-").map(Number);
  if (!y || !mo || !d) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d - 2));
  return dt.toISOString().slice(0, 10);
}

// Nút "Đã chuyển đồ" chỉ bật khi đã thanh toán, chưa chuyển và đang trong 3 ngày cuối kỳ cũ.
export function canMarkMoved(move, todayIso) {
  if (!move || move.status !== "PAID") return false;
  const from = String(move.moveFrom || moveWindowStart(move.oldEndDate) || "").slice(0, 10);
  const end = String(move.oldEndDate || "").slice(0, 10);
  return Boolean(from && end) && todayIso >= from && todayIso <= end;
}
