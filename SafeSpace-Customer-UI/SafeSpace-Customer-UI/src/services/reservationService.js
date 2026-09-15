import { api } from "./apiClient";

export const reservationService = {
  async getMyReservations() {
    return await api.get("/api/reservations");
  },

  async getReservation(id) {
    return await api.get(`/api/reservations/${id}`);
  },

  async createReservation({ facilityId, unitTypeId, startDate, rentalPeriodMonths }) {
    return await api.post("/api/reservations", {
      facilityId: Number(facilityId),
      unitTypeId: Number(unitTypeId),
      startDate,
      rentalPeriodMonths: Number(rentalPeriodMonths),
    });
  },

  async cancelReservation(id, reason) {
    return await api.post(`/api/reservations/${id}/cancel`, {
      reason: reason || "Khách hàng yêu cầu hủy đơn.",
    });
  },
};
