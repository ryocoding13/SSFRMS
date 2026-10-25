import React, { useState } from "react";
import { Field, LinkButton, PageHeader } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function DiscrepancyListPage() {
  const load = useWorkflowData("discrepancies"), [status, setStatus] = useState("");
  const rows = (load.data || []).filter(x => !status || x.status === status);
  return <main className="container page workflow-page"><PageHeader title="Báo cáo sai lệch thanh toán" description="Đối chiếu báo cáo từ nhân viên tại cơ sở." />
    <Field label="Trạng thái"><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả</option><option value="PENDING">Chờ xử lý</option><option value="RESOLVED">Đã xử lý</option></select></Field>
    <WorkflowState load={load}>{rows.map(r => <RecordCard key={r.id} title={r.customer} subtitle={`${r.id} · ${r.reference}`} status={r.status === "PENDING" ? "Chờ xử lý" : "Đã xử lý"} actions={<LinkButton to={`manager/discrepancy-detail?id=${encodeURIComponent(r.id)}`}>Xem báo cáo</LinkButton>}><p>Hệ thống: {money(r.expected)} · Thực nhận: {money(r.actual)}</p><p className="muted">{r.note}</p></RecordCard>)}{!rows.length && !load.error && <WorkflowEmpty />}</WorkflowState>
  </main>;
}
