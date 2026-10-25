import React, { useState } from "react";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, useWorkflowChange, WorkflowState, WorkflowEmpty } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function DiscrepancyDetailPage({ query }) {
  const load = useWorkflowData("discrepancies"), [note, setNote] = useState(""), [error, setError] = useState("");
  const item = load.data?.find(r => r.id === query.get("id")), [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page"><PageHeader title="Đối soát báo cáo sai lệch" /><WorkflowState load={load}>{item ? <section className="panel form-card"><h2>{item.customer} · {item.reference}</h2><InfoTiles items={[["Hệ thống ghi nhận", money(item.expected)], ["Thực nhận", money(item.actual)], ["Chênh lệch", money(item.actual - item.expected)]]} /><p>{item.note}</p>
    {item.status === "RESOLVED" ? <Notice tone="success">Đã xử lý: {item.resolution}</Notice> : <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return setError("Nhập kết luận đối soát."); ask("RESOLVE_DISCREPANCY", { id: item.id, note }, "Lưu kết quả đối soát?", "Kết quả không tự sửa số tiền của giao dịch gốc."); }}><Field label="Kết luận / nội dung phản hồi *" error={error}><textarea rows={3} value={note} onChange={e => { setNote(e.target.value); setError(""); }} /></Field><Button type="submit" disabled={load.busy}>Kiểm tra & lưu kết quả</Button></form>}
    <LinkButton to="manager/discrepancies" variant="outline">Về danh sách sai lệch</LinkButton></section> : !load.error && <WorkflowEmpty />}</WorkflowState>{dialog}</main>;
}
