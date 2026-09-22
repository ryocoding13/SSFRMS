import { api } from "./apiClient";

export const paymentService = {
  async createPayment({
    reservationId = null,
    contractId = null,
    amount,
    paymentMethod,
    transactionReference = null,
  }) {
    return await api.post("/api/payments", {
      reservationId,
      contractId,
      amount: Number(amount),
      paymentMethod,
      transactionReference: transactionReference || null,
    });
  },

  async getContractPayments(contractId) {
    return await api.get(`/api/contracts/${contractId}/payments`);
  },

  async getPayment(paymentId) {
    return await api.get(`/api/payments/${paymentId}`);
  },
};
