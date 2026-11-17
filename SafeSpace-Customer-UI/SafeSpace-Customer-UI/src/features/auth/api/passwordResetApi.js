/**
 * PASSWORD RESET API - GỌI API ĐẶT LẠI MẬT KHẨU BẰNG MÃ XÁC NHẬN EMAIL (F43 / UC08)
 *
 * Kết nối với backend:
 * - POST /api/auth/password-reset/request: Gửi mã OTP 6 chữ số vào email tài khoản (cooldown 60s, hiệu lực 10 phút).
 * - POST /api/auth/password-reset/confirm: Xác nhận mã OTP và thiết lập mật khẩu mới, hủy phiên cũ.
 */
import { request } from "../../../shared/api/httpClient.js";

async function call(path, body, unavailable) {
  try { return await request(path, { method: "POST", body, auth: false }); }
  catch (error) {
    if (error.status === 405 || (error.status === 404 && !error.data?.code && !error.data?.error)) {
      throw new Error(unavailable);
    }
    throw error;
  }
}
export const passwordResetApi = {
  request: email => call("/api/auth/password-reset/request", { email }, "Chưa gửi được mã đặt lại mật khẩu. Vui lòng thử lại sau hoặc gọi hotline."),
  confirm: body => call("/api/auth/password-reset/confirm", body, "Chưa đặt lại được mật khẩu. Vui lòng thử lại sau hoặc gọi hotline."),
};
