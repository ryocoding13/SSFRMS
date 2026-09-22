import { api } from "./apiClient";

export const renewalService = {
  async getContractRenewals(contractId) {
    return await api.get(`/api/contracts/${contractId}/renewals`);
  },

  async requestRenewal(contractId, renewalPeriodMonths) {
    return await api.post(`/api/contracts/${contractId}/renewals`, {
      renewalPeriodMonths: Number(renewalPeriodMonths),
    });
  },
};
