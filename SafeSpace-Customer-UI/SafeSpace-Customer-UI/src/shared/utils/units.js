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

// StorageUnit.Status (backend) → trạng thái hiển thị (an toàn: status không xác định map về SERVICE)
export const fromBackendStatus = (s) => {
  if (!s) return "SERVICE";
  const upper = String(s).toUpperCase();
  if (upper === "AVAILABLE" || upper === "FREE") return "FREE";
  if (upper === "RESERVED" || upper === "ASSIGNED" || upper === "HELD") return "HELD";
  if (["MAINTENANCE", "INSPECTION", "OUT_OF_SERVICE", "LOCKED", "SERVICE"].includes(upper)) return "SERVICE";
  if (["RENTED", "OCCUPIED", "RETURN_PENDING", "OVERDUE"].includes(upper)) return "RENTED";
  return "SERVICE";
};

/** Định dạng nhãn Khu vực/Dãy: tránh nhân đôi tiền tố "Dãy Dãy A" hoặc "Dãy Khu A". */
export const zoneLabel = (zone) => {
  if (!zone) return "Chưa phân khu";
  const s = String(zone).trim();
  if (!s || s === "Chưa phân khu") return "Chưa phân khu";
  if (/^(dãy|khu)\b/i.test(s)) return s;
  return `Dãy ${s}`;
};

/** Định dạng nhãn Tầng: tránh nhân đôi tiền tố "Tầng Tầng 1". */
export const floorLabel = (floor) => {
  if (!floor) return "Chưa xác định tầng";
  const s = String(floor).trim();
  if (!s || s === "Chưa xác định tầng") return "Chưa xác định tầng";
  if (/^tầng\b/i.test(s)) return s;
  return `Tầng ${s}`;
};

/** Định dạng vị trí đầy đủ hiển thị cho ô kho (Tầng · Dãy [· Mô tả chi tiết]). */
export const positionLabel = ({ floor, zone, locationDescription } = {}) => {
  const f = floor ? floorLabel(floor) : null;
  const z = zone ? zoneLabel(zone) : null;
  const parts = [f, z].filter((p) => p && p !== "Chưa xác định tầng" && p !== "Chưa phân khu");
  if (parts.length > 0) {
    if (locationDescription && String(locationDescription).trim()) {
      return `${parts.join(" · ")} (${String(locationDescription).trim()})`;
    }
    return parts.join(" · ");
  }
  if (locationDescription && String(locationDescription).trim()) {
    return String(locationDescription).trim();
  }
  return "Chưa phân khu";
};

// Bố cục fallback demo: 12 ô, hành lang ở giữa (Figma 14/10).
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

