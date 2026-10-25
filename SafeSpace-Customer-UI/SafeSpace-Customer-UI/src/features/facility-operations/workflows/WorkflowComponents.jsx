import React, { useState } from "react";
import { Button, Empty, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";

export function WorkflowState({ load, children }) {
  return <>{load.demo && <Notice>Chế độ mô phỏng FE · Dữ liệu lưu trong trình duyệt, không phải giao dịch thật.</Notice>}
    {load.loading ? <p role="status">Đang tải dữ liệu…</p> : load.error ? <Notice tone="error">{load.error} <Button variant="outline" onClick={load.reload}>Thử tải lại</Button></Notice> : null}
    {!load.loading && children}
  </>;
}
export function InfoTiles({ items }) { return <dl className="workflow-tiles">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>; }
export function RecordCard({ title, subtitle, status, children, actions }) { return <article className="panel record-card"><div className="record-card__body"><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}{children}</div><div className="record-card__actions">{status && <Tag tone={/từ chối|quá hạn|Quá hạn/.test(status) ? "red" : /Chờ/.test(status) ? "amber" : /Đã|Hoàn tất/.test(status) ? "green" : "amber"}>{status}</Tag>}{actions}</div></article>; }
export function WorkflowEmpty({ text = "Chưa có hồ sơ trong danh sách này." }) { return <Empty title="Chưa có dữ liệu" text={text} />; }

export function WorkflowConfirm({ title, summary, busy, error, onConfirm, onClose }) {
  return <Modal title={title} onClose={busy ? undefined : onClose} size="confirm"><p>{summary}</p>{error && <Notice tone="error">{error}</Notice>}<div className="modal__actions"><Button variant="outline" disabled={busy} onClick={onClose}>Quay lại</Button><Button disabled={busy} onClick={onConfirm}>{busy ? "Đang lưu…" : "Xác nhận"}</Button></div></Modal>;
}
export function useWorkflowChange(load) {
  const [pending, setPending] = useState(null), [result, setResult] = useState(null), [error, setError] = useState("");
  const ask = (action, payload, title, summary) => { setError(""); setPending({ action, payload, title, summary }); };
  const dialog = pending ? <WorkflowConfirm {...pending} busy={load.busy} error={error} onClose={() => setPending(null)} onConfirm={async () => { const out = await load.run(pending.action, pending.payload); if (out.ok) { setPending(null); setResult("Đã lưu kết quả"); } else setError(out.error); }} /> : result ? <Modal title={result} onClose={() => setResult(null)}><Notice tone="success">{load.demo ? "Đã cập nhật dữ liệu mô phỏng trong trình duyệt." : "Máy chủ đã ghi nhận thao tác."}</Notice><Button onClick={() => setResult(null)}>Về danh sách</Button></Modal> : null;
  return [dialog, ask];
}
