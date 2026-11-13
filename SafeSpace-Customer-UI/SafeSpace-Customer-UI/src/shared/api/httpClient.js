/**
 * HTTP CLIENT - FETCH CLIENT KẾT NỐI BACKEND API SAFESPACE
 *
 * Tính năng chính:
 * - Tự động đính kèm JWT Bearer Token từ localStorage vào Header Authorization.
 * - Xử lý chuyển đổi JSON request/response tự động.
 * - Chuẩn hóa lớp lỗi ApiError (bắt mã HTTP status, thông điệp lỗi và chi tiết từ server).
 */
import { API_URL } from "../../app/config/api.js";

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

/**
 * Gửi yêu cầu HTTP đến máy chủ backend với cấu hình xác thực tự động.
 * @param {string} path - Đường dẫn endpoint API (ví dụ '/api/contracts')
 * @param {RequestInit & { auth?: boolean, body?: any }} [options] - Cấu hình request
 * @returns {Promise<any>} Dữ liệu JSON phản hồi
 */
export async function request(path, { method = "GET", body, auth = true, responseType = "json", fetchImpl = globalThis.fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: responseType === "json" ? "application/json" : "text/html",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(DEFAULT_MESSAGES[0], 0);
  }
  if (res.ok && responseType === "blob") {
    if (!res.headers.get("content-disposition")?.toLowerCase().startsWith("attachment")) {
      throw new ApiError("Máy chủ chưa trả về tệp hợp đồng.", res.status);
    }
    return res.blob();
  }
  const text = await res.text();
  // Hợp đồng giấy hiển thị trong trang: nhận HTML nguyên văn
  if (res.ok && responseType === "html") return text;
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
