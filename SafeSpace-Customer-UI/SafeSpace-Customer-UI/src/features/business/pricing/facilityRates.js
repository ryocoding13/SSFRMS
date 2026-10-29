// Chỉ chọn mức giá hiệu lực đúng cơ sở và loại kho; không lấy giá của cơ sở khác.
export function currentRate(rates, facilityId, unitTypeId, date) {
  return rates.filter(r => String(r.facilityId) === String(facilityId) && String(r.unitTypeId) === String(unitTypeId)
    && (!r.status || r.status === "ACTIVE") && r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || Number(b.rateId) - Number(a.rateId))[0] || null;
}
export const RATE_SLOTS = [
  { area: 15, cold: false, title: "Kho nhỏ", file: "unit-1.jpg" },
  { area: 30, cold: false, title: "Kho lớn", file: "unit-2.jpg" },
  { area: 15, cold: true, title: "Kho nhỏ", file: "unit-3.jpg" },
  { area: 30, cold: true, title: "Kho lớn", file: "unit-4.jpg" },
];
export function rateTypeFor(types, slot) {
  return types.find(t => t.status === "ACTIVE" && Number(t.area) === slot.area && t.climateControlled === slot.cold) || null;
}
