import { api, authStorage } from "./apiClient";

export const authService = {
  async login(username, password) {
    const data = await api.post("/api/auth/login", { username, password });
    if (data?.token) {
      authStorage.setToken(data.token);
      authStorage.setUser(data.user);
    }
    return data;
  },

  async register({ username, email, password, fullName, phone }) {
    const data = await api.post("/api/auth/register", {
      username,
      email,
      password,
      fullName,
      phone: phone || null,
    });
    if (data?.token) {
      authStorage.setToken(data.token);
      authStorage.setUser(data.user);
    }
    return data;
  },

  async logout() {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Even if network fails, proceed with local logout
    } finally {
      authStorage.clear();
    }
  },

  async getProfile() {
    return await api.get("/api/auth/profile");
  },

  async updateProfile({ fullName, email, phone }) {
    return await api.put("/api/auth/profile", {
      fullName,
      email,
      phone: phone || null,
    });
  },

  async changePassword({ currentPassword, newPassword }) {
    return await api.post("/api/auth/change-password", {
      currentPassword,
      newPassword,
    });
  },

  getCurrentUser() {
    return authStorage.getUser();
  },

  getToken() {
    return authStorage.getToken();
  },

  isAuthenticated() {
    return !!authStorage.getToken();
  },
};
