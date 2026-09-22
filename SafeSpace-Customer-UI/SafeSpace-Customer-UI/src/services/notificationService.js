import { api } from "./apiClient";

export const notificationService = {
  async getMyNotifications() {
    return await api.get("/api/notifications");
  },
};
