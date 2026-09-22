import React, { useState } from "react";
import { Button, Dialog, Field, PageHeader } from "../components/UI";
import { go } from "../lib/router";
import { maskPhone } from "../lib/format";
import { useApp } from "../state/store";

export default function Profile() {
  const { data, dispatch, logout } = useApp();
  const { user } = data;
  const [name, setName] = useState(user.full_name);
  const [nameError, setNameError] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [dialog, setDialog] = useState(null);

  const saveName = (e) => {
    e.preventDefault();
    const res = dispatch("UPDATE_NAME", { name });
    if (!res.ok) return setNameError(res.error);
    setName(res.name);
    setDialog({ title: "Đã lưu tên", message: "Tên hiển thị của bạn đã được cập nhật." });
  };

  const setPwField = (k, v) => {
    setPw({ ...pw, [k]: v });
    setPwErrors({});
  };
  const changePassword = (e) => {
    e.preventDefault();
    const err = {};
    if (!pw.current) err.current = "Vui lòng nhập mật khẩu hiện tại.";
    if (!pw.next) err.next = "Vui lòng nhập mật khẩu mới.";
    else if (pw.next.length < 8) err.next = "Mật khẩu mới cần ít nhất 8 ký tự.";
    else if (pw.next === pw.current) err.next = "Mật khẩu mới cần khác mật khẩu hiện tại.";
    if (!pw.confirm) err.confirm = "Vui lòng nhập lại mật khẩu mới.";
    else if (pw.next && pw.confirm !== pw.next) {
      err.confirm = "Mật khẩu xác nhận chưa khớp";
      err.confirmHint = "Nhập lại đúng mật khẩu mới để tiếp tục.";
    }
    if (Object.keys(err).length) return setPwErrors(err);
    const res = dispatch("CHANGE_PASSWORD", { current: pw.current, next: pw.next });
    if (!res.ok) return setPwErrors(res.code === "BAD_PASSWORD" ? { current: res.error } : { next: res.error });
    setPw({ current: "", next: "", confirm: "" });
    setDialog({ title: "Đổi mật khẩu thành công", message: "Mật khẩu mới của bạn đã được cập nhật." });
  };

  return (
    <main className="container page">
      <PageHeader title="Tài khoản của tôi" description="Quản lý tên hiển thị, thông tin liên hệ và mật khẩu đăng nhập." />
      <div className="grid grid--2">
        <form className="panel form-card" onSubmit={saveName} noValidate>
          <h2>Thông tin cá nhân</h2>
          <Field label="Tên tài khoản (hiển thị)" error={nameError}>
            <input autoComplete="name" maxLength={100} value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} />
          </Field>
          <Field label="Email">
            <input readOnly value={user.email} />
          </Field>
          <Field label="Số điện thoại">
            <input readOnly value={maskPhone(user.phone)} />
          </Field>
          <h3>Thông báo</h3>
          <p className="muted">Nhận nhắc lịch hẹn, hạn hợp đồng và cập nhật thanh toán trong ứng dụng.</p>
          <Button type="submit">Lưu tên tài khoản</Button>
        </form>

        <form className="panel form-card" onSubmit={changePassword} noValidate>
          <h2>Đổi mật khẩu</h2>
          <Field label="Mật khẩu hiện tại" error={pwErrors.current}>
            <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPwField("current", e.target.value)} />
          </Field>
          <Field label="Mật khẩu mới" error={pwErrors.next}>
            <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPwField("next", e.target.value)} />
          </Field>
          <Field label="Xác nhận mật khẩu mới" error={pwErrors.confirm}>
            <input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPwField("confirm", e.target.value)} />
          </Field>
          {pwErrors.confirmHint && <p className="field__error field__error--plain">{pwErrors.confirmHint}</p>}
          <Button type="submit">Cập nhật mật khẩu</Button>
        </form>
      </div>
      <Button
        variant="outline"
        className="logout"
        onClick={() => {
          logout();
          go("home");
        }}
      >
        Đăng xuất
      </Button>
      {dialog && <Dialog {...dialog} onClose={() => setDialog(null)} />}
    </main>
  );
}
