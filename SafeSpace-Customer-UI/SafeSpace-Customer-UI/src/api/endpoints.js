// Toàn bộ endpoint backend mà giao diện khách hàng dùng (StorageProject.Api/Endpoints).
import { request } from "./http.js";

export const api = {
  // Auth
  login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password }, auth: false }),
  register: (body) => request("/api/auth/register", { method: "POST", body, auth: false }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  // Cơ sở, loại kho, bảng giá (công khai)
  facilities: () => request("/api/facilities", { auth: false }),
  unitTypes: () => request("/api/unit-types", { auth: false }),
  rates: () => request("/api/rates", { auth: false }),
  availability: (body) => request("/api/availability/check", { method: "POST", body, auth: false }),

  // Đặt chỗ
  reservations: () => request("/api/reservations"),
  reservation: (id) => request(`/api/reservations/${id}`),
  createReservation: (body) => request("/api/reservations", { method: "POST", body }),
  cancelReservation: (id, reason) => request(`/api/reservations/${id}/cancel`, { method: "POST", body: { reason } }),
  // Bản cũ "Tôi đã chuyển khoản" → PENDING_VERIFICATION. Giờ chỉ dùng làm dự phòng cho "Thanh toán tại cửa hàng"
  // khi backend chưa có pay-at-facility (đơn vẫn vào hàng chờ S09 để nhân viên thu tiền).
  confirmTransfer: (id) => request(`/api/reservations/${id}/confirm-transfer`, { method: "POST" }),
  // C04 · PayOS: tạo / lấy lại link + mã QR PayOS của đơn qua endpoint backend đang có
  // (POST /api/reservations/create-payos-qr → { reservationId, orderCode, checkoutUrl, qrCode, amount }).
  reservationPayos: (id) => request("/api/reservations/create-payos-qr", { method: "POST", body: { reservationId: Number(id) } }),
  // C04c · Khách chọn thanh toán tại cửa hàng → chờ nhân viên thu tiền ở S09
  payAtFacility: (id) => request(`/api/reservations/${id}/pay-at-facility`, { method: "POST" }),
  // C14a · Xem trước số tiền hoàn khi huỷ đơn đã thanh toán (chính sách CANCELLATION ở B02)
  cancelPreview: (id) => request(`/api/reservations/${id}/cancel-preview`),

  // Hợp đồng, thanh toán, gia hạn, bàn giao, trả kho
  contracts: () => request("/api/contracts"),
  contract: (id) => request(`/api/contracts/${id}`),
  requestRenewal: (contractId, months) =>
    request(`/api/contracts/${contractId}/renewals`, { method: "POST", body: { renewalPeriodMonths: months } }),
  confirmHandover: (handoverId) => request(`/api/handovers/${handoverId}/confirm`, { method: "POST" }),
  requestMoveOut: (contractId, body) => request(`/api/contracts/${contractId}/move-out`, { method: "POST", body }),

  // Tài khoản & hồ sơ
  getProfile: () => request("/api/auth/profile"),
  updateProfile: (body) => request("/api/auth/profile", { method: "PUT", body }),
  changePassword: (body) => request("/api/auth/change-password", { method: "POST", body }),
  // C11 · Khoản gia hạn đã duyệt: tạo QR PayOS cho khoản thanh toán, hỏi trạng thái bằng GET /api/payments/{id}
  payment: (paymentId) => request(`/api/payments/${paymentId}`),
  paymentPayos: (paymentId) => request(`/api/payments/${paymentId}/payos`, { method: "POST" }),

  // C07q · QR mở cửa (chỉ chủ hợp đồng, hợp đồng đã bàn giao và còn hiệu lực)
  accessQr: (contractId) => request(`/api/contracts/${contractId}/access-qr`),
  // C07r · Máy quét ở cửa kho (mô phỏng): kiểm mã → OPEN / DENIED, backend ghi activity_logs
  scanAccess: (arg) => request("/api/access/scan", { method: "POST", body: typeof arg === "string" ? { code: arg } : arg, auth: false }),

  // Hỗ trợ
  tickets: () => request("/api/tickets"),
  ticket: (id) => request(`/api/tickets/${id}`),
  createTicket: (body) => request("/api/tickets", { method: "POST", body }),
  cancelTicket: (id) => request(`/api/tickets/${id}/cancel`, { method: "POST" }),

  // payOS VietQR Integration
  createPayOSQr: (body) => request("/api/v1/reservations/create-payos-qr", { method: "POST", body }),
  reservationStatus: (id) => request(`/api/v1/reservations/${id}/status`, { auth: false }),
};
