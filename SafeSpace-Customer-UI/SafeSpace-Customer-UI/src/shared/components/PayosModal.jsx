import React, { useCallback, useEffect, useState } from "react";
import { money } from "../utils/format.js";
import { useApp } from "../../app/state/AppProvider.jsx";
import QrCode from "./QrCode.jsx";
import { Button, Modal, Notice } from "./UI.jsx";

const POLL_MS = 3000;

// C11q — Popup thanh toán QR PayOS cho một khoản (gia hạn đã duyệt). Hỏi backend định kỳ, tự đóng khi đã trả.
export default function PayosModal({ target, title, subtitle, onPaid, onClose }) {
  const { services } = useApp();
  const [checkout, setCheckout] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | unsupported | error | paid
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    const res = await services.startPayos(target);
    if (res.ok) {
      setCheckout(res.checkout);
      setState(res.checkout.paid ? "paid" : "ready");
    } else if (res.unsupported) setState("unsupported");
    else {
      setError(res.error);
      setState("error");
    }
  }, [services, target]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== "ready") return undefined;
    let alive = true;
    const timer = setInterval(async () => {
      const res = await services.checkPaid(target);
      if (alive && res.ok && res.paid) setState("paid");
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state === "paid") onPaid?.();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = checkout?.amount ?? target.item.amount;
  return (
    <Modal title={title} onClose={onClose}>
      {subtitle && <p className="modal__text modal__text--sub">{subtitle}</p>}
      {state === "unsupported" ? (
        <Notice>Thanh toán QR cho khoản này đang tạm gián đoạn. Bạn có thể thanh toán tại quầy của cơ sở hoặc thử lại sau.</Notice>
      ) : state === "error" ? (
        <Notice tone="error">
          {error}{" "}
          <button type="button" className="link-btn" onClick={load}>Thử lại</button>
        </Notice>
      ) : (
        <QrCode
          value={checkout?.qr}
          title={state === "loading" ? "Đang tạo mã QR…" : "Mã QR thanh toán"}
          label="Mã QR thanh toán"
          caption={checkout?.url ? <a href={checkout.url} target="_blank" rel="noreferrer">Mở trang thanh toán PayOS ↗</a> : "Quét bằng ứng dụng ngân hàng"}
        />
      )}
      <dl className="pay-rows">
        <div><dt>Số tiền</dt><dd className="pay-rows__amount">{money(amount)}</dd></div>
        {checkout?.description && <div><dt>Nội dung chuyển</dt><dd>{checkout.description}</dd></div>}
        <div>
          <dt>Trạng thái</dt>
          <dd className={state === "paid" ? "ok" : "warn"} aria-live="polite">{state === "paid" ? "Đã thanh toán" : "Đang chờ thanh toán…"}</dd>
        </div>
      </dl>
      <p className="hint">Hệ thống tự xác nhận khi nhận được tiền, bạn không cần bấm gì thêm. Đóng cửa sổ này thì khoản vẫn chờ thanh toán.</p>
      <div className="modal__actions modal__actions--full">
        <Button variant="outline" block onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}
