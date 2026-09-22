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

  // Hợp đồng, thanh toán, gia hạn, bàn giao
  contracts: () => request("/api/contracts"),
  contract: (id) => request(`/api/contracts/${id}`),
  requestRenewal: (contractId, months) =>
    request(`/api/contracts/${contractId}/renewals`, { method: "POST", body: { renewalPeriodMonths: months } }),
  confirmHandover: (handoverId) => request(`/api/handovers/${handoverId}/confirm`, { method: "POST" }),

  // Hỗ trợ
  tickets: () => request("/api/tickets"),
  ticket: (id) => request(`/api/tickets/${id}`),
  createTicket: (body) => request("/api/tickets", { method: "POST", body }),
  cancelTicket: (id) => request(`/api/tickets/${id}/cancel`, { method: "POST" }),
};
