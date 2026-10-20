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
  const doReject = async () => {
    const out = await run("DECIDE_RENEWAL", { id: reject.id, approve: false, reason }, `Đã từ chối gia hạn ${reject.unit}`);
    if (!out.ok) return setErr(out.error);
    setReject(null);
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
        <Modal title={`Từ chối gia hạn kho #${reject.unit}`} onClose={() => setReject(null)}>
          <p className="modal__text">Lý do sẽ được gửi đến {reject.customer}.</p>
          <Field label="Lý do từ chối" error={err}>
            <textarea rows={3} value={reason} placeholder="Ví dụ: kho đã có đơn đặt trước từ ngày …" onChange={(e) => { setReason(e.target.value); setErr(""); }} />
          </Field>
          <div className="modal__actions">
            <Button variant="danger" onClick={doReject}>Từ chối yêu cầu</Button>
            <Button variant="outline" onClick={() => setReject(null)}>Huỷ</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
