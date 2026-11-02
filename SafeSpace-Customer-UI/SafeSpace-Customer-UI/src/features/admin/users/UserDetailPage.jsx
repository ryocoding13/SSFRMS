/*
 * USER DETAIL PAGE - XEM VÀ CHỈNH SỬA CHI TIẾT TÀI KHOẢN NGƯỜI DÙNG
 *
 * Chức năng chính:
 * 1. Hiển thị tổng quan tài khoản:
 *    - Tên, username, vai trò, ngày tạo, trạng thái hiện tại (Đang hoạt động, Đang khoá, Ngưng hoạt động).
 *    - 4 ô thống kê: Số hợp đồng đang thuê, yêu cầu hỗ trợ đang mở, đăng nhập gần nhất, cập nhật gần nhất.
 * 2. Thẻ 1: Thông tin tài khoản (InfoCard):
 *    - Sửa họ tên, email, số điện thoại, trạng thái tài khoản.
 *    - Kiểm tra hợp lệ dữ liệu (họ tên không rỗng, định dạng email, số điện thoại).
 *    - Nút "Lưu thay đổi" chỉ bật khi có dữ liệu thay đổi (dirty) và không trong trạng thái đang gửi request.
 * 3. Thẻ 2: Đặt lại mật khẩu (PasswordCard):
 *    - Cho phép Admin nhập mật khẩu mới hoặc bấm "Tạo ngẫu nhiên" mật khẩu mạnh 12 ký tự.
 *    - Gọi API resetPassword qua hộp thoại xác nhận; hộp thoại thành công hiện mật khẩu mới một lần (Figma 885:10676).
 * 4. Thẻ 3: Quản lý vai trò (RolesCard):
 *    - Danh sách các vai trò tài khoản đang sở hữu dưới dạng pill.
 *    - Nút xoá (x) trên từng pill để thu hồi vai trò qua hộp thoại xác nhận chung (Figma 885:10725).
 *    - Dropdown chọn vai trò để gán thêm vai trò mới (chỉ hiển thị những vai trò tài khoản chưa có).
 * 5. Thẻ 4: Phân công cơ sở phụ trách (FacilityCard):
 *    - Hiển thị cơ sở đang phụ trách hiện tại (ACTIVE).
 *    - Bảng lịch sử phân công cơ sở: Tên cơ sở, người phân công, thời gian từ ngày - đến ngày, trạng thái.
 *    - Các thao tác trạng thái: Tạm ngưng (SUSPENDED), Kết thúc (ENDED), Kích hoạt lại (ACTIVE).
 *    - Form gán cơ sở mới kèm ngày bắt đầu phân công.
 */

