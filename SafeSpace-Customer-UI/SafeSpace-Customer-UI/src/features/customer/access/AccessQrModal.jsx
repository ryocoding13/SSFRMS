import React, { useEffect, useState } from "react";
import QrCode from "../../../shared/components/QrCode.jsx";
import { Button, Modal, Notice } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel } from "../../../shared/utils/format.js";
import { href, qs } from "../../../app/router.js";
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
    <Modal title={`QR mở cửa · Kho ${c.unit_number}`} onClose={onClose}>
      <p className="modal__text modal__text--sub">{where}</p>
      {state.status === "unsupported" ? (
        <Notice>Mã QR mở cửa đang được cơ sở kích hoạt. Trong lúc chờ, dùng thẻ ra vào đã nhận khi bàn giao hoặc liên hệ nhân viên trực.</Notice>
      ) : state.status === "error" ? (
        <Notice tone="error">{state.error}</Notice>
      ) : (
        <QrCode value={a?.code} title={a ? "QR mở cửa" : "Đang tạo mã…"} label={`QR mở cửa kho ${c.unit_number}`} caption={`Mã riêng cho hợp đồng ${c.contract_id}`} />
      )}
      {a && (
        <dl className="pay-rows">
          {a.backup && <div><dt>Mã dự phòng</dt><dd>{a.backup}</dd></div>}
          <div><dt>Ô kho</dt><dd>{a.unit || c.unit_number} · {a.unit_type || typeLabel(c.type)}</dd></div>
          <div><dt>Hiệu lực đến</dt><dd>{dateLabel(a.valid_until || c.end_date)}</dd></div>
        </dl>
      )}
      <p className="hint">Đưa mã vào máy quét ở cửa kho. Nếu không quét được, nhập mã dự phòng. Mã hết hiệu lực khi trả kho hoặc hợp đồng hết hạn.</p>
      {a && (
        <a className="link-btn" href={href(`door${qs({ unit: a.unit || c.unit_number, code: a.code })}`)}>Mô phỏng quét ở cửa kho →</a>
      )}
      <div className="modal__actions modal__actions--full">
        <Button variant="outline" block onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}
