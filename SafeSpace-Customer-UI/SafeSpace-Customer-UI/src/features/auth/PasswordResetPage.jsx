/**
 * PASSWORD RESET PAGE - QUÊN MẬT KHẨU 3 BƯỚC (F43 · Figma QMK-1..4 · 13/11)
 *
 * 1. Email: kiểm tra trống / sai định dạng riêng, gọi API gửi mã OTP.
 *    Câu thông báo sau khi gửi mã lấy nguyên từ máy chủ (việc báo email chưa đăng ký do mục 30 của Mai quyết định).
 * 2. Mã xác nhận: 6 ô số, đếm ngược gửi lại mã, đổi email.
 * 3. Mật khẩu mới: tối thiểu 8 ký tự, nhập lại khớp; gửi mã + mật khẩu lên API.
 *    Mã sai/hết hạn → quay lại bước 2 và giữ mật khẩu đã nhập.
 * 4. Xong: nút Đăng nhập.
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, Field, LinkButton, Notice } from "../../shared/components/UI.jsx";
import { href } from "../../app/router.js";
import { emailError, maskEmail, passwordErrors } from "./passwordResetRules.js";
import { passwordResetApi } from "./api/passwordResetApi.js";

const CODE_LENGTH = 6;

/** 6 ô nhập mã; dán cả dãy số vẫn điền đủ. */
function CodeBoxes({ value, onChange, disabled, invalid }) {
  const refs = useRef([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] || "");
  const put = (index, raw) => {
    const clean = String(raw).replace(/\D/g, "");
    if (!clean) { onChange(value.slice(0, index) + value.slice(index + 1)); return; }
    const next = (value.slice(0, index) + clean + value.slice(index + clean.length)).slice(0, CODE_LENGTH);
    onChange(next);
    refs.current[Math.min(index + clean.length, CODE_LENGTH - 1)]?.focus();
  };
  const key = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) { refs.current[index - 1]?.focus(); onChange(value.slice(0, index - 1)); }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus();
  };
  return <div className={`otp-boxes${invalid ? " otp-boxes--invalid" : ""}`} role="group" aria-label="Mã xác nhận">
    {digits.map((d, i) => <input key={i} ref={el => { refs.current[i] = el; }} aria-label={`Số thứ ${i + 1} của mã xác nhận`}
      inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={CODE_LENGTH} disabled={disabled} value={d}
      onChange={e => put(i, e.target.value)} onKeyDown={e => key(i, e)} onFocus={e => e.target.select()} />)}
  </div>;
}