import { RolesCard,FacilityCard } from "../components/AccountAssignmentCards.jsx";
import React, { useEffect, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import { DatePicker, Select } from "../../../shared/components/Pickers.jsx";
import { Button, Empty, Field, LinkButton, Notice, StatusTag } from "../../../shared/components/UI.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { isEmail, isPhone, today } from "../../../shared/utils/format.js";
import { ASSIGNMENT_STATUS, USER_STATUS, needsFacility, roleLabel, sortRoles } from "../../../shared/utils/roles.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateOnlyLabel, dateTime, tempPassword, useLoad } from "../utils/adminUtils.js";

/*
 * InfoCard - Thẻ Cập Nhật Thông Tin Cá Nhân & Trạng Thái Tài Khoản
 *
 * Tham số:
 * - user: đối tượng người dùng hiện tại
 * - onSaved: callback làm mới lại dữ liệu từ server sau khi cập nhật thành công
 */
function InfoCard({ user, onSaved }) {
  const { onApiError } = useApp();
  const [flowEl, runChange] = useChangeFlow();

  // State lưu dữ liệu form chỉnh sửa
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, phone: user.phone || "", status: user.status });
  // State lưu lỗi validation từng trường
  const [errors, setErrors] = useState({});
  // Trạng thái đang gửi API
  const [busy, setBusy] = useState(false);

  // Đồng bộ lại form khi thông tin user thay đổi
  useEffect(() => {
    setForm({ fullName: user.fullName, email: user.email, phone: user.phone || "", status: user.status });
  }, [user.userId,user.fullName,user.email,user.phone,user.status]);

  // Kiểm tra dữ liệu form có thay đổi so với dữ liệu gốc không
  const dirty = form.fullName !== user.fullName || form.email !== user.email || form.phone !== (user.phone || "") || form.status !== user.status;

  // Cập nhật giá trị một trường trong form
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors({});
  };

  // Xử lý gửi form cập nhật thông tin
  const save = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.fullName.trim()) err.fullName = "Vui lòng nhập họ và tên.";
    if (!isEmail(form.email)) err.email = "Email chưa hợp lệ.";
    if (form.phone && !isPhone(form.phone)) err.phone = "Số điện thoại chưa đúng định dạng.";
    if (Object.keys(err).length) return setErrors(err);

    // Figma 885:10623–10647: xác nhận → đã lưu / không lưu được
    setBusy(true);
    const out = await runChange({
      action: "Lưu thông tin tài khoản", scope: `Tài khoản ${user.fullName}`, content: "Thông tin và trạng thái tài khoản đã chỉnh sửa",
      perform: () => adminApi.updateUser(user.userId, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/[\s.-]/g, "") || null,
        status: form.status,
      }),
    });
    setBusy(false);
    if (out.error) onApiError(out.error);
    if (out.ok) onSaved();
  };

  return (
    <form className="panel form-card" onSubmit={save} noValidate>
      <h2>Thông tin tài khoản</h2>

      {/* Trường họ và tên */}
      <Field label="Họ và tên" error={errors.fullName}>
        <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </Field>

      {/* Trường email */}
      <Field label="Email" error={errors.email}>
        <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>

      {/* Trường số điện thoại (tùy chọn) */}
      <Field label="Số điện thoại" error={errors.phone}>
        <input type="tel" value={form.phone} placeholder="Chưa cập nhật" onChange={(e) => set("phone", e.target.value)} />
      </Field>

      {/* Trường trạng thái tài khoản */}
      <Field label="Trạng thái" hint="Tài khoản không ở trạng thái Đang hoạt động sẽ không đăng nhập được.">
        <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
          {Object.entries(USER_STATUS).map(([k, [label]]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </Select>
      </Field>

      {/* Hiển thị lỗi từ backend nếu có */}
      {errors.form && <Notice tone="error">{errors.form}</Notice>}

      {/* Nút lưu: Chỉ bật khi form có thay đổi và không bận */}
      <Button type="submit" disabled={!dirty || busy}>
        {busy ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
      {flowEl}
    </form>
  );
}

/*
 * PasswordCard - Thẻ Đặt Lại Mật Khẩu Cho Người Dùng
 *
 * Cho phép Admin cấp lại mật khẩu mới cho người dùng.
 * Sau khi đổi xong, hộp thoại thành công hiện mật khẩu để sao chép.
 */
function PasswordCard({ user }) {
  const { onApiError } = useApp();
  const [pw, setPw] = useState("");      // Mật khẩu mới đang nhập
  const [error, setError] = useState(""); // Lỗi độ dài mật khẩu
  const [busy, setBusy] = useState(false);
  const [flowEl, runChange] = useChangeFlow();

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Mật khẩu mới cần ít nhất 8 ký tự.");

    // Figma 885:10657–10681: mật khẩu mới chỉ hiển thị một lần trong hộp thoại thành công
    setBusy(true);
    const out = await runChange({
      action: "Đặt lại mật khẩu", scope: `Tài khoản ${user.fullName}`, content: "Mật khẩu mới trên biểu mẫu; chỉ hiển thị một lần",
      successText: `Đã đặt lại mật khẩu. Mật khẩu mới của ${user.fullName}: ${pw}. Mật khẩu mới chỉ hiển thị một lần; quản trị viên gửi lại cho người dùng.`,
      perform: () => adminApi.resetPassword(user.userId, pw),
    });
    setBusy(false);
    if (out.error) onApiError(out.error);
    if (out.ok) setPw("");
  };

  return (
    <form className="panel form-card" onSubmit={submit} noValidate>
      <h2>Đặt lại mật khẩu</h2>

      <Field label="Mật khẩu mới" error={error}>
        <span className="input-action">
          <input
            autoComplete="new-password"
            value={pw}
            placeholder="Ít nhất 8 ký tự"
            onChange={(e) => { setPw(e.target.value); setError(""); }}
          />
          {/* Nút sinh mật khẩu ngẫu nhiên */}
          <button type="button" onClick={() => { setPw(tempPassword()); setError(""); }}>
            Tạo ngẫu nhiên
          </button>
        </span>
      </Field>

      <Button type="submit" variant="outline" disabled={busy || !pw}>
        {busy ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
      </Button>

      {flowEl}
    </form>
  );
}

/*
 * RolesCard - Thẻ Quản Lý Vai Trò Của Người Dùng
 *
 * Tham số:
 * - user: thông tin người dùng kèm danh sách roles hiện có
 * - allRoles: danh mục tất cả vai trò trong hệ thống
 * - onSaved: callback làm mới dữ liệu
 */
/*
 * UserDetailPage - Component Trang Chi Tiết Tài Khoản
 *
 * Tham số:
 * - id: userId của tài khoản cần xem/chỉnh sửa
 */
export default function UserDetailPage({ id }) {
  const { onApiError } = useApp();

  /*
   * TẢI ĐỒNG THỜI DỮ LIỆU TỪ 4 API:
   * 1. adminApi.user(id): thông tin chi tiết người dùng
   * 2. adminApi.roles(): toàn bộ danh sách vai trò
   * 3. adminApi.facilities(): toàn bộ danh sách cơ sở
   * 4. adminApi.userFacilities(id): lịch sử phân công cơ sở của người dùng này
   */
  const res = useLoad(async () => {
    const [user, roles, facilities, assignments] = await Promise.all([
      adminApi.user(id),
      adminApi.roles(),
      adminApi.facilities(),
      adminApi.userFacilities(id),
    ]);
    return {
      user,
      roles: sortRoles(roles, (r) => r.roleName),
      facilities: facilities.filter((f) => f.status === "ACTIVE"),
      assignments,
    };
  }, [id], onApiError);

  // Trường hợp tải thất bại hoàn toàn
  if (res.error && !res.data)
    return (
      <main className="container page">
        <Empty title="Không tải được tài khoản" text={res.error}>
          <LinkButton to="admin">Về danh sách tài khoản</LinkButton>
        </Empty>
      </main>
    );

  // Màn hình loading khi đang tải dữ liệu ban đầu
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
      {/* Đường dẫn quay lại danh sách tài khoản */}
      <p className="back-link"><a href="#/admin">← Danh sách tài khoản</a></p>

      {/* Header trang chi tiết: Họ tên, username, vai trò, ngày tạo và Tag trạng thái */}
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

      {res.error&&<Notice tone="error">{res.error} <Button onClick={res.reload}>Thử tải lại</Button></Notice>}
      {/* 4 Thẻ thống kê nhanh của tài khoản */}
      <div className="stats stats--4">
        <div className="stat"><strong>{user.activeContractsCount}</strong><span>Hợp đồng đang thuê</span></div>
        <div className="stat"><strong className="tone-blue">{user.openTicketsCount}</strong><span>Yêu cầu hỗ trợ đang mở</span></div>
        <div className="stat"><strong className="stat__text">{user.lastLoginAt ? dateTime(user.lastLoginAt) : "Chưa đăng nhập"}</strong><span>Đăng nhập gần nhất</span></div>
        <div className="stat"><strong className="stat__text">{dateTime(user.updatedAt)}</strong><span>Cập nhật gần nhất</span></div>
      </div>

      {/* Lưới 2 cột chứa 4 thẻ chức năng quản lý tài khoản */}
      <fieldset disabled={res.loading||!!res.error} className="grid grid--2 admin-grid">
        {/* Cột trái: Thông tin cá nhân & Đặt lại mật khẩu */}
        <div className="stack stack--col stack--fill">
          <InfoCard user={user} onSaved={res.reload} />
          <PasswordCard user={user} />
        </div>

        {/* Cột phải: Quản lý vai trò & Phân công cơ sở phụ trách */}
        <div className="stack stack--col stack--fill">
          <RolesCard user={user} allRoles={roles} onSaved={res.reload} />
          {/* Chỉ hiển thị thẻ cơ sở nếu user có vai trò cần cơ sở (Staff/Manager) hoặc đã từng có lịch sử phân công */}
          {(needsFacility(roleNames) || assignments.length > 0) && (
            <FacilityCard user={user} facilities={facilities} rows={assignments} onSaved={res.reload} />
          )}
        </div>
      </fieldset>
    </main>
  );
}
