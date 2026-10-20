// Sơ đồ & tình trạng từng ô kho của một cơ sở (Figma C03b-sđ).
// Backend chưa có API danh sách ô kho → sinh cố định theo mã cơ sở. Khi có API,
// thay unitsFor() bằng dữ liệu StorageUnit (UnitNumber, Floor, Zone, Status, UnitType).
import { SIZE_BANDS } from "./catalog.js";

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

// Bố cục theo Figma 14/10: 12 ô, hành lang ở giữa.
// Dãy A cỡ M: K01–K04 kho thường, K05–K06 kho lạnh. Dãy B cỡ L: K07–K10 kho thường, K11–K12 kho lạnh.
const LAYOUT = [
  ["K01", "A", "normal", "M"], ["K02", "A", "normal", "M"], ["K03", "A", "normal", "M"], ["K04", "A", "normal", "M"],
  ["K05", "A", "climate", "M"], ["K06", "A", "climate", "M"],
  ["K07", "B", "normal", "L"], ["K08", "B", "normal", "L"], ["K09", "B", "normal", "L"], ["K10", "B", "normal", "L"],
  ["K11", "B", "climate", "L"], ["K12", "B", "climate", "L"],
];
// Tình trạng mẫu của Figma, xoay vòng theo mã cơ sở để mỗi cơ sở khác nhau nhưng luôn ổn định
const PATTERN = ["FREE", "RENTED", "FREE", "HELD", "FREE", "RENTED", "FREE", "SERVICE", "FREE", "RENTED", "FREE", "RENTED"];

const NON_FREE = ["RENTED", "HELD", "SERVICE"];
const areaText = (n) => `${String(n).replace(".", ",")} m²`;
const BAND_AREA = Object.fromEntries(SIZE_BANDS.map((b) => [b.id, b.area]));

// Gán gói kho cho 12 ô theo loại (thường / lạnh) và cỡ (M / L).
// Dữ liệu backend chưa đủ 4 loại thì ô lấy gói gần nhất: cùng loại + cùng cỡ → cùng cỡ → cùng loại → gói bất kỳ.
function offersForLayout(facility) {
  const offers = facility.offers || [];
  return LAYOUT.map(([, , type, band]) => {
    const offer =
      offers.find((o) => o.type === type && o.band === band) ||
      offers.find((o) => o.band === band) ||
      offers.find((o) => o.type === type) ||
      offers[0] ||
      null;
    return { offer, area: offer?.area ?? BAND_AREA[band] };
  });
}

/**
 * 12 ô kho của một cơ sở.
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
