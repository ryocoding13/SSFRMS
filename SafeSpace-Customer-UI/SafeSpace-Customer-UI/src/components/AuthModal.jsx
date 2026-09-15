import React, { useState } from "react";
import { Modal, Field, Button, Icon, Notice } from "./UI";
import { authService } from "../services";

export default function AuthModal({ onClose, onAuthSuccess }) {
  const [tab, setTab] = useState("login"); // 'login' | 'register'
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await authService.login(form.username.trim(), form.password);
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password || !form.email.trim() || !form.fullName.trim()) {
      setError("Vui lòng điền đầy đủ các trường bắt buộc (*).");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await authService.register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
      });
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={tab === "login" ? "Đăng nhập SafeSpace" : "Tạo tài khoản khách hàng"}
      onClose={onClose}
    >
      <div className="ss-modal-content">
        <div className="ss-tabs ss-auth-tabs">
          <button
            type="button"
            className={tab === "login" ? "active" : ""}
            onClick={() => {
              setTab("login");
              setError("");
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={tab === "register" ? "active" : ""}
            onClick={() => {
              setTab("register");
              setError("");
            }}
          >
            Đăng ký tài khoản
          </button>
        </div>

        {error && (
          <div className="ss-toast error" style={{ position: "relative", marginBottom: "1rem" }} role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} noValidate>
            <Field label="Tên đăng nhập *">
              <input
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="Nhập tên đăng nhập"
                required
              />
            </Field>

            <Field label="Mật khẩu *">
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
            </Field>

            <div className="ss-form-actions">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                <Icon name="arrow" size={16} />
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} noValidate>
            <Field label="Họ và tên *">
              <input
                type="text"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn A"
                required
              />
            </Field>

            <Field label="Tên đăng nhập *">
              <input
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="Ví dụ: customer01"
                required
              />
            </Field>

            <Field label="Email *">
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="email@domain.com"
                required
              />
            </Field>

            <Field label="Mật khẩu *">
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
              />
            </Field>

            <Field label="Số điện thoại">
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="0901234567"
              />
            </Field>

            <div className="ss-form-actions">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Đang tạo tài khoản..." : "Đăng ký ngay"}
                <Icon name="arrow" size={16} />
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
