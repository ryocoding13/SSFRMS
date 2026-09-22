const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5151";

const TOKEN_KEY = "safespace_auth_token";
const USER_KEY = "safespace_auth_user";

let onUnauthorizedCallback = null;

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  onUnauthorized: (cb) => {
    onUnauthorizedCallback = cb;
  },
};

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const token = authStorage.getToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const res = await fetch(url, config);

    if (res.status === 401) {
      authStorage.clear();
      if (typeof onUnauthorizedCallback === "function") {
        onUnauthorizedCallback();
      }
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    // Attempt to parse JSON response
    let data = null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { text } : null;
    }

    if (!res.ok) {
      const errorMessage =
        data?.error || data?.message || `Lỗi yêu cầu (${res.status}): ${res.statusText}`;
      const err = new Error(errorMessage);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(
        `Không thể kết nối đến máy chủ API (${BASE_URL}). Vui lòng kiểm tra backend đã chạy.`
      );
    }
    throw err;
  }
}

export const api = {
  get: (endpoint, params = null) => {
    let url = endpoint;
    if (params) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          qs.append(k, v);
        }
      });
      const qsStr = qs.toString();
      if (qsStr) url += (url.includes("?") ? "&" : "?") + qsStr;
    }
    return request(url, { method: "GET" });
  },
  post: (endpoint, body) =>
    request(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: (endpoint, body) =>
    request(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (endpoint) =>
    request(endpoint, {
      method: "DELETE",
    }),
};
