import { addMonths } from "./format.js";

export const UNIT_TYPES = [
  { id: "normal", label: "Kho thường" },
  { id: "climate", label: "Kho lạnh" },
];
export const typeLabel = (id) => UNIT_TYPES.find((t) => t.id === id)?.label || "Kho thường";

// Hai cỡ kho theo Figma 14/10: mỗi cơ sở có 8 kho thường (4 M + 4 L) và 4 kho lạnh (2 M + 2 L)
export const SIZE_BANDS = [
  { id: "M", label: "Cỡ M · 15 m²", short: "15 m²", area: 15, name: "Cỡ M", note: "Đồ đạc một phòng, hàng shop online, hồ sơ giấy tờ" },
  { id: "L", label: "Cỡ L · 30 m²", short: "30 m²", area: 30, name: "Cỡ L", note: "Đồ chuyển nhà 2–3 phòng ngủ, hàng tồn kho số lượng lớn" },
];
export const bandLabel = (id) => SIZE_BANDS.find((b) => b.id === id)?.label || SIZE_BANDS[0].label;
// Loại kho từ backend: đến 20 m² là cỡ M, lớn hơn là cỡ L
export const bandOfArea = (area) => (area <= 20 ? "M" : "L");

// Gói thuê trong Figma: 1 / 3 / 6 tháng
export const RENTAL_PLANS = [1, 3, 6];

export const BUDGET_LIMIT = 1100000; // chip "Dưới 1.100.000 đ / tháng"

// ---- Gói kho ("offer") của một cơ sở -------------------------------------
// Mỗi cơ sở có danh sách facility.offers: { key, type, band, size_label, monthly_rate, unit_type_id? }
// - Dữ liệu cục bộ: sinh từ giá gốc của cơ sở × loại kho × nhóm diện tích
// - Backend: mỗi loại kho (UnitType) có bảng giá tại cơ sở là một offer

const BAND_FACTOR = { M: 1, L: 1.75 };
const TYPE_FACTOR = { normal: 1, climate: 1.2 };
const round10k = (n) => Math.round(n / 10000) * 10000;

export const rateFor = (facility, type = "normal", band = "M") =>
  round10k(facility.base_price * BAND_FACTOR[band] * TYPE_FACTOR[type]);

export function localOffers(facility) {
  const types = facility.has_climate ? ["normal", "climate"] : ["normal"];
  return types.flatMap((type) =>
    SIZE_BANDS.map((b) => ({
      key: `${type}-${b.id}`,
      type,
      band: b.id,
      size_label: b.label,
      monthly_rate: rateFor(facility, type, b.id),
    })),
  );
}

export const offerByKey = (facility, key) => facility?.offers?.find((o) => o.key === key) || null;
export const offerTypes = (facility) => [...new Set((facility?.offers || []).map((o) => o.type))];
export const offerLabel = (o) => `${typeLabel(o.type)} · ${o.size_label}`;

const matches = (o, f) => (!f.type || o.type === f.type) && (!f.band || o.band === f.band);

// Gói hiển thị trên thẻ cơ sở: khớp bộ lọc; nếu chưa lọc thì ưu tiên "Kho thường · Cỡ M" như Figma
export function displayOffer(facility, filters = {}) {
  const list = (facility?.offers || []).filter((o) => matches(o, filters));
  if (!list.length) return null;
  const score = (o) => (filters.type ? 0 : o.type === "normal" ? 0 : 1) + (filters.band ? 0 : o.band === "M" ? 0 : 1);
  return [...list].sort((a, b) => score(a) - score(b) || a.monthly_rate - b.monthly_rate)[0];
}

// Gói chọn sẵn ở trang chi tiết theo type / band trên URL
export function pickOffer(facility, { key, type, band } = {}) {
  return offerByKey(facility, key) || displayOffer(facility, { type, band }) || displayOffer(facility, { type }) || displayOffer(facility);
}

export const minRate = (facility, filters = {}) => {
  const list = (facility?.offers || []).filter((o) => matches(o, filters));
  return list.length ? Math.min(...list.map((o) => o.monthly_rate)) : null;
};

// Báo giá theo Figma C03b: tiền thuê, tiền cọc (= 1 tháng), tổng ban đầu
export function quote({ offer, months, start_date }) {
  const monthly_rate = offer?.monthly_rate || 0;
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

// ---- Tìm cơ sở ------------------------------------------------------------
export const areaLabel = (f) => [f.district, f.city].filter(Boolean).join(", ");

export function listAreas(facilities) {
  return [...new Set(facilities.map(areaLabel).filter(Boolean))];
}

export const DEFAULT_FILTERS = { type: "", band: "", area: "", camera: false, budget: false, sort: "best" };

export const hasActiveFilters = (f) => Boolean(f.type || f.band || f.area || f.camera || f.budget);

// Lọc + sắp xếp danh sách cơ sở (C02 / C03)
export function searchFacilities(facilities, filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const list = facilities.filter((x) => {
    const offer = displayOffer(x, f);
    if (!offer) return false;
    if (f.area && areaLabel(x) !== f.area) return false;
    if (f.camera && !x.camera) return false;
    if (f.budget && offer.monthly_rate >= BUDGET_LIMIT) return false;
    return true;
  });
  // Gợi ý theo khu vực khách chọn (không theo vị trí): "Phù hợp nhất" giữ thứ tự danh mục, hoặc sắp theo giá
  if (f.sort !== "price") return list;
  const price = (x) => displayOffer(x, f).monthly_rate;
  return [...list].sort((a, b) => price(a) - price(b));
}
