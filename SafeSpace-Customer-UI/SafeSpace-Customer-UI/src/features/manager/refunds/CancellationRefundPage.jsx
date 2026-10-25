import { InfoTiles, RecordCard } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, Notice } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, money } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";
import { CANCEL_FEE_LABEL, CANCEL_REFUND_SHORT } from "../../../shared/utils/policy.js";

// Figma M08 / M08a / M08a2 / M08-kết thúc / M07e: hoàn tiền đơn khách huỷ trước ngày bắt đầu thuê (D27).
// Quản lý chuyển khoản thủ công ngoài hệ thống rồi xác nhận ở đây; thao tác không tự chuyển tiền.
// Khách trả qua PayOS nên chỉ hoàn bằng chuyển khoản (Figma M08a ẩn lựa chọn tiền mặt)
const METHODS = [["BANK_TRANSFER", "Chuyển khoản thủ công về tài khoản khách đã thanh toán"]];

function RefundDialog({ refund, onClose, onDone }) {
  const { run } = useOps();
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (method === "BANK_TRANSFER" && !ref.trim()) return setError("Nhập mã giao dịch hoàn tiền.");
    setBusy(true);
    setError("");
    const res = await run("CONFIRM_RESERVATION_REFUND", { id: refund.id, method, transaction_ref: ref.trim() });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Chưa lưu được xác nhận. Kiểm tra trạng thái giao dịch trước khi thử lưu lại. Không chuyển khoản lần nữa.");
    onDone({ id: refund.id, amount: refund.amount, ref: ref.trim() });
  };
  return (
    <Modal title={`Xác nhận đã hoàn · ${refund.id}`} size="md" onClose={busy ? undefined : onClose}>
      <p className="modal__text modal__text--sub">{refund.customer} · Huỷ đơn ngày {dateLabel(refund.cancelled_at)}</p>
      <div className="refund-box">
        <dl className="pay-rows">
          <div><dt>Đã thanh toán qua PayOS</dt><dd>{money(refund.paid)}</dd></div>
          <div><dt>{CANCEL_FEE_LABEL}</dt><dd className="tone-red">{refund.fee ? `− ${money(refund.fee)}` : money(0)}</dd></div>
          <div className="pay-rows__total"><dt>Số tiền hoàn</dt><dd className="pay-rows__amount tone-green">{money(refund.amount)}</dd></div>
        </dl>
      </div>
      <fieldset className="radio-list">
        <legend className="field__label">Cách hoàn tiền</legend>
        {METHODS.map(([value, label]) => (
          <label key={value} className={`radio-card${method === value ? " is-on" : ""}`}>
            <input type="radio" name="refund-method" value={value} checked={method === value} onChange={() => { setMethod(value); setError(""); }} />
            <strong>{label}</strong>
          </label>
        ))}
      </fieldset>
      {method === "BANK_TRANSFER" && (
        <Field label="Mã giao dịch hoàn tiền" error={error && !ref.trim() ? error : ""}>
          <input maxLength={40} value={ref} placeholder="Nhập mã giao dịch đã chuyển" onChange={(e) => { setRef(e.target.value); setError(""); }} />
        </Field>
      )}
      {error && ref.trim() && <Notice tone="error">{error}</Notice>}
      <p className="hint">Sau khi xác nhận, đơn chuyển sang “Đã hoàn tiền” và khách nhận thông báo. Không thể hoàn tác.</p>
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" disabled={busy} onClick={onClose}>Quay lại</Button>
        <Button disabled={busy} onClick={submit}>{busy ? "Đang lưu…" : "Xác nhận đã hoàn"}</Button>
      </div>
    </Modal>
  );
}

export function CancellationRefundPage() {
  const { ops } = useOps();
  const refunds = ops.refunds || [];
  const [open, setOpen] = useState(null), [detail, setDetail] = useState(null), [confirmed, setConfirmed] = useState(null);
  return <main className="container page workflow-page">
    <PageHeaderBlock title="Hoàn tiền đơn huỷ" text="Các đơn huỷ trước ngày bắt đầu thuê. Chỉ xác nhận sau khi đã chuyển tiền cho đúng khách." />
    {confirmed && <Notice tone="success">Đã ghi nhận hoàn {money(confirmed.amount)} · {confirmed.id}.</Notice>}
    {refunds.map(r => <RecordCard key={r.id} title={r.customer} subtitle={`${r.id} · Huỷ: ${dateTimeLabel(r.cancelled_at)}`} status={r.status === "PENDING" ? "Chờ hoàn" : `Đã hoàn${r.paid_at ? ` · ${dateLabel(r.paid_at)}` : ""}`} actions={<>
      {r.status === "PENDING" && <Button onClick={() => setOpen(r)}>Xác nhận đã hoàn</Button>}
      <Button variant="outline" onClick={() => setDetail(r)}>Xem yêu cầu hoàn tiền</Button>
    </>}><strong className="refund-amount">Số tiền hoàn: {money(r.amount)}</strong>{r.fee > 0 && <p className="muted">{CANCEL_REFUND_SHORT}</p>}</RecordCard>)}
    {!refunds.length && <Notice>Chưa có đơn huỷ cần hoàn tiền.</Notice>}
    <LinkButton to="manager/contracts" variant="outline">Về hợp đồng & quá hạn</LinkButton>
    {detail && <Modal title={`${detail.customer} · ${detail.id}`} size="md" onClose={() => setDetail(null)}><InfoTiles items={[["Đã thanh toán", money(detail.paid)], ["Tiền thuê", money(detail.rent)], ["Tiền cọc", money(detail.deposit)], [CANCEL_FEE_LABEL, money(detail.fee)], ["Số tiền hoàn", money(detail.amount)]]} /><p>{detail.status === "PENDING" ? "Khoản hoàn đang chờ thực hiện; kiểm tra giao dịch trước khi xác nhận." : `Đã ghi nhận hoàn tiền${detail.transaction_ref ? ` · ${detail.transaction_ref}` : ""}.`}</p><Button onClick={() => setDetail(null)}>Đóng chi tiết</Button></Modal>}
    {open && <RefundDialog refund={open} onClose={() => setOpen(null)} onDone={result => { setOpen(null); setConfirmed(result); }} />}
  </main>;
}
