import React, { useState } from "react";
import { adminApi } from "../api/admin";
import { Select } from "../components/Pickers";
import { Button, Field, Modal, Notice } from "../components/UI";
import { isEmail, isPhone, today } from "../lib/format";
import { FACILITY_ROLES, roleLabel, sortRoles } from "../lib/roles";
import { go } from "../lib/router";
import { useApp } from "../state/store";
import { tempPassword, useLoad, usernameFrom } from "./util";

const EMPTY = { fullName: "", email: "", phone: "", username: "", password: "", roleId: "", facilityId: "" };

export default function AdminCreateUser() {
  const { onApiError, notify } = useApp();
  const meta = useLoad(async () => {
    const [roles, facilities] = await Promise.all([adminApi.roles(), adminApi.facilities()]);
    return { roles: sortRoles(roles, (r) => r.roleName), facilities: facilities.filter((f) => f.status === "ACTIVE") };
  }, [], onApiError);
  const [form, setForm] = useState(() => ({ ...EMPTY, password: tempPassword() }));
  const [userTouched, setUserTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const roles = meta.data?.roles || [];
  const role = roles.find((r) => String(r.roleId) === String(form.roleId));
  const scoped = role && FACILITY_ROLES.includes(role.roleName);

  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "email" && !userTouched) next.username = usernameFrom(v);
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Vui lòng nhập họ và tên.";
    if (!isEmail(form.email)) e.email = "Nhập email hợp lệ, ví dụ ten@safespace.vn.";
    if (form.phone && !isPhone(form.phone)) e.phone = "Số điện thoại chưa đúng định dạng.";
    if (!/^[a-zA-Z0-9._@-]{3,50}$/.test(form.username)) e.username = "Tên đăng nhập 3–50 ký tự: chữ, số, dấu . _ - @";
    if (form.password.length < 8) e.password = "Mật khẩu tạm thời cần ít nhất 8 ký tự.";
    if (!form.roleId) e.roleId = "Chọn vai trò cho tài khoản.";
    if (scoped && !form.facilityId) e.facilityId = "Nhân viên và Quản lý cơ sở cần có cơ sở phụ trách.";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) return setErrors(e);
    setBusy(true);
    let created;
    try {
      created = await adminApi.createUser({
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/[\s.-]/g, "") || null,
        initialRoleId: Number(form.roleId),
        status: "ACTIVE",
      });
    } catch (err) {
      onApiError(err);
      setBusy(false);
      const msg = err.message || "Không tạo được tài khoản.";
      if (/Tên đăng nhập/i.test(msg)) return setErrors({ username: msg });
      if (/Email/i.test(msg)) return setErrors({ email: msg });
      return setErrors({ form: msg });
    }
    let facilityError = null;
    if (scoped && form.facilityId) {
      try {
        await adminApi.assignFacility({ userId: created.userId, facilityId: Number(form.facilityId), assignedFrom: today(), assignedTo: null });
      } catch (err) {
        facilityError = err.message;
      }
    }
    setBusy(false);
    setDone({ user: created, password: form.password, facilityError });
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Đã sao chép.");
    } catch {
      notify("Không sao chép được, vui lòng chép thủ công.", "error");
    }
  };

  return (
    <main className="result">
      <form className="panel admin-form" onSubmit={submit} noValidate>
        <h1>Thêm tài khoản mới</h1>
        <p className="lead">Tạo tài khoản và gán vai trò phù hợp. Gửi tên đăng nhập và mật khẩu tạm thời cho người dùng để đăng nhập lần đầu.</p>
        {meta.error && <Notice tone="error">{meta.error}</Notice>}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <Field label="Họ và tên" error={errors.fullName}>
          <input autoComplete="off" placeholder="Nhập họ và tên" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="off" placeholder="ten@safespace.vn" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Số điện thoại" error={errors.phone}>
          <input type="tel" autoComplete="off" placeholder="09xx xxx xxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <div className="form-row">
          <Field label="Tên đăng nhập" error={errors.username}>
            <input autoComplete="off" placeholder="tên đăng nhập" value={form.username} onChange={(e) => { setUserTouched(true); set("username", e.target.value.trim()); }} />
          </Field>
          <Field label="Mật khẩu tạm thời" error={errors.password}>
            <span className="input-action">
              <input autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
              <button type="button" onClick={() => set("password", tempPassword())} aria-label="Tạo mật khẩu khác">Tạo mới</button>
            </span>
          </Field>
        </div>
        <div className={`field${errors.roleId ? " field--invalid" : ""}`}>
          <span className="field__label" id="role-label">Vai trò</span>
          <div className="role-chips" role="radiogroup" aria-labelledby="role-label">
            {roles.map((r) => (
              <button
                type="button"
                key={r.roleId}
                role="radio"
                aria-checked={String(form.roleId) === String(r.roleId)}
                className={String(form.roleId) === String(r.roleId) ? "is-on" : ""}
                onClick={() => set("roleId", r.roleId)}
              >
                {roleLabel(r.roleName)}
              </button>
            ))}
            {meta.loading && <span className="muted">Đang tải vai trò…</span>}
          </div>
          {errors.roleId && <p className="field__error" role="alert">{errors.roleId}</p>}
        </div>
        <Field label="Cơ sở phụ trách" error={errors.facilityId}>
          <Select value={form.facilityId} disabled={!scoped} onChange={(e) => set("facilityId", e.target.value)}>
            <option value="">{scoped ? "Chọn cơ sở" : "Không áp dụng cho vai trò này"}</option>
            {(meta.data?.facilities || []).map((f) => (
              <option key={f.facilityId} value={f.facilityId}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <p className="note-box">
          "Cơ sở phụ trách" chỉ áp dụng cho vai trò gắn với một cơ sở cụ thể (Nhân viên, Quản lý cơ sở). Vận hành KD và Quản trị có quyền trên toàn hệ thống.
        </p>
        <Button type="submit" block disabled={busy || meta.loading}>{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</Button>
        <p className="auth__switch">
          <a href="#/admin">← Về danh sách tài khoản</a>
        </p>
      </form>

      {done && (
        <Modal title="Đã tạo tài khoản" onClose={() => go(`admin/users/${done.user.userId}`)}>
          <p className="modal__text">Gửi thông tin đăng nhập dưới đây cho {done.user.fullName}. Mật khẩu chỉ hiển thị một lần.</p>
          <dl className="detail-list">
            <div><dt>Tên đăng nhập</dt><dd>{done.user.username} <button type="button" className="link-btn" onClick={() => copy(done.user.username)}>Chép</button></dd></div>
            <div><dt>Mật khẩu tạm thời</dt><dd>{done.password} <button type="button" className="link-btn" onClick={() => copy(done.password)}>Chép</button></dd></div>
          </dl>
          {done.facilityError && <Notice tone="error">Chưa phân công được cơ sở: {done.facilityError}. Bạn có thể phân công lại trong trang chi tiết.</Notice>}
          <div className="modal__actions">
            <Button onClick={() => go(`admin/users/${done.user.userId}`)}>Xem tài khoản</Button>
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setForm({ ...EMPTY, password: tempPassword() });
                setUserTouched(false);
              }}
            >
              Tạo tài khoản khác
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
