// Sơ đồ & tình trạng từng ô kho của một cơ sở (Figma C03b-sđ).
// Backend chưa có API danh sách ô kho → sinh cố định theo mã cơ sở. Khi có API,
// thay unitsFor() bằng dữ liệu StorageUnit (UnitNumber, Floor, Zone, Status, UnitType).
import { offerByKey } from "./catalog.js";

// Trạng thái ô kho hiển thị cho khách (map từ StorageUnit.Status của backend)
export const UNIT_STATUS = {
  FREE: { label: "Còn trống", tone: "free" },
  RENTED: { label: "Đang thuê", tone: "rented" },
  HELD: { label: "Giữ chỗ", tone: "held" },
  SERVICE: { label: "Bảo trì", tone: "service" },
};
export const LEGEND = ["FREE", "RENTED", "HELD", "SERVICE"];

// StorageUnit.Status (backend) → trạng thái hiển thị
export const fromBackendStatus = (s) =>
  s === "AVAILABLE" ? "FREE" : s === "RESERVED" || s === "ASSIGNED" ? "HELD" : ["MAINTENANCE", "INSPECTION", "OUT_OF_SERVICE"].includes(s) ? "SERVICE" : "RENTED";

// Bố cục theo Figma: dãy A (K01–K05, 5 m²) và dãy B (K06–K10, 10 m²), hành lang ở giữa
const LAYOUT = [
  ["K01", "A", 5], ["K02", "A", 5], ["K03", "A", 5], ["K04", "A", 5], ["K05", "A", 5],
  ["K06", "B", 10], ["K07", "B", 10], ["K08", "B", 10], ["K09", "B", 10], ["K10", "B", 10],
];
// Tình trạng mẫu của Figma, xoay vòng theo mã cơ sở để mỗi cơ sở khác nhau nhưng luôn ổn định
const PATTERN = ["FREE", "RENTED", "FREE", "HELD", "FREE", "RENTED", "FREE", "SERVICE", "FREE", "RENTED"];
const COLD = ["K04", "K05", "K09", "K10"];

const NON_FREE = ["RENTED", "HELD", "SERVICE"];
const areaText = (n) => `${String(n).replace(".", ",")} m²`;

// Gán gói kho cho 10 ô: dữ liệu cục bộ theo bố cục Figma (5 m² / 10 m²);
// dữ liệu backend (gói theo UnitType) → dãy A nhận các loại nhỏ, dãy B các loại lớn.
function offersForLayout(facility) {
  const offers = facility.offers || [];
  if (!offers.some((o) => o.unit_type_id)) {
    return LAYOUT.map(([code, , area]) => {
      const wantCold = facility.has_climate !== false && COLD.includes(code);
      const band = area <= 5 ? "S" : "M";
      return { offer: offerByKey(facility, `${wantCold ? "climate" : "normal"}-${band}`) || offerByKey(facility, `normal-${band}`), area };
    });
  }
  const sorted = [...offers].sort((x, y) => (x.area || 0) - (y.area || 0));
  const half = Math.max(1, Math.ceil(sorted.length / 2));
  const small = sorted.slice(0, half);
  const large = sorted.length > 1 ? sorted.slice(half) : sorted;
  return LAYOUT.map(([, row], i) => {
    const pool = row === "A" ? small : large;
    const offer = pool[(row === "A" ? i : i - 5) % pool.length];
    return { offer, area: offer?.area ?? (row === "A" ? 5 : 10) };
  });
}

/**
 * 10 ô kho của một cơ sở.
 * `stock` (không bắt buộc): { [offer.key]: số ô trống } lấy từ POST /api/availability/check —
 * khi có, số ô "Còn trống" của mỗi loại khớp đúng số backend trả về.
 */
export function unitsFor(facility, stock = null) {
  if (!facility) return [];
  const shift = ((Number(facility.facility_id) || 1) - 1) % PATTERN.length;
  const assigned = offersForLayout(facility);
  const freeLeft = stock ? { ...stock } : null;
  return LAYOUT.map(([code, row], i) => {
    const { offer, area } = assigned[i];
    let status = PATTERN[(i + shift * 3) % PATTERN.length];
    if (freeLeft && offer && offer.key in freeLeft) {
      if (freeLeft[offer.key] > 0) {
        status = "FREE";
        freeLeft[offer.key] -= 1;
      } else if (status === "FREE") status = NON_FREE[i % NON_FREE.length];
    }
    return {
      code,
      row,
      area,
      area_label: areaText(area),
      type: offer?.type || "normal",
      offer_key: offer?.key || null,
      monthly_rate: offer?.monthly_rate || 0,
      position: `Tầng trệt · Dãy ${row}`,
      status,
    };
  });
}

export const freeCount = (units) => units.filter((u) => u.status === "FREE").length;
export const countBy = (units) =>
  LEGEND.reduce((acc, s) => ({ ...acc, [s]: units.filter((u) => u.status === s).length }), {});
