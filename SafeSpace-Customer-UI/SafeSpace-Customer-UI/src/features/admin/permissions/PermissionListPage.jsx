/*
 * PERMISSION LIST PAGE - CẤU HÌNH PHÂN QUYỀN TRUY CẬP HỆ THỐNG
 *
 * Chức năng chính:
 * 1. Hiển thị bảng tổng quan các vai trò (Roles) trong hệ thống:
 *    - Tên vai trò (Admin, Quản lý cơ sở, Nhân viên cơ sở, Quản lý vận hành kinh doanh, Khách hàng).
 *    - Phạm vi dữ liệu (Toàn hệ thống, Theo cơ sở phụ trách, Dữ liệu cá nhân).
 *    - Mô tả và tổng số quyền được gán trên tổng số quyền của hệ thống.
 * 2. Ma trận phân quyền chi tiết (Role-Permission Matrix):
 *    - Hàng là từng quyền thao tác cụ thể (USER_MANAGE, ROLE_MANAGE, CONTRACT_VIEW, UNIT_UPDATE, v.v.).
 *    - Cột là các vai trò trong hệ thống.
 *    - Mỗi ô là một checkbox cho phép bật/tắt quyền.
 * 3. Quản lý trạng thái thay đổi chưa lưu (changes):
 *    - Đánh dấu ô thay đổi bằng màu khác biệt (.is-changed).
 *    - Đếm số thay đổi chưa lưu.
 *    - Hỗ trợ nút "Hoàn tác" để khôi phục về trạng thái ban đầu.
 * 4. Xác nhận an toàn trước khi lưu:
 *    - Mở Modal liệt kê chi tiết các quyền sẽ gán hoặc thu hồi.
 *    - Cảnh báo nguy hiểm nếu Quản trị viên vô tình gỡ bỏ quyền quản trị của chính vai trò ADMIN.
 *    - Gọi API assignPermission / revokePermission cho từng thay đổi.
 */

