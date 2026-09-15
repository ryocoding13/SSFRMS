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
