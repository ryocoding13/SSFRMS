import React, { useState } from "react";
import { Button, PageHeader } from "../../../shared/components/UI.jsx";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InquiryThread } from "../../facility-operations/workflows/InquiryThread.jsx";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function StaffInquiryPage() {
  const { ops } = useOps(), load = useWorkflowData("inquiries"), [selected, setSelected] = useState("");
  const rows = (load.data || []).filter(t => !ops.facility?.facility_id || Number(t.facilityId) === Number(ops.facility.facility_id));
  return <main className="container page workflow-page"><PageHeader title="Hỗ trợ khách chưa có hợp đồng" description="Chỉ tiếp nhận yêu cầu được gửi đến cơ sở phụ trách." /><WorkflowState load={load}>{rows.map(t => <React.Fragment key={t.id}><RecordCard title={t.customer} subtitle={`${t.id} · ${t.title}`} status={t.status === "CLOSED" ? "Đã đóng" : "Chờ phản hồi"} actions={<Button onClick={() => setSelected(selected === t.id ? "" : t.id)}>Xem yêu cầu</Button>}><p>{t.description}</p></RecordCard>{selected === t.id && <InquiryThread ticket={t} load={load} />}</React.Fragment>)}{!rows.length && !load.error && <WorkflowEmpty />}</WorkflowState></main>;
}
