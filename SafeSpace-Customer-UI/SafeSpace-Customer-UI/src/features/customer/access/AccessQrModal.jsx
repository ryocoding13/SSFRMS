import React, { useEffect, useState } from "react";
import QrCode from "../../../shared/components/QrCode.jsx";
import { Button, Modal, Notice } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

export function AccessQrModal({ c, facility, onClose }) {
  const { services } = useApp();
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    services.accessQr(c).then((res) => {
      if (!alive) return;
      if (res.ok) setState({ status: "ready", access: res.access });
      else setState({ status: res.unsupported ? "unsupported" : "error", error: res.error });
    });
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = state.access;
  const where = [facility.name, c.location].filter(Boolean).join(" · ");
  return (
    <Modal title="Mở kho · QR, PIN & chìa khóa" onClose={onClose} size="access-qr">
      <p className="modal__text modal__text--sub">{where}</p>
      {state.status === "unsupported" ? (
        <Notice>Mã QR mở cửa đang được cơ sở kích hoạt. Vui lòng liên hệ nhân viên trực để kiểm tra hợp đồng.</Notice>
      ) : state.status === "error" ? (
        <Notice tone="error">{state.error}</Notice>
      ) : (
        <QrCode value={a?.code} title={a ? "QR mở cửa" : "Đang tạo mã…"} label={`QR mở cửa kho ${c.unit_number}`} size={208} />
      )}
      {a && (
        <dl className="pay-rows">
          {a.backup && <div><dt>PIN 6 số</dt><dd>{a.backup}</dd></div>}
          <div><dt>Ô kho</dt><dd>{a.unit || c.unit_number} · {a.unit_type || typeLabel(c.type)}</dd></div>
          <div><dt>Hiệu lực từ</dt><dd>{dateLabel(a.valid_from || c.start_date)} · 00:00</dd></div>
          <div><dt>Hiệu lực đến (không gồm)</dt><dd>{dateLabel(a.valid_until || c.end_date)}</dd></div>
          <div><dt>Chìa khóa vật lý</dt><dd>Nhận tại quầy cơ sở</dd></div>
        </dl>
      )}
      <p className="hint">Quét QR hoặc nhập PIN 6 số tại cửa kho. Chìa khóa vật lý nhận tại quầy. Chỉ mở được trong thời gian hiệu lực hợp đồng.</p>
      <div className="modal__actions modal__actions--full">
        <Button variant="outline" block onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}
