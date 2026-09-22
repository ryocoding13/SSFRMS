import { API_URL } from "../config/api.js";

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let token = null;
export const setToken = (t) => {
  token = t || null;
};

const DEFAULT_MESSAGES = {
  0: "Không kết nối được máy chủ. Vui lòng kiểm tra backend đang chạy.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Tài khoản không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu.",
  500: "Máy chủ gặp lỗi. Vui lòng thử lại sau.",
};

// Lấy câu báo lỗi từ phản hồi ASP.NET: { error } | { message } | ProblemDetails { title, errors }
function messageOf(data, status) {
  if (data && typeof data === "object") {
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (data.errors) {
      const first = Object.values(data.errors).flat()[0];
      if (first) return first;
    }
    if (data.title && status !== 401) return data.title;
  }
  if (typeof data === "string" && data && data.length < 300 && !data.startsWith("<")) return data;
  return DEFAULT_MESSAGES[status] || (status >= 500 ? DEFAULT_MESSAGES[500] : `Yêu cầu không thành công (mã ${status}).`);
}

export async function request(path, { method = "GET", body, auth = true, fetchImpl = globalThis.fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(DEFAULT_MESSAGES[0], 0);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(messageOf(data, res.status), res.status, data);
  return data;
}
