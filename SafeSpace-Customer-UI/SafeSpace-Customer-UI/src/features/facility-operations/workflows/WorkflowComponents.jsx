import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import React, { useRef, useState } from "react";
import { Button, Empty, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";

// errorView: chữ trạng thái lỗi tải theo Figma của từng màn ({ title, text, label }); 403 khi tải = dữ liệu ngoài cơ sở phụ trách (Figma QUYEN02)
export function WorkflowState({ load, children, errorView }) {
  return <>{load.demo && <Notice>Chế độ mô phỏng FE · Dữ liệu lưu trong trình duyệt, không phải giao dịch thật.</Notice>}
    {load.needsRefresh&&<Notice tone="error">Chưa xác minh kết quả. Tải lại trước khi gửi tiếp; không chuyển tiền lần nữa.<Button disabled={load.busy} onClick={load.reload}>Tải lại dữ liệu</Button></Notice>}
    {load.loading ? <p role="status">Đang tải dữ liệu…</p> : load.error ? (
      load.errorStatus === 403 ? <Empty title="Dữ liệu ngoài cơ sở phụ trách" text="Không thể xem hoặc thao tác hồ sơ thuộc cơ sở khác."><Button variant="outline" onClick={load.reload}>Tải lại dữ liệu</Button></Empty>
      : errorView ? <Empty title={errorView.title} text={errorView.text}><Button variant="outline" onClick={load.reload}>{errorView.label || "Thử tải lại"}</Button></Empty>
      : <Notice tone="error">{load.error} <Button variant="outline" onClick={load.reload}>Thử tải lại</Button></Notice>
    ) : null}
    {!load.loading && !load.error && children}
  </>;
}
export function InfoTiles({ items }) { return <dl className="workflow-tiles">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>; }
export function RecordCard({ title, subtitle, status, children, actions }) { return <article className="panel record-card"><div className="record-card__body"><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}{children}</div><div className="record-card__actions">{status && <Tag tone={/từ chối|quá hạn|Quá hạn/.test(status) ? "red" : /Chờ/.test(status) ? "amber" : /Đã|Hoàn tất/.test(status) ? "green" : "amber"}>{status}</Tag>}{actions}</div></article>; }
export function WorkflowEmpty({ title = "Chưa có dữ liệu", text = "Chưa có hồ sơ trong danh sách này.", children }) { return <Empty title={title} text={text}>{children}</Empty>; }

export function WorkflowConfirm({ title, summary, busy, error, forbidden, failTitle, confirmLabel, onConfirm, onClose, onReload }) {
  // Figma QUYEN04: quyền / phân công vừa đổi → không thử lại, chỉ tải lại dữ liệu
  if (error && forbidden) return <ConfirmDialog title="Thao tác chưa được thực hiện" text={error} tone="failure" rows={[]} busy={busy} onCancel={onClose} onConfirm={onReload} label="Tải lại dữ liệu" hint=""/>;
  return <ConfirmDialog title={error?(failTitle||"Chưa ghi nhận được kết quả"):title} text={error||summary} tone={error?"failure":"confirm"} rows={[]} busy={busy} onCancel={onClose} onConfirm={onConfirm} label={error?"Thử lại":(confirmLabel||"Xác nhận")} hint={error?"Nội dung được giữ. Tải lại khi chưa xác minh được kết quả; không chuyển tiền lần nữa.":undefined}/>;
}
export function useWorkflowChange(load) {
  const [pending, setPending] = useState(null), [result, setResult] = useState(null), [error, setError] = useState(""), [forbidden, setForbidden] = useState(false);
  const guard=useRef(false);
  // opts (chữ theo Figma từng màn): { successTitle, failTitle, confirmLabel, doneLabel, onDone }
  const ask = (action, payload, title, summary, opts = {}) => { setError(""); setForbidden(false); setPending({ action, payload, title, summary, opts }); };
  const closeResult = () => { const done = result?.onDone; setResult(null); done?.(); };
  const dialog = pending ? <WorkflowConfirm title={pending.title} summary={pending.summary} failTitle={pending.opts.failTitle} confirmLabel={pending.opts.confirmLabel} busy={load.busy} error={error} forbidden={forbidden} onClose={() => setPending(null)} onReload={() => { setPending(null); load.reload(); }} onConfirm={async () => { if(guard.current)return;guard.current=true;let out;try{out=await load.run(pending.action, pending.payload);}finally{guard.current=false;} if (out.ok) { setPending(null); setResult({ title: pending.opts.successTitle || "Đã lưu kết quả", label: pending.opts.doneLabel || "Về hồ sơ", onDone: pending.opts.onDone }); } else { setForbidden(out.code === "FORBIDDEN"); setError(out.error); } }} /> : result ? <ConfirmDialog title={result.title} tone="success" text={load.demo?"Đã cập nhật dữ liệu mô phỏng trong trình duyệt.":"Máy chủ đã xác nhận kết quả."} rows={[]} cancelLabel={null} label={result.label} hint="" onCancel={closeResult} onConfirm={closeResult}/> : null;
  return [dialog, ask];
}
