import { api } from "./apiClient";

export const appointmentService = {
  async getMyAppointments() {
    return await api.get("/api/appointments");
  },
};
