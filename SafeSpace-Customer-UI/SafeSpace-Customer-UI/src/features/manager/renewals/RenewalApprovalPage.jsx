import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

export function RenewalApprovalPage() {
  const { ops, run } = useOps();
  const pending = ops.renewals.filter((r) => r.status === "PENDING");
  const done = ops.renewals.filter((r) => r.status !== "PENDING");
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const approve = (r) => run("DECIDE_RENEWAL", { id: r.id, approve: true }, `Đã duyệt gia hạn ${r.unit}`);
  // M03b: nhập lý do trong hộp thoại riêng → M03d kết quả do provider hiện
  const doReject = async () => {
    if (!reason.trim()) return setErr("Nhập lý do từ chối.");
    const target = reject;
    setReject(null);
    const out = await run("DECIDE_RENEWAL", { id: target.id, approve: false, reason: reason.trim() }, `Đã từ chối gia hạn ${target.unit}`);
    if (!out.ok) {
      if (!out.cancelled) setReject(target);
      return setErr(out.shown ? "" : out.error);
    }
    setReason("");
  };
  return (
    <main className="container page">
      <PageHeaderBlock title="Yêu cầu gia hạn chờ duyệt" text={pending.length ? `${pending.length} yêu cầu — vui lòng phản hồi trong vòng 24 giờ.` : "Không còn yêu cầu chờ duyệt."} />
      <ul className="rows">
        {pending.map((r) => (
          <li className="row ops-row" key={r.id}>
            <div className="row__main">
              <strong>{r.customer} — Kho #{r.unit}</strong>
              <span>Gia hạn {r.months} tháng từ {dateLabel(r.from)} đến {dateLabel(r.to)}</span>
              <span>Gửi yêu cầu: {dateLabel(r.requested.slice(0, 10))} · {r.contract}</span>
            </div>
            <div className="ops-actions ops-actions--tight">
              <Button onClick={() => approve(r)}>Duyệt</Button>
              <Button variant="outline" className="btn--danger-text" onClick={() => { setReject(r); setErr(""); }}>Từ chối</Button>
            </div>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <h2 className="section-title">Đã xử lý</h2>
          <ul className="rows">
            {done.map((r) => (
              <li className="row ops-row" key={r.id}>
                <div className="row__main">
                  <strong>{r.customer} — Kho #{r.unit}</strong>
                  <span>{r.status === "APPROVED" ? `Gia hạn đến ${dateLabel(r.to)}` : `Lý do: ${r.reason}`}</span>
                </div>
                <Tag tone={r.status === "APPROVED" ? "green" : "red"}>{r.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}</Tag>
              </li>
            ))}
          </ul>
        </>
      )}
      <LinkButton to="manager" variant="outline">Về tổng quan</LinkButton>
      {reject && (
        <Modal title={`Từ chối gia hạn kho ${reject.unit}?`} size="confirm" onClose={() => setReject(null)}>
          <p className="modal__text">Nhập lý do để khách hiểu kết quả xử lý. Kỳ thuê hiện tại được giữ nguyên.</p>
          <dl className="confirm-summary">
            <div><dt>Khách hàng</dt><dd>{reject.customer}</dd></div>
            <div><dt>Kỳ gia hạn đề nghị</dt><dd>{dateLabel(reject.from)}–{dateLabel(reject.to)}</dd></div>
          </dl>
          <Field label="Lý do từ chối · Bắt buộc" error={err}>
            <textarea rows={2} maxLength={500} value={reason} placeholder="Ví dụ: Không đáp ứng điều kiện gia hạn theo chính sách hiện hành." onChange={(e) => { setReason(e.target.value); setErr(""); }} />
          </Field>
          <p className="hint">Kiểm tra thông tin trước khi xác nhận.</p>
          <div className="modal__actions">
            <Button variant="outline" onClick={() => setReject(null)}>Quay lại</Button>
            <Button onClick={doReject}>Xác nhận từ chối</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
