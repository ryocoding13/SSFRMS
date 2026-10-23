import React, { useEffect, useState } from "react";
import { Button, Field } from "../../shared/components/UI.jsx";
import { go, href } from "../../app/router.js";
import { homeFor, isOpsRoles, isBusinessRoles } from "../../shared/utils/roles.js";
import { useApp } from "../../app/state/AppProvider.jsx";
import { safeNext } from "./utils/safeNext.js";
import { ForgotPassword } from "./components/ForgotPasswordDialog.jsx";

export function LoginPage({ query }) {
  // Lấy hàm đăng nhập và thông tin phiên hiện tại từ AppProvider.
  const { login, authed, isAdmin, roles } = useApp();

  // Trang cần đến sau khi đăng nhập.
  // safeNext xử lý giá trị next trước khi dùng để chuyển trang.
  const next = safeNext(query.get("next"));

  // identifier dùng chung cho tên đăng nhập hoặc email.
  const [form, setForm] = useState({ identifier: "", password: "" });

  // Lỗi của từng ô nhập và lỗi chung khi đăng nhập thất bại.
  const [errors, setErrors] = useState({});

  // Bật hoặc tắt hộp thoại quên mật khẩu.
  const [forgot, setForgot] = useState(false);

  // Dùng để khóa nút đăng nhập trong lúc chờ kết quả.
  const [busy, setBusy] = useState(false);

  // Nếu đã đăng nhập thì chuyển khỏi trang này.
  // Admin và các nhóm vận hành được đưa về trang theo vai trò.
  // Các trường hợp còn lại đi đến next.
  // replace tránh giữ lại trang đăng nhập này trong lịch sử điều hướng.
  useEffect(() => {
    if (authed) go(isAdmin || isOpsRoles(roles) || isBusinessRoles(roles) ? homeFor(roles) : next, { replace: true });
  }, [authed, isAdmin, roles, next]);

  const set = (k, v) => {
    // Chỉ cập nhật ô đang nhập, giữ nguyên giá trị của ô còn lại.
    setForm({ ...form, [k]: v });

    // Xóa toàn bộ thông báo lỗi cũ khi người dùng sửa thông tin.
    setErrors({});
  };

  const submit = async (e) => {
    // Không tải lại trang khi gửi form.
    e.preventDefault();

    // Kiểm tra dữ liệu trống trước khi gọi chức năng đăng nhập.
    const err = {};

    // Chuỗi chỉ có dấu cách cũng được xem là chưa nhập tài khoản.
    // trim ở đây chỉ phục vụ kiểm tra, không thay đổi dữ liệu trong form.
    if (!form.identifier.trim()) err.identifier = "Vui lòng nhập tên đăng nhập hoặc email.";

    // Không trim mật khẩu vì dấu cách có thể là một phần của mật khẩu.
    if (!form.password) err.password = "Vui lòng nhập mật khẩu.";

    // Có lỗi thì hiển thị ngay và dừng, chưa gọi login.
    if (Object.keys(err).length) return setErrors(err);

    // Khóa nút trước khi bắt đầu chờ kết quả đăng nhập.
    setBusy(true);
    const res = await login(form);
    setBusy(false);

    // Đăng nhập thất bại thì hiện lỗi chung ở đầu form.
    if (!res.ok) return setErrors({ form: res.error });

    // Xác định trang mặc định theo vai trò được trả về.
    // Nếu không có roles thì truyền mảng rỗng cho homeFor xử lý.
    const home = homeFor(res.roles || []);

    // Nếu home là overview thì đi đến next.
    // Với home khác, chỉ giữ next khi đường dẫn bắt đầu bằng home;
    // nếu không thì quay về trang mặc định của vai trò.
    // Đây là điều hướng giao diện, không thay thế kiểm tra quyền ở backend.
    go(home === "overview" ? next : next.startsWith(home) ? next : home);
  };

  // Giá trị các ô nhập được lấy từ form và cập nhật qua hàm set.
  // noValidate tắt kiểm tra mặc định của trình duyệt để dùng lỗi ở trên.
  // Nút quên mật khẩu có type="button" nên không gửi form.
  // Khi forgot = true, hộp thoại được hiển thị; onClose đặt lại thành false.
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
