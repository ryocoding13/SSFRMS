import React, { useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { Button, Modal, Notice } from "../components/UI";
import { ROLE_SCOPE, roleLabel, sortRoles } from "../lib/roles";
import { useApp } from "../state/store";
import { useLoad } from "./util";

const key = (roleId, permissionId) => `${roleId}:${permissionId}`;

export default function AdminPermissions() {
  const { onApiError, notify } = useApp();
  const res = useLoad(async () => {
    const [roles, permissions] = await Promise.all([adminApi.roles(), adminApi.permissions()]);
    return { roles: sortRoles(roles, (r) => r.roleName), permissions };
  }, [], onApiError);
  const [changes, setChanges] = useState({}); // key → true (gán) | false (thu hồi)
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const granted = useMemo(() => {
    const s = new Set();
    for (const r of res.data?.roles || []) for (const p of r.permissions) s.add(key(r.roleId, p.permissionId));
    return s;
  }, [res.data]);
  const isOn = (roleId, pid) => {
    const k = key(roleId, pid);
    return k in changes ? changes[k] : granted.has(k);
  };
  const toggle = (roleId, pid) => {
    const k = key(roleId, pid);
    const next = !isOn(roleId, pid);
    setChanges((c) => {
      const copy = { ...c };
      if (next === granted.has(k)) delete copy[k];
      else copy[k] = next;
      return copy;
    });
  };
  const pending = Object.entries(changes);
  const roles = res.data?.roles || [];
  const permissions = res.data?.permissions || [];
  const roleOf = (id) => roles.find((r) => String(r.roleId) === String(id));
  const permOf = (id) => permissions.find((p) => String(p.permissionId) === String(id));
  const adminLosesAccess = pending.some(([k, on]) => {
    const [rid, pid] = k.split(":");
    return !on && roleOf(rid)?.roleName === "ADMIN" && ["USER_MANAGE", "ROLE_MANAGE"].includes(permOf(pid)?.permissionCode);
  });

  const save = async () => {
    setConfirm(false);
    setSaving(true);
    const failed = [];
    for (const [k, on] of pending) {
      const [rid, pid] = k.split(":").map(Number);
      try {
        if (on) await adminApi.assignPermission(rid, pid);
        else await adminApi.revokePermission(rid, pid);
      } catch (e) {
        onApiError(e);
        failed.push(`${roleLabel(roleOf(rid)?.roleName)} · ${permOf(pid)?.permissionName}: ${e.message}`);
      }
    }
    setSaving(false);
    setErrors(failed);
    setChanges({});
    await res.reload();
    notify(failed.length ? `Đã lưu, ${failed.length} thay đổi không thành công.` : "Đã lưu cấu hình quyền.", failed.length ? "error" : "success");
  };

  return (
    <main className="container page">
      <header className="page-header">
        <div>
          <h1>Cấu hình quyền truy cập dữ liệu</h1>
          <p>Thiết lập phạm vi dữ liệu và quyền thao tác mà mỗi vai trò được phép.</p>
        </div>
      </header>
      {res.error && <Notice tone="error">{res.error}</Notice>}

      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr><th>Vai trò</th><th>Phạm vi dữ liệu</th><th>Mô tả</th><th>Số quyền</th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.roleId}>
                <td className="cell-strong">{roleLabel(r.roleName)}</td>
                <td>{ROLE_SCOPE[r.roleName] || "Theo quyền được gán"}</td>
                <td className="muted">{r.description || "—"}</td>
                <td>{permissions.filter((p) => isOn(r.roleId, p.permissionId)).length} / {permissions.length}</td>
              </tr>
            ))}
            {res.loading && !res.data && <tr><td colSpan={4} className="table__empty">Đang tải…</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Quyền thao tác theo vai trò</h2>
      <div className="table-wrap panel">
        <table className="table matrix">
          <thead>
            <tr>
              <th>Quyền</th>
              {roles.map((r) => (
                <th key={r.roleId} className="matrix__role">{roleLabel(r.roleName)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.permissionId}>
                <td>
                  <span className="cell-strong">{p.permissionName}</span>
                  <small className="cell-sub">{p.permissionCode}{p.description ? ` · ${p.description}` : ""}</small>
                </td>
                {roles.map((r) => {
                  const k = key(r.roleId, p.permissionId);
                  const on = isOn(r.roleId, p.permissionId);
                  return (
                    <td key={r.roleId} className={`matrix__cell${k in changes ? " is-changed" : ""}`}>
                      <label className="check">
                        <input type="checkbox" checked={on} disabled={saving} onChange={() => toggle(r.roleId, p.permissionId)} aria-label={`${roleLabel(r.roleName)} — ${p.permissionName}`} />
                        <span aria-hidden="true" />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <Notice tone="error">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Notice>
      )}
      <div className="stack">
        <Button disabled={!pending.length || saving} onClick={() => setConfirm(true)}>
          {saving ? "Đang lưu…" : pending.length ? `Lưu cấu hình quyền (${pending.length} thay đổi)` : "Lưu cấu hình quyền"}
        </Button>
        {pending.length > 0 && !saving && (
          <Button variant="outline" onClick={() => setChanges({})}>Hoàn tác</Button>
        )}
      </div>

      {confirm && (
        <Modal title="Áp dụng thay đổi quyền?" onClose={() => setConfirm(false)} size="md">
          <ul className="change-list">
            {pending.map(([k, on]) => {
              const [rid, pid] = k.split(":");
              return (
                <li key={k} className={on ? "is-add" : "is-remove"}>
                  {on ? "Gán" : "Thu hồi"} <strong>{permOf(pid)?.permissionName}</strong> {on ? "cho" : "của"} {roleLabel(roleOf(rid)?.roleName)}
                </li>
              );
            })}
          </ul>
          {adminLosesAccess && <Notice tone="error">Bạn đang thu hồi quyền quản lý tài khoản / vai trò của Quản trị. Hãy chắc chắn vẫn còn cách khôi phục.</Notice>}
          <div className="modal__actions">
            <Button onClick={save}>Áp dụng</Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>Xem lại</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