import React, { useMemo, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import { Button, Modal, Notice } from "../../../shared/components/UI.jsx";
import { ROLE_SCOPE, roleLabel, sortRoles } from "../../../shared/utils/roles.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useLoad } from "../utils/adminUtils.js";

// Tạo chuỗi khóa duy nhất đại diện cho cặp vai trò và quyền (ví dụ: "1:5")
const key = (roleId, permissionId) => `${roleId}:${permissionId}`;

export default function PermissionListPage() {
  const { onApiError, notify } = useApp();

  /*
   * TẢI DANH SÁCH VAI TRÒ VÀ QUYỀN TỪ BACKEND
   * Gọi đồng thời:
   * 1. adminApi.roles(): danh sách vai trò kèm các quyền hiện tại của mỗi vai trò
   * 2. adminApi.permissions(): danh sách toàn bộ quyền hạn được hỗ trợ trong hệ thống
   */
  const res = useLoad(async () => {
    const [roles, permissions] = await Promise.all([adminApi.roles(), adminApi.permissions()]);
    return { roles: sortRoles(roles, (r) => r.roleName), permissions };
  }, [], onApiError);

  /*
   * STATE QUẢN LÝ THAY ĐỔI VÀ TIẾN TRÌNH LƯU
   */
  // Lưu các thay đổi cục bộ chưa lưu lên server: { "roleId:permissionId": true (gán) | false (thu hồi) }
  const [changes, setChanges] = useState({});
  // Trạng thái hiển thị modal xác nhận lưu thay đổi
  const [confirm, setConfirm] = useState(false);
  // Trạng thái đang gửi request lưu lên backend
  const [saving, setSaving] = useState(false);
  // Danh sách các lỗi nếu có request gán/thu hồi quyền thất bại
  const [errors, setErrors] = useState([]);

  /*
   * granted - Tập hợp (Set) các quyền ban đầu hiện có từ backend
   * Duyệt qua từng vai trò và lưu các key "roleId:permissionId" vào Set để tra cứu nhanh O(1).
   */
  const granted = useMemo(() => {
    const s = new Set();
    for (const r of res.data?.roles || []) {
      for (const p of r.permissions) {
        s.add(key(r.roleId, p.permissionId));
      }
    }
    return s;
  }, [res.data]);

  /*
   * isOn - Kiểm tra một quyền có đang được tích chọn cho vai trò hay không
   * Ưu tiên kiểm tra trong `changes` (thay đổi tạm thời của người dùng),
   * nếu người dùng chưa can thiệp thì lấy theo dữ liệu gốc trong `granted`.
   */
  const isOn = (roleId, pid) => {
    const k = key(roleId, pid);
    return k in changes ? changes[k] : granted.has(k);
  };

  /*
   * toggle - Đảo ngược trạng thái checkbox khi click
   * Nếu trạng thái mới trùng với dữ liệu gốc ban đầu trong `granted`, xóa khỏi `changes`.
   */
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

  // Mảng các thay đổi đang chờ lưu: [ ["roleId:permissionId", true/false], ... ]
  const pending = Object.entries(changes);
  const roles = res.data?.roles || [];
  const permissions = res.data?.permissions || [];

  // Hàm tra cứu vai trò theo ID
  const roleOf = (id) => roles.find((r) => String(r.roleId) === String(id));
  // Hàm tra cứu quyền theo ID
  const permOf = (id) => permissions.find((p) => String(p.permissionId) === String(id));

  /*
   * adminLosesAccess - Kiểm tra an toàn:
   * Phát hiện trường hợp người dùng đang thu hồi các quyền sống còn (USER_MANAGE, ROLE_MANAGE)
   * của chính vai trò ADMIN, tránh trường hợp tự khóa quyền của chính mình dẫn đến không thể khôi phục.
   */
  const adminLosesAccess = pending.some(([k, on]) => {
    const [rid, pid] = k.split(":");
    return !on && roleOf(rid)?.roleName === "ADMIN" && ["USER_MANAGE", "ROLE_MANAGE"].includes(permOf(pid)?.permissionCode);
  });

  /*
   * save - Thực thi lưu toàn bộ thay đổi lên Backend
   * 1. Duyệt qua mảng pending.
   * 2. Nếu on = true: gọi adminApi.assignPermission(roleId, permissionId).
   * 3. Nếu on = false: gọi adminApi.revokePermission(roleId, permissionId).
   * 4. Thu thập các lỗi (nếu có) để hiển thị cho Admin.
   * 5. Tải lại dữ liệu mới từ backend và thông báo qua toast.
   */
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
      {/* Tiêu đề trang */}
      <header className="page-header">
        <div>
          <h1>Cấu hình quyền truy cập dữ liệu</h1>
          <p>Thiết lập phạm vi dữ liệu và quyền thao tác mà mỗi vai trò được phép.</p>
        </div>
      </header>

      {/* Thông báo lỗi khi tải dữ liệu vai trò/quyền */}
      {res.error && <Notice tone="error">{res.error}</Notice>}

      {/* BẢNG 1: TỔNG QUAN VAI TRÒ VÀ PHẠM VI DỮ LIỆU */}
      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Vai trò</th>
              <th>Phạm vi dữ liệu</th>
              <th>Mô tả</th>
              <th>Số quyền</th>
            </tr>
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
            {res.loading && !res.data && (
              <tr>
                <td colSpan={4} className="table__empty">Đang tải…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* BẢNG 2: MA TRẬN PHÂN QUYỀN THAO TÁC THEO VAI TRÒ (ROLE-PERMISSION MATRIX) */}
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
                {/* Tên quyền, mã code và mô tả ngắn */}
                <td>
                  <span className="cell-strong">{p.permissionName}</span>
                  <small className="cell-sub">{p.permissionCode}{p.description ? ` · ${p.description}` : ""}</small>
                </td>
                {/* Cột checkbox cho từng vai trò */}
                {roles.map((r) => {
                  const k = key(r.roleId, p.permissionId);
                  const on = isOn(r.roleId, p.permissionId);
                  return (
                    <td key={r.roleId} className={`matrix__cell${k in changes ? " is-changed" : ""}`}>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={saving}
                          onChange={() => toggle(r.roleId, p.permissionId)}
                          aria-label={`${roleLabel(r.roleName)} — ${p.permissionName}`}
                        />
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

      {/* Hiển thị lỗi nếu có thao tác lưu thất bại */}
      {errors.length > 0 && (
        <Notice tone="error">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Notice>
      )}

      {/* NÚT THAO TÁC: LƯU CẤU HÌNH & HOÀN TÁC */}
      <div className="stack">
        <Button disabled={!pending.length || saving} onClick={() => setConfirm(true)}>
          {saving ? "Đang lưu…" : pending.length ? `Lưu cấu hình quyền (${pending.length} thay đổi)` : "Lưu cấu hình quyền"}
        </Button>
        {pending.length > 0 && !saving && (
          <Button variant="outline" onClick={() => setChanges({})}>Hoàn tác</Button>
        )}
      </div>

      {/* MODAL XÁC NHẬN ÁP DỤNG THAY ĐỔI */}
      {confirm && (
        <Modal title="Áp dụng thay đổi quyền?" onClose={() => setConfirm(false)} size="md">
          {/* Liệt kê từng thay đổi cụ thể */}
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

          {/* Cảnh báo nếu Quản trị viên tự thu hồi quyền quản lý của Admin */}
          {adminLosesAccess && (
            <Notice tone="error">Bạn đang thu hồi quyền quản lý tài khoản / vai trò của Quản trị. Hãy chắc chắn vẫn còn cách khôi phục.</Notice>
          )}

          {/* Các nút hành động trong Modal */}
          <div className="modal__actions">
            <Button onClick={save}>Áp dụng</Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>Xem lại</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
