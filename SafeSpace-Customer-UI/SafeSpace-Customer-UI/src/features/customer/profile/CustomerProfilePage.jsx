import React, { useEffect, useRef, useState } from "react";
import { Button, Dialog, Field, PageHeader } from "../../../shared/components/UI.jsx";
import { go } from "../../../app/router.js";
import { maskPhone } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

export default function CustomerProfilePage() {
  const { data, dispatch, logout, supports } = useApp();
  const { user } = data;
  const [name, setName] = useState(user.full_name);
  const [nameError, setNameError] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [dialog, setDialog] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const namePending = useRef(false);
  const passwordPending = useRef(false);
  useEffect(() => setName(user.full_name), [user.user_id, user.full_name]);

  const saveName = async (e) => {
    e.preventDefault();
    if (namePending.current) return;
    const fullName = name.trim();
    if (fullName.length < 2 || fullName.length > 100) return setNameError("Tên hiển thị cần từ 2 đến 100 ký tự.");
    namePending.current = true;
    setSavingName(true);
    setNameError("");
    try {
      const res = await dispatch("UPDATE_NAME", { name: fullName });
      if (!res.ok) return setNameError(res.error);
      setName(res.name);
      setDialog({ title: "Đã lưu tên", message: "Tên hiển thị của bạn đã được cập nhật." });
    } finally {
      namePending.current = false;
      setSavingName(false);
    }
  };

  const setPwField = (k, v) => {
    setPw({ ...pw, [k]: v });
    setPwErrors({});
  };
  const changePassword = async (e) => {
    e.preventDefault();
    if (passwordPending.current) return;
    const err = {};
    if (!pw.current) err.current = "Vui lòng nhập mật khẩu hiện tại.";
    if (!pw.next) err.next = "Vui lòng nhập mật khẩu mới.";
    else if (pw.next.length < 8) err.next = "Mật khẩu mới cần ít nhất 8 ký tự.";
    else if (pw.next === pw.current) err.next = "Mật khẩu mới cần khác mật khẩu hiện tại.";
    if (!pw.confirm) err.confirm = "Vui lòng nhập lại mật khẩu mới.";
    else if (pw.next && pw.confirm !== pw.next) {
      err.confirm = "Mật khẩu xác nhận chưa khớp";
      err.confirmHint = "Nhập lại đúng mật khẩu mới để tiếp tục.";
    }
    if (!pw.current && !pw.next && !pw.confirm) {
      err.summary = "Bạn chưa nhập đủ thông tin";
      err.summaryHint = "Vui lòng nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.";
    }
    if (Object.keys(err).length) return setPwErrors(err);
    passwordPending.current = true;
    setSavingPassword(true);
    setPwErrors({});
    try {
      const res = await dispatch("CHANGE_PASSWORD", { current: pw.current, next: pw.next });
      if (!res.ok) return setPwErrors(res.code === "BAD_PASSWORD" ? { current: res.error } : { form: res.error });
      setPw({ current: "", next: "", confirm: "" });
      setDialog({ title: "Đổi mật khẩu thành công", message: "Mật khẩu mới của bạn đã được cập nhật." });
    } finally {
      passwordPending.current = false;
      setSavingPassword(false);
    }
  };

  return (
    <main className="container page">
      <PageHeader title="Tài khoản của tôi" description="Quản lý tên đăng nhập, tên hiển thị, thông tin liên hệ và mật khẩu." />
      <div className="grid grid--2">
        <form className="panel form-card" onSubmit={saveName} noValidate>
          <h2>Thông tin cá nhân</h2>
          <Field label="Tên tài khoản (hiển thị)" error={nameError}>
            <input autoComplete="name" maxLength={100} disabled={savingName} value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} />
          </Field>
          <Field label="Tên đăng nhập">
            <input readOnly value={user.username || ""} />
          </Field>
          <Field label="Email">
            <input readOnly value={user.email} />
          </Field>
          <Field label="Số điện thoại">
            <input readOnly value={maskPhone(user.phone)} />
          </Field>
          <h3>Thông báo</h3>
          <p className="muted">Nhận nhắc lịch hẹn, hạn hợp đồng và cập nhật thanh toán trong ứng dụng.</p>
          <Button type="submit" disabled={savingName}>{savingName ? "Đang lưu…" : "Lưu tên tài khoản"}</Button>
        </form>

        <form className={`panel form-card password-form${pwErrors.summary ? " password-form--missing" : ""}`} onSubmit={changePassword} noValidate>
          <h2>Đổi mật khẩu</h2>
          <Field label="Mật khẩu hiện tại" error={pwErrors.current}>
            <input type="password" placeholder="Nhập mật khẩu hiện tại" autoComplete="current-password" disabled={savingPassword} value={pw.current} onChange={(e) => setPwField("current", e.target.value)} />
          </Field>
          <Field label="Mật khẩu mới" error={pwErrors.next}>
            <input type="password" placeholder="Nhập mật khẩu mới" autoComplete="new-password" disabled={savingPassword} value={pw.next} onChange={(e) => setPwField("next", e.target.value)} />
          </Field>
          <Field label="Xác nhận mật khẩu mới" error={pwErrors.confirm}>
            <input type="password" placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" disabled={savingPassword} value={pw.confirm} onChange={(e) => setPwField("confirm", e.target.value)} />
          </Field>
          {pwErrors.confirmHint && <p className="field__error field__error--plain">{pwErrors.confirmHint}</p>}
          {pwErrors.summary && <><h3 className="password-error">{pwErrors.summary}</h3><p className="password-error">{pwErrors.summaryHint}</p></>}
          {!Object.keys(pwErrors).length && <><h3>Xác nhận để tránh nhập sai</h3><p className="muted">Mật khẩu mới và phần xác nhận phải giống nhau.</p></>}
          {!supports.changePassword && <p className="hint">Đổi mật khẩu đang tạm ngưng trên hệ thống. Liên hệ quản trị viên SafeSpace nếu cần đặt lại mật khẩu.</p>}
          {pwErrors.form && <p className="field__error field__error--plain">{pwErrors.form}</p>}
          <Button type="submit" disabled={!supports.changePassword || savingPassword}>{savingPassword ? "Đang cập nhật…" : "Cập nhật mật khẩu"}</Button>
        </form>
      </div>
      <Button
        variant="outline"
        className="logout"
        onClick={async () => {
          await logout();
          go("home");
        }}
      >
        Đăng xuất
      </Button>
      {dialog && <Dialog {...dialog} onClose={() => setDialog(null)} />}
    </main>
  );
}
