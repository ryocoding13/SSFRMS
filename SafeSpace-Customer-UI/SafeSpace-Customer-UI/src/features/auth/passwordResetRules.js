/** Quên mật khẩu 3 bước (Figma QMK · 13/11): kiểm tra dữ liệu từng bước. */
import { isEmail } from "../../shared/utils/format.js";

/** Che email: mai.nguyen@gmail.com → m***@gmail.com */
export function maskEmail(email) {
  const [name, domain] = String(email || "").trim().split("@");
  if (!name || !domain) return email;
  return `${name[0]}***@${domain}`;
}

/** Kiểm tra email bước 1: trống và sai định dạng là hai lỗi khác nhau. */
export function emailError(value) {
  const v = String(value || "").trim();
  if (!v) return "Vui lòng nhập email.";
  if (!isEmail(v)) return "Email chưa đúng định dạng, ví dụ: ten@gmail.com.";
  return "";
}

/** Kiểm tra bước 3. */
export function passwordErrors(password, confirm) {
  const errors = {};
  if (!password) errors.password = "Vui lòng nhập mật khẩu mới.";
  else if (password.length < 8) errors.password = "Mật khẩu cần tối thiểu 8 ký tự.";
  else if (new TextEncoder().encode(password).length > 72) errors.password = "Mật khẩu quá dài, vui lòng dùng mật khẩu ngắn hơn.";
  if (!confirm) errors.confirm = "Vui lòng nhập lại mật khẩu mới.";
  else if (password && confirm !== password) errors.confirm = "Mật khẩu nhập lại chưa khớp.";
  return errors;
}

