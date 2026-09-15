import { api } from "./apiClient";

export const facilityService = {
  async getFacilities() {
    return await api.get("/api/facilities");
  },

  async getFacility(id) {
    return await api.get(`/api/facilities/${id}`);
  },

  async getUnitTypes() {
    return await api.get("/api/unit-types");
  },

  async getUnitType(id) {
    return await api.get(`/api/unit-types/${id}`);
  },

  async getRates(facilityId = null, unitTypeId = null) {
    const params = {};
    if (facilityId) params.facilityId = facilityId;
    if (unitTypeId) params.unitTypeId = unitTypeId;
    return await api.get("/api/rates", params);
  },

  async checkAvailability({ facilityId, unitTypeId, startDate, rentalPeriodMonths }) {
    return await api.post("/api/availability/check", {
      facilityId: Number(facilityId),
      unitTypeId: Number(unitTypeId),
      startDate,
      rentalPeriodMonths: Number(rentalPeriodMonths),
    });
  },
};
