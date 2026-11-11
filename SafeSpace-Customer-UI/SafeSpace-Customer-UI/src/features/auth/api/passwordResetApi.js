/**
 * PASSWORD RESET API - GỌI API ĐẶT LẠI MẬT KHẨU BẰNG MÃ XÁC NHẬN EMAIL (F43 / UC08)
 *
 * Kết nối với backend:
 * - POST /api/auth/password-reset/request: Gửi mã OTP 6 chữ số vào email tài khoản (cooldown 60s, hiệu lực 10 phút).
 * - POST /api/auth/password-reset/confirm: Xác nhận mã OTP và thiết lập mật khẩu mới, hủy phiên cũ.
 */
import { request } from "../../../shared/api/httpClient.js";

async function call(path, body) {
  try { return await request(path, { method: "POST", body, auth: false }); }
  catch (error) { if ([404, 405].includes(error.status)) throw new Error("Chức năng đặt lại mật khẩu bằng mã chưa được hỗ trợ. Vui lòng liên hệ quản trị viên hoặc nhân viên cơ sở."); throw error; }
}
export const passwordResetApi = {
  request: email => call("/api/auth/password-reset/request", { email }),
  confirm: body => call("/api/auth/password-reset/confirm", body),
};
