// Chuẩn hoá dữ liệu backend cho các màn mới: PayOS (C04, C11q), QR mở cửa (C07q), máy quét cửa kho (C07r),
// xem trước hoàn tiền khi huỷ (C14a). Hàm thuần, có test (tests/payment-access.test.js).
// Hợp đồng JSON đầy đủ ở BACKEND-TODO.md mục P (PayOS), Q (QR mở cửa), H (huỷ đơn).
import { ApiError } from "./http.js";
import { parseUtc } from "./mappers.js";

// Backend chưa có endpoint (bản cũ) → giao diện hiện thông báo thay vì báo lỗi
export const isUnsupported = (e) => e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501);

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const iso = (v) => parseUtc(v)?.toISOString() ?? null;

// PayosCheckoutDto: { orderCode, amount, qrCode, checkoutUrl, expiredAt, description, status }
// qrCode là chuỗi VietQR PayOS trả về (vẽ thành ảnh QR ở giao diện), checkoutUrl là trang thanh toán của PayOS.
export function normPayos(dto) {
  if (!dto || typeof dto !== "object") return null;
  const qr = dto.qrCode ?? dto.qr_code ?? null;
  const url = dto.checkoutUrl ?? dto.checkout_url ?? null;
  if (!qr && !url) return null;
  const status = String(dto.status || "PENDING").toUpperCase();
  return {
    order_code: dto.orderCode ?? dto.order_code ?? null,
    amount: num(dto.amount),
    qr,
    url,
    expires_at: iso(dto.expiredAt ?? dto.expiresAt ?? null),
    description: dto.description || null,
    paid: status === "PAID",
    status,
  };
}

// AccessQrDto: { code, backupCode, unitNumber, unitType, location, validUntil, contractId }
export function normAccess(dto) {
  if (!dto?.code) return null;
  return {
    code: String(dto.code),
    backup: dto.backupCode ? String(dto.backupCode) : null,
    unit: dto.unitNumber || null,
    unit_type: dto.unitType || null,
    location: dto.location || null,
    valid_until: dto.validUntil ? String(dto.validUntil).slice(0, 10) : null,
  };
}

// ScanResultDto: { result: "OPEN" | "DENIED", unitNumber, customerName, contractCode, scannedAt, reason }
export function normScan(dto) {
  const result = String(dto?.result || "").toUpperCase() === "OPEN" ? "OPEN" : "DENIED";
  return {
    result,
    unit: dto?.unitNumber || null,
    customer: dto?.customerName || null,
    contract: dto?.contractCode || null,
    at: iso(dto?.scannedAt) || new Date().toISOString(),
    reason: dto?.reason || (result === "OPEN" ? null : "Mã không hợp lệ hoặc đã hết hiệu lực."),
  };
}

// CancelPreviewDto: { paidAmount, cancellationFee, refundAmount, policyName }
export function normCancelPreview(dto) {
  if (!dto) return null;
  const paid = num(dto.paidAmount);
  const fee = num(dto.cancellationFee);
  const refund = num(dto.refundAmount);
  if (paid === null && refund === null) return null;
  return { paid: paid ?? 0, fee: fee ?? Math.max(0, (paid ?? 0) - (refund ?? 0)), refund: refund ?? Math.max(0, (paid ?? 0) - (fee ?? 0)), policy: dto.policyName || null };
}

// Link chỉ đường Google Maps theo toạ độ (ưu tiên) hoặc địa chỉ
export function directionsUrl({ lat, lng, address, name } = {}) {
  const hasCoords = lat != null && lng != null && lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const dest = hasCoords ? `${Number(lat)},${Number(lng)}` : [name, address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

// Mã QR mở cửa khi chạy không có backend (chế độ trình duyệt): mã tham chiếu cố định theo hợp đồng, không chứa bí mật
export function localAccessCode(contract) {
  const digits = [...String(contract.contract_id)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 100000000, 7);
  const backup = String(digits).padStart(8, "0");
  return {
    code: `SSQR-${String(contract.contract_id).replace(/[^A-Za-z0-9]/g, "")}-${backup.slice(0, 4)}`,
    backup: `${backup.slice(0, 4)} ${backup.slice(4)}`,
    unit: contract.unit_number,
    unit_type: null,
    location: contract.location || null,
    valid_until: contract.end_date,
  };
}
