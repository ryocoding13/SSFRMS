import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, Notice } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, money } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

// Figma M08 / M08a / M08a2 / M08-kết thúc / M07e: hoàn tiền đơn khách huỷ trước ngày bắt đầu thuê (D27).
// Quản lý chuyển khoản thủ công ngoài hệ thống rồi xác nhận ở đây; thao tác không tự chuyển tiền.
// Khách trả qua PayOS nên chỉ hoàn bằng chuyển khoản (Figma M08a ẩn lựa chọn tiền mặt)
const METHODS = [["BANK_TRANSFER", "Chuyển khoản thủ công về tài khoản khách đã thanh toán"]];
const shortId = (id) => id.replace(/^SS-\d{8}-/, "SS-");
const amountLabel = (r) => (r.fee ? `${money(r.amount)} (100% tiền thuê + 90% cọc)` : money(r.amount));

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
          <div><dt>Phí huỷ (10% tiền cọc)</dt><dd className="tone-red">{refund.fee ? `− ${money(refund.fee)}` : money(0)}</dd></div>
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
  const pending = refunds.filter((r) => r.status === "PENDING");
  const [open, setOpen] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [confirmed, setConfirmed] = useState([]);
  const next = pending[0];
  const last = confirmed[confirmed.length - 1];
  return (
    <main className="container page">
      <PageHeaderBlock title="Hoàn tiền đơn huỷ" text="Các đơn khách huỷ trước ngày bắt đầu thuê. Chuyển tiền về tài khoản khách đã thanh toán rồi xác nhận để cập nhật đơn." />
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Đơn / khách</th><th>Ngày huỷ</th><th>Số tiền hoàn</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {refunds.length === 0 ? (
              <tr><td colSpan={4} className="table__empty">Chưa có đơn huỷ cần hoàn tiền.</td></tr>
            ) : refunds.map((r) => (
              <tr key={r.id} className={next?.id === r.id ? "is-picked" : ""}>
                <td className="cell-strong">{r.id} · {r.customer}</td>
                <td>{dateTimeLabel(r.cancelled_at)}</td>
                <td>{amountLabel(r)}</td>
                <td>{r.status === "PENDING" ? <span className="tone-amber">Chờ hoàn</span> : <span className="tone-green">Đã hoàn{r.paid_at ? ` · ${dateLabel(r.paid_at)}` : ""}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {next ? (
        <section className="panel form-card">
          <h2>{next.id} · Hoàn tiền huỷ đơn</h2>
          <p className="muted">
            {last
              ? `Đã xác nhận hoàn ${money(last.amount)} cho đơn ${last.id}${last.ref ? ` (mã giao dịch ${last.ref})` : ""}. Tiếp theo: chuyển ${money(next.amount)} cho đơn ${next.id}.`
              : `Chuyển ${money(next.amount)} về tài khoản khách đã dùng để thanh toán qua PayOS, sau đó bấm xác nhận và nhập mã giao dịch hoàn.`}
          </p>
          <Button onClick={() => setOpen(next)}>Xác nhận đã hoàn</Button>
          <Button variant="outline" onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown}>Xem yêu cầu hoàn tiền</Button>
          {showBreakdown && (
            <dl className="facts">
              <div><dt>Đã thanh toán (tiền thuê + cọc)</dt><dd>{money(next.paid)}</dd></div>
              <div><dt>Tiền thuê</dt><dd>{money(next.rent)}</dd></div>
              <div><dt>Tiền cọc</dt><dd>{money(next.deposit)}</dd></div>
              <div><dt>Phí huỷ (10% tiền cọc)</dt><dd>{money(next.fee)}</dd></div>
              <div><dt>Hoàn cho khách</dt><dd>{money(next.amount)}</dd></div>
            </dl>
          )}
        </section>
      ) : (
        <section className="panel form-card">
          <h2>Các khoản hoàn đã được ghi nhận</h2>
          <p className="muted">
            {confirmed.length
              ? `Đã ghi nhận hoàn ${confirmed.map((c) => `${money(c.amount)} cho ${shortId(c.id)}`).join(" và ")}. Không còn yêu cầu chờ hoàn trong danh sách này.`
              : "Không còn yêu cầu chờ hoàn trong danh sách này."}
          </p>
          <LinkButton to="manager/contracts" variant="outline">Về hợp đồng & quá hạn</LinkButton>
        </section>
      )}
      {open && (
        <RefundDialog
          refund={open}
          onClose={() => setOpen(null)}
          onDone={(done) => {
            setOpen(null);
            setConfirmed((list) => [...list, done]);
            setShowBreakdown(false);
          }}
        />
      )}
    </main>
  );
}
