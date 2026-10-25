import React from "react";
import { businessApi } from "../api/businessApi.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { Button, PageHeader } from "../../../shared/components/UI.jsx";
import { LoadState } from "../components/BusinessComponents.jsx";
import { RecordCard } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function PolicyStatusPage() {
  const { onApiError } = useApp(), load = useLoad(() => businessApi.policies({}), [], onApiError), [flow, runChange] = useChangeFlow();
  const change = async (p, remove) => { const out = await runChange({ action: remove ? "Xoá chính sách nháp" : "Ngừng áp dụng chính sách", scope: p.policyName, content: remove ? "Chỉ xoá bản DRAFT chưa áp dụng." : "Không sửa ngược các hợp đồng đang có.", perform: async () => { if (remove) { if (p.status !== "DRAFT") throw new Error("Chỉ được xoá bản nháp."); await businessApi.deletePolicy(p.policyId); } else await businessApi.deactivatePolicy(p.policyId); return true; } }); if (out.error) onApiError(out.error); load.reload(); };
  return <main className="container page workflow-page"><PageHeader title="Quản lý trạng thái chính sách" description="Giữ lịch sử chính sách đã áp dụng; chỉ xoá bản nháp." /><LoadState load={load}>{rows => rows.map(p => <RecordCard key={p.policyId} title={p.policyName} subtitle={`${p.policyType} · ${p.effectiveFrom}`} status={p.status === "ACTIVE" ? "Đang áp dụng" : p.status === "DRAFT" ? "Bản nháp" : "Đã ngừng"} actions={p.status === "ACTIVE" ? <Button variant="outline" onClick={() => change(p, false)}>Ngừng áp dụng</Button> : p.status === "DRAFT" ? <Button variant="outline" onClick={() => change(p, true)}>Xoá bản nháp</Button> : null}><p>{p.ruleDescription}</p></RecordCard>)}</LoadState>{flow}</main>;
}
