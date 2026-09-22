import { addMonths } from "./format.js";

export const UNIT_TYPES = [
  { id: "normal", label: "Kho thường" },
  { id: "climate", label: "Kiểm soát nhiệt độ" },
];
export const typeLabel = (id) =>
  UNIT_TYPES.find((t) => t.id === id)?.label || "Kho thường";

// Nhãn diện tích theo Figma (C03 "10 – 20 m²", P01 "2–5 m²" / "Trên 20 m²")
export const SIZE_BANDS = [
  { id: "S", label: "2 – 5 m²", name: "Small", note: "Vali, tài liệu và đồ cá nhân" },
  { id: "M", label: "10 – 20 m²", name: "Medium", note: "Đồ nội thất và hàng kinh doanh" },
  { id: "L", label: "Trên 20 m²", name: "Large", note: "Nhiều hàng hóa và nhu cầu dài hạn" },
];
export const bandLabel = (id) =>
  SIZE_BANDS.find((b) => b.id === id)?.label || "10 – 20 m²";

// Gói thuê trong Figma: 1 / 3 / 6 tháng
export const RENTAL_PLANS = [1, 3, 6];

export const BUDGET_LIMIT = 1100000; // chip "Dưới 1.100.000 đ / tháng"

const BAND_FACTOR = { S: 0.63, M: 1, L: 1.75 };
const TYPE_FACTOR = { normal: 1, climate: 1.2 };
const round10k = (n) => Math.round(n / 10000) * 10000;

// Giá thuê / tháng của một cơ sở theo loại kho + diện tích
export const rateFor = (facility, type = "normal", band = "M") =>
  round10k(facility.base_price * BAND_FACTOR[band] * TYPE_FACTOR[type]);

// Báo giá theo Figma C03b: tiền thuê, tiền cọc (= 1 tháng), tổng ban đầu
export function quote({ facility, type, band, months, start_date }) {
  const monthly_rate = rateFor(facility, type, band);
  const rent_total = monthly_rate * months;
  const deposit = monthly_rate;
  return {
    monthly_rate,
    rent_total,
    deposit,
    initial_total: rent_total + deposit,
    end_date: start_date ? addMonths(start_date, months) : null,
  };
}

export const areaLabel = (f) => `${f.district}, ${f.city}`;

export function listAreas(facilities) {
  return [...new Set(facilities.map(areaLabel))];
}

export const DEFAULT_FILTERS = {
  type: "",
  band: "",
  area: "",
  camera: false,
  budget: false,
  sort: "best",
};

export const hasActiveFilters = (f) =>
  Boolean(f.type || f.band || f.area || f.camera || f.budget);

// Lọc + sắp xếp danh sách cơ sở (C02 / C03)
export function searchFacilities(facilities, filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const list = facilities.filter((x) => {
    if (f.type === "climate" && !x.has_climate) return false;
    if (f.area && areaLabel(x) !== f.area) return false;
    if (f.camera && !x.camera) return false;
    if (f.budget && rateFor(x, f.type || "normal", f.band || "M") >= BUDGET_LIMIT)
      return false;
    return true;
  });
  const price = (x) => rateFor(x, f.type || "normal", f.band || "M");
  return [...list].sort((a, b) => {
    if (f.sort === "price") return price(a) - price(b) || a.distance_km - b.distance_km;
    return a.distance_km - b.distance_km; // "best" và "near" đều theo khoảng cách
  });
}