export function PasswordResetPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const waitSeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const masked = maskEmail(email);

  useEffect(() => {
    if (!retryAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  function delayRetry(seconds) {
    const current = Date.now();
    setNow(current);
    setRetryAt(current + Math.max(1, Math.min(Number(seconds) || 60, 3600)) * 1000);
  }

  async function sendCode(e) {
    e?.preventDefault();
    if (pending.current || waitSeconds > 0) return;
    const err = emailError(email);
    if (err) return setErrors({ email: err });
    pending.current = true;
    setBusy(true);
    setErrors({});
    try {
      const response = await passwordResetApi.request(email.trim());
      setDemoCode(response.demoCode || "");
      setMessage(response.message || "");
      setCode("");
      delayRetry(response.retryAfterSeconds);
      setStep("code");
    } catch (ex) {
      setErrors({ form: ex.message });
      if (ex.status === 429) delayRetry(ex.data?.retryAfterSeconds);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function checkCode(e) {
    e.preventDefault();
    if (!code) return setErrors({ code: "Vui lòng nhập mã xác nhận." });
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) return setErrors({ code: "Mã xác nhận gồm đủ 6 chữ số." });
    setErrors({});
    setStep("password");
  }

  async function reset(e) {
    e.preventDefault();
    if (pending.current) return;
    const errs = passwordErrors(password, confirm);
    if (Object.keys(errs).length) return setErrors(errs);
    pending.current = true;
    setBusy(true);
    setErrors({});
    try {
      await passwordResetApi.confirm({ email: email.trim(), code, newPassword: password });
      setPassword(""); setConfirm(""); setCode(""); setDemoCode("");
      setStep("done");
    } catch (ex) {
      // Mã sai/hết hạn: quay lại bước nhập mã, giữ mật khẩu đã nhập.
      if (ex.status === 400 || /mã/i.test(ex.message || "")) { setStep("code"); setErrors({ code: "Mã chưa đúng hoặc đã hết hạn. Nhập mã mới nhất hoặc bấm Gửi lại mã." }); }
      else setErrors({ form: ex.message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const back = (target) => { setErrors({}); setStep(target); };

  return <main className="auth password-reset">
    {step === "email" && <form className="panel auth__card" onSubmit={sendCode} noValidate>
      <h1>Quên mật khẩu</h1>
      <p className="lead">Nhập email đã đăng ký tài khoản. Chúng tôi gửi mã xác nhận 6 số để bạn đặt mật khẩu mới.</p>
      {errors.form && <Notice tone="error">{errors.form}</Notice>}
      <Field label="Email *" error={errors.email}>
        <input type="email" autoComplete="email" placeholder="ban@vidu.com" disabled={busy} value={email} onChange={e => { setEmail(e.target.value); setErrors({}); }} />
      </Field>
      <Button type="submit" block disabled={busy || waitSeconds > 0}>{busy ? "Đang gửi mã…" : waitSeconds > 0 ? `Gửi lại sau ${waitSeconds} giây` : "Gửi mã xác nhận"}</Button>
      <p className="auth__note">Tài khoản nhân viên, quản lý và quản trị do hệ thống cấp: liên hệ quản trị hệ thống để đặt lại mật khẩu.</p>
      <p className="auth__switch">Nhớ ra mật khẩu? <a href={href("login")}>Đăng nhập</a></p>
    </form>}

    {step === "code" && <form className="panel auth__card" onSubmit={checkCode} noValidate>
      <h1>Nhập mã xác nhận</h1>
      <p className="lead">{message || `Nếu email ${masked} đã đăng ký, mã 6 số đã được gửi tới hộp thư. Kiểm tra cả thư rác.`} Mã có hiệu lực 10 phút.</p>
      {demoCode && <Notice>Chỉ trong API mô phỏng · Không gửi email thật. Mã thử nghiệm: {demoCode}</Notice>}
      {errors.form && <Notice tone="error">{errors.form}</Notice>}
      <div className={`field${errors.code ? " field--invalid" : ""}`}>
        <span className="field__label">Mã xác nhận (6 số) *</span>
        <CodeBoxes value={code} onChange={v => { setCode(v); setErrors({}); }} disabled={busy} invalid={Boolean(errors.code)} />
        {errors.code && <p className="field__error" role="alert">{errors.code}</p>}
      </div>
      <Button type="submit" block disabled={busy}>Tiếp tục</Button>
      <p className="password-reset__resend">
        <span>Chưa nhận được mã?</span>
        {waitSeconds > 0 ? <span className="password-reset__wait">Gửi lại sau {waitSeconds} giây</span> : <button type="button" className="link-btn" disabled={busy} onClick={() => sendCode()}>Gửi lại mã</button>}
      </p>
      <p className="auth__switch">Nhập sai email? <button type="button" className="link-btn" disabled={busy} onClick={() => { setCode(""); setDemoCode(""); back("email"); }}>Đổi email</button></p>
    </form>}

    {step === "password" && <form className="panel auth__card" onSubmit={reset} noValidate>
      <h1>Đặt mật khẩu mới</h1>
      <p className="lead">Tạo mật khẩu mới cho tài khoản {masked}. Mã xác nhận được kiểm tra khi bạn bấm Đặt lại mật khẩu.</p>
      {errors.form && <Notice tone="error">{errors.form}</Notice>}
      <Field label="Mật khẩu mới *" error={errors.password} hint={!errors.password && password.length >= 8 ? "✓ Tối thiểu 8 ký tự" : "Tối thiểu 8 ký tự"}>
        <input type="password" autoComplete="new-password" disabled={busy} value={password} onChange={e => { setPassword(e.target.value); setErrors({}); }} />
      </Field>
      <Field label="Nhập lại mật khẩu mới *" error={errors.confirm}>
        <input type="password" autoComplete="new-password" disabled={busy} value={confirm} onChange={e => { setConfirm(e.target.value); setErrors({}); }} />
      </Field>
      <Button type="submit" block disabled={busy}>{busy ? "Đang cập nhật…" : "Đặt lại mật khẩu"}</Button>
      <p className="auth__switch">Nhập sai mã? <button type="button" className="link-btn" disabled={busy} onClick={() => back("code")}>Quay lại bước nhập mã</button></p>
    </form>}

    {step === "done" && <section className="panel auth__card">
      <h1>Đã đặt lại mật khẩu</h1>
      <p className="lead">Mật khẩu của tài khoản {masked} đã được cập nhật. Đăng nhập bằng mật khẩu mới để tiếp tục.</p>
      <LinkButton to="login" block>Đăng nhập</LinkButton>
      <p className="auth__note">Không phải bạn đổi mật khẩu? Gọi hotline 0825123676 để được hỗ trợ.</p>
    </section>}
  </main>;
}
