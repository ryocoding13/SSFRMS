import React, { useEffect, useState } from "react";
import { EmptyInline } from "../../../shared/components/Inline.jsx";
import { Button, Field, LinkButton, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { dateLabel, money, shortCode } from "../../../shared/utils/format.js";
import { shortName } from "../../../shared/hooks/useBrowserEvents.js";
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

// C14b/C14c — đơn đã huỷ có khoản hoàn (D27): PENDING = chờ quản lý chuyển khoản, COMPLETED = đã hoàn
const isRefundPending = (r) => r.status === "CANCELLED" && r.refund_status === "PENDING";
const isRefunded = (r) => r.status === "CANCELLED" && r.refund_status === "COMPLETED";
function statusCell(r) {
  if (isRefundPending(r)) return <span className="tone-red">Đã huỷ · Đang hoàn tiền</span>;
  if (isRefunded(r)) return <span className="tone-green">Đã huỷ · Đã hoàn tiền</span>;
  return RESERVATION_STATUS[r.status][0];
}
export const CANCEL_POLICY_HINT = "Huỷ trước ngày bắt đầu thuê: phí huỷ 10% tiền cọc, hoàn 100% tiền thuê và 90% cọc. Từ ngày bắt đầu thuê, sử dụng quy trình trả kho.";

// C14a — Hộp thoại huỷ đơn & hoàn tiền
function CancelDialog({ r, onDone, onClose }) {
  const { data, dispatch, services } = useApp();
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = r.status === "CONFIRMED";
  const f = facilityOf(data, r.facility_id, r.facility_name);

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
        {[shortName(f) ? `SafeSpace ${shortName(f)}` : f.name, `${r.months} tháng`, r.start_date ? `Bắt đầu thuê ${dateLabel(r.start_date)}` : null].filter(Boolean).join(" · ")}
      </p>
      {paid ? (
        <div className="refund-box">
          <dl className="pay-rows">
            <div><dt>Đã thanh toán (tiền thuê {r.months} tháng + cọc)</dt><dd>{money(preview?.paid ?? r.initial_total)}</dd></div>
            <div>
              <dt>Phí huỷ (10% tiền cọc)</dt>
              <dd className={preview ? "tone-red" : undefined}>{preview ? `− ${money(preview.fee)}` : preview === false ? "Theo chính sách hiện hành" : "Đang tính…"}</dd>
            </div>
            <div className="pay-rows__total">
              <dt>Số tiền được hoàn</dt>
              <dd className="pay-rows__amount tone-green">{preview ? money(preview.refund) : preview === false ? "Cơ sở xác nhận sau khi huỷ" : "Đang tính…"}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <Notice>Đơn chưa thanh toán nên huỷ không phát sinh phí.</Notice>
      )}
      <Field label="Lý do huỷ (không bắt buộc)">
        <input maxLength={255} value={reason} placeholder="Ví dụ: Đổi kế hoạch chuyển nhà" onChange={(e) => setReason(e.target.value)} />
      </Field>
      {paid && <p className="hint">Bạn được hoàn 100% tiền thuê và 90% tiền cọc trong 3–5 ngày làm việc. Quản lý cơ sở chuyển khoản thủ công và cập nhật trạng thái hoàn tiền.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" onClick={onClose}>Giữ đơn</Button>
        <Button variant="danger" onClick={submit} disabled={busy}>{busy ? "Đang huỷ…" : "Huỷ đơn"}</Button>
      </div>
    </Modal>
  );
}

// C14 — Đơn đặt chỗ của tôi (C14b sau khi huỷ, C14c khi đã hoàn tiền)
export default function ReservationListPage() {
  const { data, retry } = useApp();
  const [cancelling, setCancelling] = useState(null);
  const [done, setDone] = useState(null);
  const list = sortedReservations(data);
  const anyCancellable = list.some((r) => canCancel(data, r));
  const pending = done ? null : list.find(isRefundPending);
  const refunded = done ? null : list.find(isRefunded);
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
                  <th>Tổng thanh toán</th>
                  <th>Trạng thái</th>
                  <th className="table__actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.reservation_id}>
                    <td title={r.reservation_id}>{r.reservation_id}</td>
                    <td>{shortName(facilityOf(data, r.facility_id, r.facility_name))} · {r.months} tháng</td>
                    <td>{money(r.initial_total)}</td>
                    <td>{statusCell(r)}</td>
                    <td className="table__actions">
                      <div className="row-actions">
                        <LinkButton to={`reservations/${r.reservation_id}`} className="btn--sm">Xem đơn</LinkButton>
                        {!done && canCancel(data, r) && (
                          <Button variant="outline" className="btn--sm btn--danger-outline" onClick={() => setCancelling(r)} aria-label={`Huỷ đơn ${shortCode(r.reservation_id)}`}>Huỷ đơn</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack stack--col stack--start">
            {done ? (
              <p className="hint tone-green">
                Đã huỷ đơn {done.id}.{done.refund ? ` Khoản ${money(done.refund)} đang chờ quản lý cơ sở hoàn về tài khoản đã thanh toán.` : ""}
              </p>
            ) : pending ? (
              <p className="hint tone-green">Đã huỷ đơn {pending.reservation_id}. Khoản {money(pending.refund_amount)} đang chờ quản lý cơ sở hoàn về tài khoản đã thanh toán.</p>
            ) : refunded ? (
              <p className="hint tone-green">Đã hoàn {money(refunded.refund_amount)} cho đơn {refunded.reservation_id} về tài khoản bạn đã thanh toán.</p>
            ) : (
              anyCancellable && <p className="hint hint--narrow">{CANCEL_POLICY_HINT}</p>
            )}
            <LinkButton to="find" variant="outline">Đặt thêm kho</LinkButton>
            {(done?.refund || pending) && <Button onClick={() => retry?.()}>Kiểm tra trạng thái hoàn tiền</Button>}
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
