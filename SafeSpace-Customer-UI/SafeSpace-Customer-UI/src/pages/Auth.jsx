import React, { useEffect, useState } from "react";
import { Button, Field, Icon, Modal } from "../components/UI";
import { go, href } from "../lib/router";
import { isEmail } from "../lib/format";
import { useApp } from "../state/store";

const safeNext = (next) => (next && !/^(login|register)/.test(next) ? next : "overview");

function ForgotPassword({ onClose }) {
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

export function Login({ query }) {
  const { login, authed } = useApp();
  const next = safeNext(query.get("next"));
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authed) go(next, { replace: true });
  }, [authed, next]);

  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors({});
  };
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.identifier.trim()) err.identifier = "Vui lòng nhập tên đăng nhập hoặc email.";
    if (!form.password) err.password = "Vui lòng nhập mật khẩu.";
    if (Object.keys(err).length) return setErrors(err);
    setBusy(true);
    const res = await login(form);
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    go(next);
  };

  return (
    <main className="auth">
      <form className="panel auth__card" onSubmit={submit} noValidate>
        <h1>Đăng nhập</h1>
        <p className="lead">Dành cho khách hàng đã có tài khoản và nhân viên được cấp quyền.</p>
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <Field label="Tên đăng nhập hoặc Email" error={errors.identifier}>
          <input autoComplete="username" placeholder="Nhập tên đăng nhập hoặc email" value={form.identifier} onChange={(e) => set("identifier", e.target.value)} />
        </Field>
        <Field label="Mật khẩu" error={errors.password}>
          <input type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <button type="button" className="link-btn auth__forgot" onClick={() => setForgot(true)}>Quên mật khẩu?</button>
        <Button type="submit" block disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
        <p className="auth__note">
          Nhân viên: nhập đúng tên đăng nhập và mật khẩu được cấp trước để vào đúng giao diện vai trò của bạn — Nhân viên cơ sở, Quản lý cơ sở, Vận hành, hoặc Quản trị hệ thống.
        </p>
        <p className="auth__switch">
          Chưa có tài khoản? <a href={href("register")}>Đăng ký</a>
        </p>
      </form>
      {forgot && <ForgotPassword onClose={() => setForgot(false)} />}
    </main>
  );
}

export function Register({ query }) {
  const { register, authed } = useApp();
  const next = safeNext(query.get("next"));
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authed) go(next, { replace: true });
  }, [authed, next]);

  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors((p) => ({ ...p, [k]: undefined, form: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await register(form);
    setBusy(false);
    if (!res.ok) return setErrors(res.errors);
    go(next);
  };

  return (
    <main className="auth">
      <form className="panel auth__card" onSubmit={submit} noValidate>
        <h1>Tạo tài khoản khách hàng</h1>
        <p className="lead">Điền thông tin bên dưới để bắt đầu thuê kho cùng SafeSpace.</p>
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <Field label="Họ và tên" error={errors.name}>
          <input autoComplete="name" placeholder="Nhập họ và tên của bạn" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" placeholder="ban@vidu.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Số điện thoại" error={errors.phone}>
          <input type="tel" autoComplete="tel" placeholder="09xx xxx xxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Mật khẩu" error={errors.password}>
          <input type="password" autoComplete="new-password" placeholder="Tạo mật khẩu" value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <Field label="Xác nhận mật khẩu" error={errors.confirm}>
          <input type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
        </Field>
        <Button type="submit" block disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</Button>
        <p className="auth__role">
          <Icon name="check" size={14} /> Tài khoản mới sẽ tự động vào vai trò Khách hàng.
        </p>
        <p className="auth__switch">
          Đã có tài khoản? <a href={href("login")}>Đăng nhập</a>
        </p>
      </form>
    </main>
  );
}
