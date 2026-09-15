import { api } from "./apiClient";

export const supportService = {
  async getMyTickets() {
    return await api.get("/api/tickets");
  },

  async getTicket(id) {
    return await api.get(`/api/tickets/${id}`);
  },

  async createTicket({ contractId, unitId = null, issueType, title, description, priority = "NORMAL" }) {
    return await api.post("/api/tickets", {
      contractId: Number(contractId),
      unitId: unitId ? Number(unitId) : null,
      issueType,
      title,
      description,
      priority,
    });
  },

  async cancelTicket(id) {
    return await api.post(`/api/tickets/${id}/cancel`, {});
  },
};
