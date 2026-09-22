import React, { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { DatePicker, Select } from "../components/Pickers";
import { Button, Empty, Field, LinkButton, Modal, Notice, StatusTag } from "../components/UI";
import { isEmail, isPhone, today } from "../lib/format";
import { ASSIGNMENT_STATUS, USER_STATUS, needsFacility, roleLabel, sortRoles } from "../lib/roles";
import { useApp } from "../state/store";
import { dateOnlyLabel, dateTime, tempPassword, useLoad } from "./util";

function InfoCard({ user, onSaved }) {
  const { onApiError, notify } = useApp();
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, phone: user.phone || "", status: user.status });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm({ fullName: user.fullName, email: user.email, phone: user.phone || "", status: user.status }), [user]);
  const dirty = form.fullName !== user.fullName || form.email !== user.email || form.phone !== (user.phone || "") || form.status !== user.status;
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors({});
  };
  const save = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.fullName.trim()) err.fullName = "Vui lòng nhập họ và tên.";
    if (!isEmail(form.email)) err.email = "Email chưa hợp lệ.";
    if (form.phone && !isPhone(form.phone)) err.phone = "Số điện thoại chưa đúng định dạng.";
    if (Object.keys(err).length) return setErrors(err);
    setBusy(true);
    try {
      await adminApi.updateUser(user.userId, { fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.replace(/[\s.-]/g, "") || null, status: form.status });
      notify("Đã cập nhật tài khoản.");
      onSaved();
    } catch (ex) {
      onApiError(ex);
      setErrors({ form: ex.message });
    }
    setBusy(false);
  };
  return (
    <form className="panel form-card" onSubmit={save} noValidate>
      <h2>Thông tin tài khoản</h2>
      <Field label="Họ và tên" error={errors.fullName}>
        <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Số điện thoại" error={errors.phone}>
        <input type="tel" value={form.phone} placeholder="Chưa cập nhật" onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Trạng thái" hint="Tài khoản không ở trạng thái Đang hoạt động sẽ không đăng nhập được.">
        <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
          {Object.entries(USER_STATUS).map(([k, [label]]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </Select>
      </Field>
      {errors.form && <Notice tone="error">{errors.form}</Notice>}
      <Button type="submit" disabled={!dirty || busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</Button>
    </form>
  );
}

function PasswordCard({ user }) {
  const { onApiError } = useApp();
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Mật khẩu mới cần ít nhất 8 ký tự.");
    setBusy(true);
    try {
      await adminApi.resetPassword(user.userId, pw);
      setDone(pw);
      setPw("");
    } catch (ex) {
      onApiError(ex);
      setError(ex.message);
    }
    setBusy(false);
  };
  return (
    <form className="panel form-card" onSubmit={submit} noValidate>
      <h2>Đặt lại mật khẩu</h2>
      <Field label="Mật khẩu mới" error={error}>
        <span className="input-action">
          <input autoComplete="new-password" value={pw} placeholder="Ít nhất 8 ký tự" onChange={(e) => { setPw(e.target.value); setError(""); }} />
          <button type="button" onClick={() => { setPw(tempPassword()); setError(""); }}>Tạo ngẫu nhiên</button>
        </span>
      </Field>
      <Button type="submit" variant="outline" disabled={busy || !pw}>{busy ? "Đang đặt lại…" : "Đặt lại mật khẩu"}</Button>
      {done && (
        <Modal title="Đã đặt lại mật khẩu" onClose={() => setDone(null)}>
          <p className="modal__text">Mật khẩu mới của {user.fullName}: <strong>{done}</strong>. Gửi cho người dùng và nhắc đổi sau khi đăng nhập.</p>
          <Button onClick={() => setDone(null)}>Đã hiểu</Button>
        </Modal>
      )}
    </form>
  );
}

function RolesCard({ user, allRoles, onSaved }) {
  const { onApiError, notify } = useApp();
  const [adding, setAdding] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const owned = new Set(user.roles.map((r) => r.roleId));
  const available = allRoles.filter((r) => !owned.has(r.roleId));
  const run = async (fn, msg) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      notify(msg);
      onSaved();
    } catch (ex) {
      onApiError(ex);
      setError(ex.message);
    }
    setBusy(false);
  };
  return (
    <section className="panel form-card">
      <h2>Vai trò</h2>
      <div className="role-list">
        {sortRoles(user.roles, (r) => r.roleName).map((r) => (
          <span className="role-pill" key={r.roleId}>
            {roleLabel(r.roleName)}
            <button type="button" aria-label={`Thu hồi vai trò ${roleLabel(r.roleName)}`} onClick={() => setConfirm(r)} disabled={busy}>×</button>
          </span>
        ))}
        {user.roles.length === 0 && <span className="muted">Chưa có vai trò.</span>}
      </div>
      {available.length > 0 && (
        <div className="inline-form">
          <Select aria-label="Chọn vai trò để gán" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Chọn vai trò…</option>
            {available.map((r) => (
              <option key={r.roleId} value={r.roleId}>{roleLabel(r.roleName)}</option>
            ))}
          </Select>
          <Button disabled={!adding || busy} onClick={() => run(() => adminApi.assignRole(user.userId, Number(adding)), "Đã gán vai trò.").then(() => setAdding(""))}>
            Gán vai trò
          </Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {confirm && (
        <Modal title="Thu hồi vai trò?" onClose={() => setConfirm(null)}>
          <p className="modal__text">
            {user.fullName} sẽ mất vai trò <strong>{roleLabel(confirm.roleName)}</strong> và các quyền đi kèm.
          </p>
          <div className="modal__actions">
            <Button
              variant="danger"
              onClick={() => {
                const r = confirm;
                setConfirm(null);
                run(() => adminApi.revokeRole(user.userId, r.roleId), "Đã thu hồi vai trò.");
              }}
            >
              Thu hồi
            </Button>
            <Button variant="outline" onClick={() => setConfirm(null)}>Giữ lại</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function FacilityCard({ user, facilities, rows, onSaved }) {
  const { onApiError, notify } = useApp();
  const [facilityId, setFacilityId] = useState("");
  const [from, setFrom] = useState(today());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = rows.find((r) => r.status === "ACTIVE");
  const run = async (fn, msg) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      notify(msg);
      onSaved();
    } catch (ex) {
      onApiError(ex);
      setError(ex.message);
    }
    setBusy(false);
  };
  return (
    <section className="panel form-card">
      <h2>Cơ sở phụ trách</h2>
      <p className="muted">
        {active ? (
          <>Đang phụ trách <strong>{active.facilityName}</strong> từ {dateOnlyLabel(active.assignedFrom)}.</>
        ) : (
          "Chưa được phân công cơ sở."
        )}{" "}
        Mỗi nhân viên / quản lý chỉ phụ trách một cơ sở tại một thời điểm; phân công mới sẽ tự kết thúc phân công cũ.
      </p>
      <div className="inline-form inline-form--wrap">
        <Select aria-label="Chọn cơ sở" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
          <option value="">Chọn cơ sở…</option>
          {facilities.map((f) => (
            <option key={f.facilityId} value={f.facilityId}>{f.name}</option>
          ))}
        </Select>
        <DatePicker value={from} min="2000-01-01" onChange={setFrom} className="inline-date" />
        <Button
          disabled={!facilityId || busy}
          onClick={() => run(() => adminApi.assignFacility({ userId: user.userId, facilityId: Number(facilityId), assignedFrom: from, assignedTo: null }), "Đã phân công cơ sở.").then(() => setFacilityId(""))}
        >
          Phân công
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {rows.length > 0 && (
        <div className="scroll-x">
        <table className="table table--inner">
          <thead>
            <tr><th>Cơ sở</th><th>Thời gian</th><th>Trạng thái</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userFacilityId}>
                <td>{r.facilityName}<small className="cell-sub">Phân công bởi {r.assignerName || "—"}</small></td>
                <td>{dateOnlyLabel(r.assignedFrom)} – {r.assignedTo ? dateOnlyLabel(r.assignedTo) : "nay"}</td>
                <td><StatusTag map={ASSIGNMENT_STATUS} status={r.status} /></td>
                <td className="cell-actions">
                  {r.status === "ACTIVE" && (
                    <>
                      <button type="button" className="link-btn" disabled={busy} onClick={() => run(() => adminApi.setAssignmentStatus(r.userFacilityId, "SUSPENDED"), "Đã tạm ngưng phân công.")}>Tạm ngưng</button>
                      <button type="button" className="link-btn link-btn--danger" disabled={busy} onClick={() => run(() => adminApi.setAssignmentStatus(r.userFacilityId, "ENDED"), "Đã kết thúc phân công.")}>Kết thúc</button>
                    </>
                  )}
                  {r.status === "SUSPENDED" && (
                    <button type="button" className="link-btn" disabled={busy} onClick={() => run(() => adminApi.setAssignmentStatus(r.userFacilityId, "ACTIVE"), "Đã kích hoạt lại phân công.")}>Kích hoạt lại</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}

export default function AdminUserDetail({ id }) {
  const { onApiError } = useApp();
  const res = useLoad(async () => {
    const [user, roles, facilities, assignments] = await Promise.all([adminApi.user(id), adminApi.roles(), adminApi.facilities(), adminApi.userFacilities(id)]);
    return { user, roles: sortRoles(roles, (r) => r.roleName), facilities: facilities.filter((f) => f.status === "ACTIVE"), assignments };
  }, [id], onApiError);

  if (res.error && !res.data)
    return (
      <main className="container page">
        <Empty title="Không tải được tài khoản" text={res.error}>
          <LinkButton to="admin">Về danh sách tài khoản</LinkButton>
        </Empty>
      </main>
    );
  if (!res.data)
    return (
      <main className="container page loading" aria-busy="true">
        <span className="loading__spinner" aria-hidden="true" />
        <p>Đang tải tài khoản…</p>
      </main>
    );
  const { user, roles, facilities, assignments } = res.data;
  const roleNames = user.roles.map((r) => r.roleName);

  return (
    <main className="container page">
      <p className="back-link"><a href="#/admin">← Danh sách tài khoản</a></p>
      <header className="page-header">
        <div>
          <h1>{user.fullName}</h1>
          <p>
            @{user.username} · {sortRoles(roleNames).map(roleLabel).join(", ") || "Chưa có vai trò"} · Tạo ngày {dateTime(user.createdAt).slice(0, 10)}
          </p>
        </div>
        <div className="page-header__actions">
          <StatusTag map={USER_STATUS} status={user.status} square />
        </div>
      </header>

      <div className="stats stats--4">
        <div className="stat"><strong>{user.activeContractsCount}</strong><span>Hợp đồng đang thuê</span></div>
        <div className="stat"><strong className="tone-blue">{user.openTicketsCount}</strong><span>Yêu cầu hỗ trợ đang mở</span></div>
        <div className="stat"><strong className="stat__text">{user.lastLoginAt ? dateTime(user.lastLoginAt) : "Chưa đăng nhập"}</strong><span>Đăng nhập gần nhất</span></div>
        <div className="stat"><strong className="stat__text">{dateTime(user.updatedAt)}</strong><span>Cập nhật gần nhất</span></div>
      </div>

      <div className="grid grid--2 admin-grid">
        <div className="stack stack--col stack--fill">
          <InfoCard user={user} onSaved={res.reload} />
          <PasswordCard user={user} />
        </div>
        <div className="stack stack--col stack--fill">
          <RolesCard user={user} allRoles={roles} onSaved={res.reload} />
          {(needsFacility(roleNames) || assignments.length > 0) && <FacilityCard user={user} facilities={facilities} rows={assignments} onSaved={res.reload} />}
        </div>
      </div>
    </main>
  );
}
