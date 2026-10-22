import React, { useEffect, useState } from "react";
import { Button, Field, Icon } from "../../shared/components/UI.jsx";
import { go, href } from "../../app/router.js";
import { useApp } from "../../app/state/AppProvider.jsx";
import { safeNext } from "./utils/safeNext.js";

export function RegisterPage({ query }) {
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
