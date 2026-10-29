import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import React, { useRef, useState } from "react";
import { Button, Empty, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";

export function WorkflowState({ load, children }) {
  return <>{load.demo && <Notice>Chế độ mô phỏng FE · Dữ liệu lưu trong trình duyệt, không phải giao dịch thật.</Notice>}
    {load.needsRefresh&&<Notice tone="error">Chưa xác minh kết quả. Tải lại trước khi gửi tiếp; không chuyển tiền lần nữa.<Button disabled={load.busy} onClick={load.reload}>Tải lại dữ liệu</Button></Notice>}
    {load.loading ? <p role="status">Đang tải dữ liệu…</p> : load.error ? <Notice tone="error">{load.error} <Button variant="outline" onClick={load.reload}>Thử tải lại</Button></Notice> : null}
    {!load.loading && !load.error && children}
  </>;
}
export function InfoTiles({ items }) { return <dl className="workflow-tiles">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>; }
export function RecordCard({ title, subtitle, status, children, actions }) { return <article className="panel record-card"><div className="record-card__body"><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}{children}</div><div className="record-card__actions">{status && <Tag tone={/từ chối|quá hạn|Quá hạn/.test(status) ? "red" : /Chờ/.test(status) ? "amber" : /Đã|Hoàn tất/.test(status) ? "green" : "amber"}>{status}</Tag>}{actions}</div></article>; }
export function WorkflowEmpty({ text = "Chưa có hồ sơ trong danh sách này." }) { return <Empty title="Chưa có dữ liệu" text={text} />; }

export function WorkflowConfirm({ title, summary, busy, error, onConfirm, onClose }) {
  return <ConfirmDialog title={error?"Chưa ghi nhận được kết quả":title} text={error||summary} tone={error?"failure":"confirm"} rows={[]} busy={busy} onCancel={onClose} onConfirm={onConfirm} label={error?"Thử lại":"Xác nhận"} hint={error?"Nội dung được giữ. Tải lại khi chưa xác minh được kết quả; không chuyển tiền lần nữa.":undefined}/>;
}
export function useWorkflowChange(load) {
  const [pending, setPending] = useState(null), [result, setResult] = useState(null), [error, setError] = useState("");
  const guard=useRef(false);
  const ask = (action, payload, title, summary) => { setError(""); setPending({ action, payload, title, summary }); };
  const dialog = pending ? <WorkflowConfirm {...pending} busy={load.busy} error={error} onClose={() => setPending(null)} onConfirm={async () => { if(guard.current)return;guard.current=true;let out;try{out=await load.run(pending.action, pending.payload);}finally{guard.current=false;} if (out.ok) { setPending(null); setResult("Đã lưu kết quả"); } else setError(out.error); }} /> : result ? <ConfirmDialog title={result} tone="success" text={load.demo?"Đã cập nhật dữ liệu mô phỏng trong trình duyệt.":"Máy chủ đã xác nhận kết quả."} rows={[]} cancelLabel={null} label="Về hồ sơ" hint="" onCancel={()=>setResult(null)} onConfirm={()=>setResult(null)}/> : null;
  return [dialog, ask];
}
