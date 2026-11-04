import React, { useEffect, useRef, useState } from "react";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../shared/components/UI.jsx";
import { isEmail } from "../../shared/utils/format.js";
import { passwordResetApi } from "./api/passwordResetApi.js";

export function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const waitSeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  function delayRetry(seconds) {
    const current = Date.now();
    setNow(current);
    setRetryAt(current + Math.max(1, Math.min(Number(seconds) || 60, 3600)) * 1000);
  }

  async function sendCode() {
    if (pending.current || waitSeconds > 0) return;
    if (!isEmail(email.trim())) return setError("Nhập email hợp lệ.");
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await passwordResetApi.request(email.trim());
      setDemoCode(response.demoCode || "");
      setMessage(response.message || "Nếu email đã đăng ký, bạn sẽ nhận được mã xác nhận. Vui lòng kiểm tra cả thư rác.");
      setCode("");
      delayRetry(response.retryAfterSeconds);
      setStep("code");
    } catch (e) {
      setError(e.message);
      if (e.status === 429) delayRetry(e.data?.retryAfterSeconds);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function reset(event) {
    event.preventDefault();
    if (pending.current) return;
    if (!/^\d{6}$/.test(code) || password.length < 8 || password !== confirm)
      return setError("Nhập mã 6 số, mật khẩu tối thiểu 8 ký tự và xác nhận khớp nhau.");
    if (new TextEncoder().encode(password).length > 72)
      return setError("Mật khẩu mới vượt quá 72 byte UTF-8. Vui lòng dùng mật khẩu ngắn hơn.");
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await passwordResetApi.confirm({ email: email.trim(), code, newPassword: password });
      setPassword("");
      setConfirm("");
      setCode("");
      setDemoCode("");
      setStep("done");
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <main className="container page workflow-page">
    <PageHeader title={step === "done" ? "Đã đặt lại mật khẩu" : "Đặt lại mật khẩu"} description="Xác nhận bằng mã được gửi tới email đăng ký." />
    <section className="panel form-card">
      {step === "email" ? <form onSubmit={e => { e.preventDefault(); sendCode(); }}>
        <Field label="Email đã đăng ký"><input type="email" autoComplete="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Button type="submit" disabled={busy || waitSeconds > 0}>{waitSeconds > 0 ? `Gửi lại sau ${waitSeconds}s` : "Gửi mã xác nhận"}</Button>
      </form> : step === "code" ? <form onSubmit={reset}>
        <p>{message}</p>
        <p>Mã có hiệu lực trong 10 phút. Chỉ mã được gửi gần nhất mới sử dụng được.</p>
        {demoCode && <Notice>Chỉ trong API mô phỏng · Không gửi email thật. Mã thử nghiệm: {demoCode}</Notice>}
        <Field label="Mã xác nhận"><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" disabled={busy} value={code} onChange={e => setCode(e.target.value)} /></Field>
        <Field label="Mật khẩu mới"><input type="password" autoComplete="new-password" disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <Field label="Nhập lại mật khẩu mới"><input type="password" autoComplete="new-password" disabled={busy} value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
        <div className="stack">
          <Button type="submit" disabled={busy}>Đặt lại mật khẩu</Button>
          <Button variant="outline" disabled={busy || waitSeconds > 0} onClick={sendCode}>{waitSeconds > 0 ? `Gửi lại mã sau ${waitSeconds}s` : "Gửi lại mã"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => { setStep("email"); setError(""); setCode(""); setDemoCode(""); }}>Nhập sai email?</Button>
        </div>
      </form> : <Notice tone="success">Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <LinkButton to="login" variant="outline">Về đăng nhập</LinkButton>
    </section>
  </main>;
}
