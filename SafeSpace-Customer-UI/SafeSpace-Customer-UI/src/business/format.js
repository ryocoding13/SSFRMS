// Hàm thuần cho khu Quản lý vận hành KD (B01–B05) — có test ở tests/business.test.js.
import { money, today } from "../lib/format.js";

const comma = (n, digits = 1) => Number(n).toFixed(digits).replace(".", ",");

/** Tiền rút gọn cho thẻ số liệu / bảng: 1.080.000.000 → "1,08 tỷ đ", 92.400.000 → "92,4 triệu đ". */
export function shortMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return `${comma(v / 1e9, 2)} tỷ đ`;
  if (Math.abs(v) >= 1e6) return `${comma(v / 1e6, 1)} triệu đ`;
  return money(v);
}

/** Tỷ lệ sử dụng: null = "Không áp dụng" (cơ sở không có kho khai thác được — docs/operations-api.md). */
export const rateLabel = (rate) => (rate === null || rate === undefined ? "Không áp dụng" : `${Number.isInteger(+rate) ? rate : comma(rate)}%`);

/** Tăng trưởng so với kỳ trước: "+4,8%" / "−2,0%"; kỳ trước bằng 0 thì không so được. */
export function growthLabel(prev, cur) {
  if (!prev) return null;
  const g = ((cur - prev) / prev) * 100;
  return `${g >= 0 ? "+" : "−"}${comma(Math.abs(g))}%`;
}

/** Địa chỉ "…, Quận 7, TP. Hồ Chí Minh" → { district: "Quận 7", city: "TP. Hồ Chí Minh" } (cùng cách với giao diện khách). */
export function areaOf(address = "") {
  const parts = String(address).split(",").map((s) => s.trim()).filter(Boolean);
  return { district: parts.length >= 2 ? parts[parts.length - 2] : "", city: parts[parts.length - 1] || "" };
}

export const shortFacility = (name = "") => name.replace(/^SafeSpace\s+/, "");

export const FACILITY_STATUS = {
  ACTIVE: ["Đang hoạt động", "green"],
  TEMPORARILY_CLOSED: ["Tạm đóng", "amber"],
  INACTIVE: ["Ngừng hoạt động", "gray"],
};

export const POLICY_STATUS = {
  ACTIVE: ["Đang áp dụng", "green"],
  DRAFT: ["Bản nháp", "amber"],
  INACTIVE: ["Đã ngừng", "gray"],
  EXPIRED: ["Hết hiệu lực", "gray"],
};

export const POLICY_TYPES = {
  DEPOSIT: "Đặt cọc",
  RENEWAL: "Gia hạn",
  CANCELLATION: "Huỷ đặt chỗ",
  RETURN: "Trả kho",
  OVERDUE: "Quá hạn",
  EXTRA_FEE: "Phí dịch vụ",
  DISCOUNT: "Giảm giá",
  FEE_WAIVER: "Miễn phí",
  PRICE_RANGE: "Khung giá",
};

// Loại chính sách mà giá trị FIXED là số tiền (đ). Loại khác (gia hạn, trả kho…) là số ngày / giờ ghi trong mô tả.
export const MONEY_TYPES = ["DEPOSIT", "OVERDUE", "EXTRA_FEE", "CANCELLATION", "FEE_WAIVER", "DISCOUNT"];
export const isMoneyFixed = (p) =>
  p?.calculationType === "FIXED" && MONEY_TYPES.includes(p.policyType) && !(p.policyType === "DEPOSIT" && Number(p.value) < 1000);

export const CALC_TYPES = {
  FIXED: "Số tiền cố định",
  PERCENTAGE: "Phần trăm",
  RANGE: "Khoảng giá",
  RULE: "Quy định (mô tả)",
};

/**
 * Giá trị chính sách dạng chữ. Cọc FIXED < 1.000 là số tháng tiền thuê (cách ghi của chính sách seed, D16).
 * @param {object} p PolicyDto
 * @param {string} [unit] đuôi cho số tiền cố định, vd "/ ngày"
 */
export function policyValueLabel(p, unit = "") {
  if (!p) return "—";
  const v = p.value === null || p.value === undefined ? null : Number(p.value);
  const tail = unit ? ` ${unit}` : "";
  switch (p.calculationType) {
    case "PERCENTAGE":
      return v === null ? "—" : `${comma(v, Number.isInteger(v) ? 0 : 1)}%`;
    case "RANGE":
      return `${money(p.minValue ?? 0)} – ${money(p.maxValue ?? 0)}`;
    case "RULE":
      return p.ruleDescription || "—";
    case "FIXED":
      if (v === null) return "—";
      if (p.policyType === "DEPOSIT" && v < 1000) return `${comma(v, Number.isInteger(v) ? 0 : 1)} tháng tiền thuê`;
      if (!MONEY_TYPES.includes(p.policyType)) return comma(v, Number.isInteger(v) ? 0 : 1);
      return `${money(v)}${tail}`;
    default:
      return v === null ? p.ruleDescription || "—" : String(v);
  }
}

