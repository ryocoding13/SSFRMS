import React, { useState } from "react";
import { Button, Field, Modal } from "../../../shared/components/UI.jsx";
import { isEmail } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

export function ForgotPassword({ onClose }) {
  const { supports } = useApp();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!isEmail(email)) return setError("Nhập email hợp lệ để nhận hướng dẫn.");
    setSent(true);
  };
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
