import React, { useState } from "react";
import { Button, Field, Modal } from "../../../shared/components/UI.jsx";
import { isEmail } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

export function ForgotPassword({ onClose }) {
  // Kiểm tra ứng dụng có hỗ trợ chức năng quên mật khẩu hay không.
  // Nếu chưa hỗ trợ thì hướng dẫn người dùng liên hệ nhân viên.
  const { supports } = useApp();

  // Lưu email người dùng đang nhập.
  const [email, setEmail] = useState("");

  // Thông báo lỗi hiện bên dưới ô email.
  const [error, setError] = useState("");

  // Khi sent = true, ẩn form và hiện thông báo hướng dẫn.
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    // Giữ nguyên trang hiện tại khi người dùng gửi form.
    e.preventDefault();

    // Email sai định dạng thì báo lỗi và dừng tại đây.
    if (!isEmail(email)) return setError("Nhập email hợp lệ để nhận hướng dẫn.");

    // Hiện tại chỉ đổi trạng thái giao diện, chưa gọi API gửi email.
    // Vì vậy, thấy thông báo thành công chưa có nghĩa email đã được gửi.
    setSent(true);
  };

  // Hộp thoại hiển thị theo 3 trường hợp:
  // 1. Chưa hỗ trợ quên mật khẩu: hướng dẫn liên hệ nhân viên.
  // 2. Đã gửi form hợp lệ: hiện thông báo hướng dẫn đặt lại mật khẩu.
  // 3. Còn lại: hiện form nhập email.
  //
  // onClose được truyền từ component cha để đóng hộp thoại.
  // Form dùng noValidate để tự kiểm tra email bằng isEmail ở trên.
  // Khi người dùng sửa email, onChange cập nhật giá trị và xóa lỗi cũ.
  return (
    <Modal title="Quên mật khẩu?" onClose={onClose}>
      {!supports.forgotPassword ? (
        <>
          <p className="modal__text">Vui lòng liên hệ quản trị viên hoặc nhân viên cơ sở SafeSpace để được đặt lại mật khẩu.</p>
          <Button onClick={onClose}>Đã hiểu</Button>
        </>
      ) : sent ? (
        <>
          <p className="modal__text">Nếu email đã đăng ký, SafeSpace sẽ gửi hướng dẫn đặt lại mật khẩu trong ít phút.</p>
          <Button onClick={onClose}>Đã hiểu</Button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="modal__text">Nhập email đã đăng ký. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.</p>
          <Field label="Email" error={error}>
            <input type="email" autoComplete="email" placeholder="ban@vidu.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
          </Field>
          <div className="modal__actions">
            <Button type="submit">Gửi hướng dẫn</Button>
            <Button variant="outline" onClick={onClose}>Đóng</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
