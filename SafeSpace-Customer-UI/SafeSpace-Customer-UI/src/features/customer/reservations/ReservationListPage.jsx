import React, { useEffect, useState } from "react";
import { EmptyInline } from "../../../shared/components/Inline.jsx";
import { Button, Field, LinkButton, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { dateLabel, money, shortCode } from "../../../shared/utils/format.js";
import { shortName } from "../../../shared/hooks/useBrowserEvents.js";
import { href } from "../../../app/router.js";
import { RESERVATION_STATUS } from "../../../shared/utils/status.js";
import { facilityOf, sortedReservations } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

// Đơn khách tự huỷ được: chờ thanh toán, hoặc đã thanh toán nhưng chưa nhận kho (cùng quy tắc backend:
// ReservationService.CancelReservationAsync nhận PENDING_PAYMENT / CONFIRMED)
export function canCancel(data, r) {
  if (r.api_status) return ["PENDING_PAYMENT", "CONFIRMED", "PAID"].includes(r.api_status) && r.status !== "CANCELLED";
  if (r.status === "PENDING_PAYMENT") return true;
  if (r.status !== "CONFIRMED") return false;
  return !data.contracts.some((c) => c.reservation_id === r.reservation_id && c.handed_over);
}

const statusLabel = (r) => (r.status === "CANCELLED" && r.refund_status === "PENDING" ? "Đã huỷ · Đang hoàn tiền" : RESERVATION_STATUS[r.status][0]);

// C14a — Hộp thoại huỷ đơn & hoàn tiền
function CancelDialog({ r, onDone, onClose }) {
  const { data, dispatch, services } = useApp();
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = r.status === "CONFIRMED";
  const f = facilityOf(data, r.facility_id, r.facility_name);
  const pickup = data.appointments.find((a) => a.reservation_id === r.reservation_id && a.kind === "CHECK_IN");

  useEffect(() => {
    let alive = true;
    if (paid) services?.cancelPreview(r).then((res) => alive && setPreview(res.ok ? res.preview : false));
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await dispatch("CANCEL_RESERVATION", { reservation_id: r.reservation_id, reason: reason.trim() || "Khách hàng huỷ đặt chỗ" });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone({ id: r.reservation_id, refund: res.refund || preview?.refund || 0 });
  };

  return (
    <Modal title={`Huỷ đơn ${r.reservation_id}?`} onClose={onClose} size="md">
      <p className="modal__text modal__text--sub">
        {[shortName(f) ? `SafeSpace ${shortName(f)}` : f.name, `${r.months} tháng`, pickup ? `Lịch nhận kho ${dateLabel(pickup.date)}` : null].filter(Boolean).join(" · ")}
      </p>
      {paid ? (
        <div className="refund-box">
          <dl className="pay-rows">
            <div><dt>Đã thanh toán (tiền thuê {r.months} tháng + cọc)</dt><dd>{money(preview?.paid ?? r.initial_total)}</dd></div>
            <div>
              <dt>Phí huỷ theo chính sách huỷ</dt>
              <dd>{preview ? `− ${money(preview.fee)}` : preview === false ? "Theo chính sách hiện hành" : "Đang tính…"}</dd>
            </div>
            <div className="pay-rows__total">
              <dt>Số tiền được hoàn</dt>
              <dd className="pay-rows__amount">{preview ? money(preview.refund) : preview === false ? "Cơ sở xác nhận sau khi huỷ" : "Đang tính…"}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <Notice>Đơn chưa thanh toán nên huỷ không phát sinh phí.</Notice>
      )}
      <Field label="Lý do huỷ (không bắt buộc)">
        <input maxLength={255} value={reason} placeholder="Ví dụ: Đổi kế hoạch chuyển nhà" onChange={(e) => setReason(e.target.value)} />
      </Field>
      {paid && <p className="hint">Tiền hoàn về tài khoản bạn đã dùng để thanh toán qua mã QR. Huỷ xong, kho được trả lại cho khách khác đặt.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" onClick={onClose}>Giữ đơn</Button>
        <Button variant="danger" onClick={submit} disabled={busy}>{busy ? "Đang huỷ…" : "Huỷ đơn"}</Button>
      </div>
    </Modal>
  );
}

// C14 — Đơn đặt chỗ của tôi (C14b sau khi huỷ)
export default function ReservationListPage() {
  const { data } = useApp();
  const [cancelling, setCancelling] = useState(null);
  const [done, setDone] = useState(null);
  const list = sortedReservations(data);
  const latest = list[0];
  const cancellable = list.find((r) => canCancel(data, r));
  return (
    <main className="container page">
      <PageHeader title="Đơn đặt chỗ của tôi" description="Theo dõi thanh toán, phân bổ kho và lịch nhận theo từng đơn." />
      {list.length === 0 ? (
        <EmptyInline text="Bạn chưa có đơn đặt chỗ nào." cta="Tìm & đặt kho" to="find" />
      ) : (
        <>
          <div className="table-wrap panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đặt chỗ</th>
                  <th>Cơ sở / kỳ thuê</th>
                  <th>Tổng ban đầu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.reservation_id}>
                    <td>
                      <a href={href(`reservations/${r.reservation_id}`)} title={r.reservation_id}>{r.reservation_id}</a>
                    </td>
                    <td>{shortName(facilityOf(data, r.facility_id, r.facility_name))} · {r.months} tháng</td>
                    <td>{money(r.initial_total)}</td>
                    <td>{statusLabel(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack stack--col stack--start">
            <LinkButton to={`reservations/${latest.reservation_id}`}>Xem đơn {shortCode(latest.reservation_id)}</LinkButton>
            {done ? (
              <Notice tone="success">
                Đã huỷ đơn {done.id}.{done.refund ? ` Số tiền ${money(done.refund)} đang được hoàn về tài khoản bạn đã thanh toán.` : ""}
              </Notice>
            ) : (
              cancellable && (
                <>
                  <Button variant="outline" className="btn--danger-text" onClick={() => setCancelling(cancellable)}>Huỷ đơn {shortCode(cancellable.reservation_id)}</Button>
                  <p className="hint">Chỉ huỷ được đơn chưa nhận kho. Số tiền hoàn tính theo chính sách huỷ hiện hành.</p>
                </>
              )
            )}
            <LinkButton to="find" variant="outline">Đặt thêm kho</LinkButton>
          </div>
        </>
      )}
      {cancelling && (
        <CancelDialog
          r={cancelling}
          onClose={() => setCancelling(null)}
          onDone={(res) => {
            setCancelling(null);
            setDone(res);
          }}
        />
      )}
    </main>
  );
}
