import React, { useEffect, useState } from "react";
import { Button, Field } from "../../shared/components/UI.jsx";
import { go, href } from "../../app/router.js";
import { homeFor, isOpsRoles, isBusinessRoles } from "../../shared/utils/roles.js";
import { useApp } from "../../app/state/AppProvider.jsx";
import { safeNext } from "./utils/safeNext.js";
import { ForgotPassword } from "./components/ForgotPasswordDialog.jsx";

export function LoginPage({ query }) {
  const { login, authed, isAdmin, roles } = useApp();
  const next = safeNext(query.get("next"));
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authed) go(isAdmin || isOpsRoles(roles) || isBusinessRoles(roles) ? homeFor(roles) : next, { replace: true });
  }, [authed, isAdmin, roles, next]);

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
    const home = homeFor(res.roles || []);
    go(home === "overview" ? next : next.startsWith(home) ? next : home);
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
