import { transferProof,actualVnTime,knownMoney } from "../../facility-operations/settlements/settlementModel.js";
import { amountLabel } from "../../facility-operations/damage/DamageComponents.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { vnDateTimeInput } from "../../facility-operations/damage/damageModel.js";
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
const METHODS = [["BANK_TRANSFER", "Chuyển khoản về tài khoản chính chủ khách khai báo"]];

function RefundDialog({ refund, onClose, onDone }) {
  const { run } = useOps();
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [at,setAt]=useState(""),[confirmed,setChecked]=useState(false);
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if(busy)return;
    try{transferProof(refund,{transactionRef:ref,transferredAt:at,confirmed});}catch(error){return setError(error.message);}
    setBusy(true);
    setError("");
    const res = await run("CONFIRM_RESERVATION_REFUND", { id: refund.id, method, transaction_ref: ref.trim(),transferredAt:actualVnTime(at),confirmed });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Chưa lưu được xác nhận. Kiểm tra trạng thái giao dịch trước khi thử lưu lại. Không chuyển khoản lần nữa.");
    onDone({ id: refund.id, amount: refund.amount, ref: ref.trim() });
  };
  return (
    <ConfirmDialog title={`Xác nhận đã hoàn · ${refund.id}`} busy={busy} rows={[]} onCancel={onClose} onConfirm={submit} label="Xác nhận đã hoàn" hint="Chỉ ghi nhận sau khi đã chuyển tiền thật. Không chuyển khoản lần nữa khi chưa xác minh kết quả.">
      <p className="modal__text modal__text--sub">{refund.customer} · Huỷ đơn ngày {dateLabel(refund.cancelled_at)}</p>
      <div className="refund-box">
        <dl className="pay-rows">
          <div><dt>Đã thanh toán</dt><dd>{amountLabel(refund.paid)}</dd></div>
          <div><dt>{CANCEL_FEE_LABEL}</dt><dd className="tone-red">{knownMoney(refund.fee)?`− ${amountLabel(refund.fee)}`:"Chưa có dữ liệu"}</dd></div>
          <div className="pay-rows__total"><dt>Số tiền hoàn</dt><dd className="pay-rows__amount tone-green">{amountLabel(refund.amount)}</dd></div>
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
      <InfoTiles items={[["Người nhận",refund.accountHolder||"Chưa có dữ liệu"],["Ngân hàng / tài khoản",refund.bankName&&refund.accountNumber?`${refund.bankName} · ••••${refund.accountNumber.slice(-4)}`:"Chưa có dữ liệu"]]}/><Field label="Thời gian chuyển · giờ Việt Nam *"><input type="datetime-local" max={vnDateTimeInput()} value={at} disabled={busy} onChange={e=>setAt(e.target.value)}/></Field><label className="customer-detail__choice"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setChecked(e.target.checked)}/><span>Đã chuyển đúng số tiền vào đúng tài khoản chính chủ</span></label>
    </ConfirmDialog>
  );
}

export function CancellationRefundPage() {
  const { ops,source,needsRefresh,saving } = useOps();
  const refunds = ops.refunds || [];
  const [open, setOpen] = useState(null), [detail, setDetail] = useState(null), [confirmed, setConfirmed] = useState(null);
  return <main className="container page workflow-page">
    <PageHeaderBlock title="Hoàn tiền đơn huỷ" text="Các đơn huỷ trước ngày bắt đầu thuê. Hoàn về tài khoản chính chủ khách khai báo." />
    {source==="api"&&ops.refund_evidence_supported!==true&&<Notice>Máy chủ chưa hỗ trợ lưu đủ tài khoản và bằng chứng chuyển tiền; chưa thể xác nhận đã hoàn.</Notice>}
    {confirmed && <Notice tone="success">Đã ghi nhận hoàn {money(confirmed.amount)} · {confirmed.id}.</Notice>}
    {refunds.map(r => <RecordCard key={r.id} title={r.customer} subtitle={`${r.id} · Huỷ: ${dateTimeLabel(r.cancelled_at)}`} status={r.status === "PENDING" ? "Chờ hoàn" : r.status==="PAID"?`Đã hoàn${r.paid_at ? ` · ${dateLabel(r.paid_at)}` : ""}`:"Chưa rõ trạng thái"} actions={<>
      {r.status === "PENDING" && <Button disabled={saving||needsRefresh||!knownMoney(r.amount)||r.amount<=0||(source==="api"&&ops.refund_evidence_supported!==true)} onClick={() => setOpen(r)}>Xác nhận đã hoàn</Button>}
      <Button variant="outline" onClick={() => setDetail(r)}>Xem yêu cầu hoàn tiền</Button>
    </>}><strong className="refund-amount">Số tiền hoàn: {amountLabel(r.amount)}</strong>{r.fee > 0 && <p className="muted">{CANCEL_REFUND_SHORT}</p>}</RecordCard>)}
    {!refunds.length && <Notice>Chưa có đơn huỷ cần hoàn tiền.</Notice>}
    <LinkButton to="manager/contracts" variant="outline">Về hợp đồng & quá hạn</LinkButton>
    {detail && <Modal title={`${detail.customer} · ${detail.id}`} size="md" onClose={() => setDetail(null)}><InfoTiles items={[["Đã thanh toán", amountLabel(detail.paid)], ["Tiền thuê", amountLabel(detail.rent)], ["Tiền cọc", amountLabel(detail.deposit)], [CANCEL_FEE_LABEL, amountLabel(detail.fee)], ["Số tiền hoàn", amountLabel(detail.amount)]]} /><p>{detail.status === "PENDING" ? "Khoản hoàn đang chờ thực hiện; kiểm tra giao dịch trước khi xác nhận." : detail.status==="PAID"?`Đã ghi nhận hoàn tiền${detail.transaction_ref ? ` · ${detail.transaction_ref}` : ""}.`:"Chưa rõ trạng thái chuyển tiền."}</p><Button onClick={() => setDetail(null)}>Đóng chi tiết</Button></Modal>}
    {open && <RefundDialog refund={open} onClose={() => setOpen(null)} onDone={result => { setOpen(null); setConfirmed(result); }} />}
  </main>;
}