// Gán gói kho cho 12 ô theo loại (thường / lạnh) và cỡ (M / L) cho chế độ demo.
function offersForLayout(facility) {
  const offers = facility?.offers || [];
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
 * Tìm offer trong catalog của cơ sở khớp tốt nhất với ô kho thực tế.
 * Ưu tiên:
 * 1. Khớp chính xác UnitTypeId / `ut-${UnitTypeId}`
 * 2. Khớp cùng loại (thường / lạnh) và diện tích xấp xỉ
 * 3. Khớp cùng loại (thường / lạnh)
 * 4. Fallback gói đầu tiên của cơ sở nếu có
 */
function matchOfferForUnit(offers, unit) {
  if (!offers || offers.length === 0) return null;
  const unitTypeId = unit.unitTypeId ?? unit.unit_type_id ?? null;
  if (unitTypeId != null) {
    const matchId = offers.find(
      (o) => o.unit_type_id === unitTypeId || o.key === `ut-${unitTypeId}` || o.unitTypeId === unitTypeId,
    );
    if (matchId) return matchId;
  }
  const isClimate = unit.climateControlled !== undefined ? Boolean(unit.climateControlled) : unit.type === "climate";
  const targetType = isClimate ? "climate" : "normal";
  const unitArea = Number(unit.sizeM2 ?? unit.area ?? 0);
  if (unitArea > 0) {
    const matchTypeArea = offers.find(
      (o) => o.type === targetType && Math.abs(Number(o.area || 0) - unitArea) < 0.1,
    );
    if (matchTypeArea) return matchTypeArea;
  }
  const matchType = offers.find((o) => o.type === targetType);
  if (matchType) return matchType;
  return offers[0] || null;
}

/**
 * Danh sách ô kho của một cơ sở (Customer Unit Map).
 * - Chế độ API: Khi `realUnits` là một mảng (kể cả mảng rỗng []), danh sách ô được ánh xạ 100% động từ
 *   kết quả API (GET /api/facilities/{id}/units), hỗ trợ hiển thị 0, 1, 12, 13, 20... ô kho không bị chặn cứng.
 * - Chế độ Demo/Offline: Khi `realUnits === null`, giữ fallback 12 ô mẫu để bảo toàn backward compatibility.
 *
 * @param {object} facility Đối tượng cơ sở kho
 * @param {object|null} stock Số ô trống theo offer.key từ checkAvailability (dùng cho chế độ demo)
 * @param {Array|null} realUnits Danh sách StorageUnit từ GET /api/facilities/{id}/units
 * @returns {Array} Danh sách ô kho hiển thị
 */
export function unitsFor(facility, stock = null, realUnits = null) {
  if (!facility) return [];

  // CHẾ ĐỘ API: Dữ liệu thực tế từ backend
  if (Array.isArray(realUnits)) {
    if (realUnits.length === 0) return [];

    const offers = facility.offers || [];
    return realUnits.map((u, i) => {
      const code = String(u.unitNumber ?? u.code ?? `K${String(i + 1).padStart(2, "0")}`).trim();
      const floor = u.floor || "Tầng trệt";
      const row = u.zone || u.row || "A";
      const zone = u.zone || u.row || null;
      const position = positionLabel({ floor, zone, locationDescription: u.locationDescription });

      const offer = matchOfferForUnit(offers, u);
      const isClimate = u.climateControlled !== undefined ? Boolean(u.climateControlled) : (offer?.type === "climate" || u.type === "climate");
      const unitArea = Number(u.sizeM2 ?? u.area ?? offer?.area ?? 15);
      const area = unitArea > 0 ? unitArea : 15;
      const status = fromBackendStatus(u.status);

      return {
        unit_id: u.unitId ?? u.unit_id ?? null,
        code,
        row,
        zone,
        floor,
        area,
        area_label: areaText(area),
        type: offer?.type || (isClimate ? "climate" : "normal"),
        offer_key: offer?.key || (u.unitTypeId ? `ut-${u.unitTypeId}` : null),
        monthly_rate: offer?.monthly_rate || 0,
        has_pricing: Boolean(offer && offer.monthly_rate > 0),
        position,
        status,
        free_from: u.freeFrom || null,
        overdue: Boolean(u.overdue),
        bookable_for_period: u.bookableForPeriod !== undefined ? Boolean(u.bookableForPeriod) : status === "FREE",
        period_unavailable_reason: u.periodUnavailableReason || null,
        current_contract_end_date: u.currentContractEndDate || null,
      };
    });
  }

  // CHẾ ĐỘ DEMO / FALLBACK: 12 ô mẫu xoay vòng theo cơ sở
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
      } else if (status === "FREE") {
        status = NON_FREE[i % NON_FREE.length];
      }
    }
    return {
      code,
      row,
      area,
      area_label: areaText(area),
      type: offer?.type || "normal",
      offer_key: offer?.key || null,
      monthly_rate: offer?.monthly_rate || 0,
      has_pricing: Boolean(offer && offer.monthly_rate > 0),
      position: `Tầng trệt · Dãy ${row}`,
      status,
      current_contract_end_date: null,
      free_from: null,
      overdue: false,
      bookable_for_period: status === "FREE",
      period_unavailable_reason: null,
    };
  });
}

export const freeCount = (units) => units.filter((u) => u.status === "FREE").length;
export const bookableCount = (units) => units.filter((u) => u.bookable_for_period).length;
export const countBy = (units) =>
  LEGEND.reduce((acc, s) => ({ ...acc, [s]: units.filter((u) => u.status === s).length }), {});
