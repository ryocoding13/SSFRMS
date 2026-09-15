import { api } from "./apiClient";

export const contractService = {
  async getMyContracts() {
    return await api.get("/api/contracts");
  },

  async getContract(id) {
    return await api.get(`/api/contracts/${id}`);
  },

  async confirmHandover(handoverId) {
    return await api.post(`/api/handovers/${handoverId}/confirm`, {});
  },
};
