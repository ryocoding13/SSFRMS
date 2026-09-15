import { api } from "./apiClient";

export const paymentService = {
  async getContractPayments(contractId) {
    return await api.get(`/api/contracts/${contractId}/payments`);
  },

  async getPayment(paymentId) {
    return await api.get(`/api/payments/${paymentId}`);
  },
};
