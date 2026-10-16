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
  // C04: khách báo đã chuyển khoản → PENDING_VERIFICATION (nhân viên đối soát ở S09)
  confirmTransfer: (id) => request(`/api/reservations/${id}/confirm-transfer`, { method: "POST" }),

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

  // Hỗ trợ
  tickets: () => request("/api/tickets"),
  ticket: (id) => request(`/api/tickets/${id}`),
  createTicket: (body) => request("/api/tickets", { method: "POST", body }),
  cancelTicket: (id) => request(`/api/tickets/${id}/cancel`, { method: "POST" }),

  // payOS VietQR Integration
  createPayOSQr: (body) => request("/api/v1/reservations/create-payos-qr", { method: "POST", body }),
  reservationStatus: (id) => request(`/api/v1/reservations/${id}/status`, { auth: false }),
};
