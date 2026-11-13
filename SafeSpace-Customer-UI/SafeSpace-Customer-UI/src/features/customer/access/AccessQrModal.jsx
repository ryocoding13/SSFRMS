/**
 * ACCESS QR MODAL - HỘP THOẠI HIỂN THỊ MÃ QR VÀ MÃ PIN MỞ CỬA KHO (D22 / UC04)
 *
 * Nghiệp vụ D22:
 * - Cấp mã mở cửa không trạng thái (HMAC-SHA256) từ ContractId + CredentialId.
 * - Hiển thị mã QR dạng chuỗi 'SSQR-<contractId>-<hex>' và mã PIN dự phòng 8 chữ số dạng 'xxxx xxxx'.
 * - Kiểm tra điều kiện: Hợp đồng hiệu lực (ACTIVE/EXPIRING/OVERDUE) và đã nhận kho (HANDED_OVER).
 */
import React, { useEffect, useState } from "react";
import QrCode from "../../../shared/components/QrCode.jsx";
import { Button, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";
import { usableFromText } from "../../../shared/utils/access.js";
import "../../../shared/styles/customer-detail.css";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

/**
 * Modal hiển thị mã QR mở cửa và mã PIN dự phòng cho khách hàng.
 * @param {{ contract: Object, onClose: Function }} props
 */
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
      {/* #59: xem được mã trước ngày thuê nhưng chỉ mở cửa từ 00:00 ngày bắt đầu; đến ngày tự chuyển "Đang có hiệu lực" */}
      {a && (a.usable_now === false
        ? <div className="access-qr__state"><Tag tone="amber">Chưa đến ngày sử dụng</Tag><strong>{usableFromText(a.usable_from || a.valid_from || c.start_date)}</strong><span>Trước thời điểm này, QR và PIN chưa mở được cửa, kể cả khi bạn đã xem hoặc lưu mã.</span></div>
        : <div className="access-qr__state"><Tag tone="green">Đang có hiệu lực</Tag><span>Cửa giữ mở sau khi quét đến khi bạn bấm “Đóng cửa” trong Kho của tôi hoặc trên máy quét.</span></div>)}
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
      <p className="hint">Quét QR hoặc nhập PIN 6 số (chỉ gồm số 1–9) tại cửa kho. Chìa khóa vật lý nhận tại quầy. Chỉ mở được trong thời gian hiệu lực hợp đồng.</p>
      <div className="modal__actions modal__actions--full">
        <Button variant="outline" block onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}
