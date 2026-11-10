/**
 * FACILITY RATES UTILS - TRA CỨU VÀ TÍNH TOÁN BIỂU GIÁ THUÊ KHO (B03)
 *
 * Phù hợp với mô hình D17:
 * - 4 nhóm kho: 15m² thường, 30m² thường, 15m² lạnh, 30m² lạnh.
 * - Hàm currentRate: Lấy mức giá ACTIVE mới nhất có hiệu lực tại ngày chỉ định.
 */
// Chỉ chọn mức giá hiệu lực đúng cơ sở và loại kho; không lấy giá của cơ sở khác.
/**
 * Lấy mức giá thuê có hiệu lực cho một cơ sở và loại kho tại thời điểm cụ thể.
 * @param {Array} rates - Danh sách bảng giá
 * @param {number|string} facilityId - ID cơ sở
 * @param {number|string} unitTypeId - ID loại kho
 * @param {string} date - Ngày tra cứu dạng yyyy-MM-dd
 * @returns {Object|null} Mức giá hiệu lực
 */
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
/**
 * Tìm loại kho tương ứng với vị trí cấu hình diện tích và điều hòa nhiệt độ.
 * @param {Array} types - Danh mục loại kho
 * @param {{ area: number, cold: boolean }} slot - Cấu hình slot
 * @returns {Object|null} Loại kho tương ứng
 */
export function rateTypeFor(types, slot) {
  return types.find(t => t.status === "ACTIVE" && Number(t.area) === slot.area && t.climateControlled === slot.cold) || null;
}
