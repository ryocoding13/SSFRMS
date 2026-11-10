/**
 * DOOR SCANNER PAGE - MÔ PHỎNG THIẾT BỊ MÁY QUÉT CỬA KHO TẠI CƠ SỞ (C07q / C07r / D21)
 *
 * Mô phỏng thiết bị IoT ở cửa cơ sở:
 * - Cho phép nhập hoặc quét mã QR / mã PIN dự phòng 8 chữ số (hỗ trợ có hoặc không có dấu cách).
 * - Gọi POST /api/access/scan (công khai không cần đăng nhập).
 * - Hiển thị trạng thái cửa mở (OPEN - đèn xanh) hoặc từ chối (DENIED - đèn đỏ) kèm lý do.
 */
import React, { useEffect, useState } from "react";
import { Button, Field, Icon, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

// C07r1 / C07r2 — Mô phỏng máy quét QR ở cửa kho (D21: mô phỏng, không dùng thiết bị thật).
// Nhận mã từ QR mở cửa (C07q) hoặc PIN 6 số, gọi POST /api/access/scan, hiện "Mở cửa" / "Từ chối".
export default function DoorScannerPage({ query }) {
  const { services } = useApp();
  const unit = query.get("unit") || "";
  const [code, setCode] = useState(query.get("code") || "");
  const [result, setResult] = useState(null);
  const [state, setState] = useState("idle"); // idle | busy | unsupported | error
  const [error, setError] = useState("");

  const scan = async (value = code) => {
    if (!String(value).trim()) return setError("Đưa mã QR vào máy quét hoặc nhập PIN 6 số.");
    setState("busy");
    setError("");
    const res = await services.scan(value, unit);
    if (res.ok) {
      setResult(res.scan);
      setState("idle");
    } else if (res.unsupported) setState("unsupported");
    else {
      setState("error");
      setError(res.error);
    }
  };

  // Mở từ "Mô phỏng quét ở cửa kho" (C07q) có sẵn mã → quét ngay; đổi đường dẫn thì về màn chờ quét
  const incoming = query.get("code") || "";
  useEffect(() => {
    setResult(null);
    setCode(incoming);
    setState("idle");
    setError("");
    if (incoming) scan(incoming);
  }, [incoming, unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const head = `Cửa kho ${result?.unit || unit || ""} · Máy quét`.replace(/\s+·/, " ·");
  if (result) {
    const open = result.result === "OPEN";
    return (
      <main className="result door">
        <section className={`panel door__card door__card--${open ? "open" : "denied"}`} aria-live="assertive">
          <span className="door__icon"><Icon name={open ? "check" : "close"} size={34} /></span>
          <p className="door__head">{head}</p>
          <h1>{open ? "Mở cửa" : "Từ chối"}</h1>
          {open ? (
            <p>
              {[result.customer, result.contract].filter(Boolean).join(" · ")}
              <br />
              {dateTimeLabel(result.at)} · Đã ghi nhật ký ra vào
            </p>
          ) : (
            <p>
              {result.reason}
              <br />
              Liên hệ nhân viên cơ sở nếu cần hỗ trợ.
            </p>
          )}
          <Button variant="outline" onClick={() => { setResult(null); setCode(""); }}>Quay lại</Button>
        </section>
      </main>
    );
  }
  return (
    <main className="result door">
      <form className="panel door__card" onSubmit={(e) => { e.preventDefault(); scan(); }}>
        <span className="door__icon door__icon--idle"><Icon name="qr" size={30} /></span>
        <p className="door__head">{head}</p>
        <h1>Đưa mã QR vào máy quét</h1>
        <p className="muted">Mở "Mở cửa kho" trong tài khoản SafeSpace rồi đưa mã QR vào máy quét. Không quét được thì nhập PIN 6 số.</p>
        <Field label="Mã QR hoặc PIN 6 số" error={error}>
          <input value={code} autoComplete="off" placeholder="Ví dụ: 482193" onChange={(e) => { setCode(e.target.value); setError(""); }} />
        </Field>
        {state === "unsupported" && <Notice>Máy quét chưa kết nối được hệ thống mở cửa. Vui lòng liên hệ nhân viên cơ sở.</Notice>}
        <Button type="submit" block disabled={state === "busy"}>{state === "busy" ? "Đang kiểm tra…" : "Quét mã"}</Button>
      </form>
    </main>
  );
}