/**
 * Chính sách đang có hiệu lực cho một phạm vi: ưu tiên đúng loại kho rồi mới đến toàn hệ thống (BR20, phần dùng ở B03).
 * Chỉ xét chính sách toàn hệ thống về cơ sở (facilityId = null).
 */
export function policyFor(policies, type, unitTypeId = null) {
  const pool = policies.filter((p) => p.policyType === type && p.status === "ACTIVE" && p.facilityId == null
    && (!p.effectiveFrom || p.effectiveFrom <= today()) && (!p.effectiveTo || p.effectiveTo >= today())
    && !(type === "OVERDUE" && p.calculationType === "RULE"));
  return pool.find((p) => p.unitTypeId === unitTypeId) || (unitTypeId != null ? pool.find((p) => p.unitTypeId == null) : null) || null;
}

/** Thân request tạo bản thay thế của một chính sách (giữ phạm vi, đổi giá trị, hiệu lực từ hôm nay). */
export function replacementOf(p, changes, today) {
  return {
    policyName: p.policyName,
    policyType: p.policyType,
    calculationType: p.calculationType,
    value: p.value,
    minValue: p.minValue,
    maxValue: p.maxValue,
    ruleDescription: p.ruleDescription,
    facilityId: p.facilityId ?? null,
    unitTypeId: p.unitTypeId ?? null,
    effectiveFrom: today,
    effectiveTo: null,
    ...changes,
  };
}

/** Kỳ báo cáo của một tháng "yyyy-MM": từ ngày 1 đến cuối tháng (tháng hiện tại thì đến hôm nay). */
export function monthPeriod(month, today) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { from: `${month}-01`, to: end > today ? today : end };
}

/** 12 tháng gần nhất, mới nhất trước: [{ value: "2026-10", label: "Tháng 10/2026" }]. */
export function recentMonths(today, count = 12) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const mm = d.getUTCMonth() + 1;
    return { value: `${d.getUTCFullYear()}-${String(mm).padStart(2, "0")}`, label: `Tháng ${mm}/${d.getUTCFullYear()}` };
  });
}

/** Giá thuê hợp lệ: số nguyên dương, bội số 1.000 đ (docs/operations-api.md mục 3). */
export function rateError(value) {
  const n = Number(String(value).replace(/[.\sđ₫]/g, ""));
  if (!String(value).trim()) return "Nhập giá mới.";
  if (!Number.isFinite(n) || n <= 0) return "Giá phải lớn hơn 0.";
  if (n % 1000 !== 0) return "Giá là bội số của 1.000 đ.";
  return null;
}
export const parseMoney = (value) => Number(String(value).replace(/[.\sđ₫]/g, ""));

export const CONTRACT_STATUS_LABELS = {
  DRAFT: "Chờ bàn giao",
  ACTIVE: "Đang thuê",
  EXPIRING: "Sắp hết hạn",
  OVERDUE: "Quá hạn",
  RETURN_PENDING: "Chờ trả kho",
  COMPLETED: "Đã kết thúc",
  TERMINATED: "Chấm dứt",
  CANCELLED: "Đã huỷ",
};
export const RESERVATION_STATUS_LABELS = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PENDING_VERIFICATION: "Chờ thu tại kho",
  CONFIRMED: "Đã xác nhận, chờ phân bổ",
  UNIT_ASSIGNED: "Đã phân bổ ô",
  CHECKED_IN: "Đã nhận kho",
  CANCELLED: "Đã huỷ",
  EXPIRED: "Hết hạn giữ chỗ",
  NO_SHOW: "Không đến nhận",
};
export const UNIT_STATUS_LABELS = {
  AVAILABLE: "Trống",
  RESERVED: "Đã giữ cho khách",
  ASSIGNED: "Đã phân bổ",
  OCCUPIED: "Đang thuê",
  RETURN_PENDING: "Chờ trả kho",
  INSPECTION: "Chờ kiểm tra",
  MAINTENANCE: "Bảo trì",
  OUT_OF_SERVICE: "Ngừng sử dụng",
};
