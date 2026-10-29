import React,{useState} from "react";
import { businessApi } from "../api/businessApi.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { Button, Empty, PageHeader } from "../../../shared/components/UI.jsx";
import { LoadState } from "../components/BusinessComponents.jsx";
import { RecordCard } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function PolicyStatusPage() {
  const { onApiError } = useApp(), load = useLoad(() => businessApi.policies({}), [], onApiError), [flow, runChange] = useChangeFlow();
  const [blocked,setBlocked]=useState(false);
  const change = async (p, remove) => { const out = await runChange({ action: remove ? "Xoá chính sách nháp" : "Ngừng áp dụng chính sách", scope: p.policyName, danger:remove, content: remove ? "Chỉ xoá bản DRAFT chưa áp dụng." : "Giữ lịch sử phiên bản và phạm vi chính sách hiện hành.", perform: async () => { if (remove) { if (p.status !== "DRAFT") throw new Error("Chỉ được xoá bản nháp."); await businessApi.deletePolicy(p.policyId); } else await businessApi.deactivatePolicy(p.policyId); const rows=await businessApi.policies({});if(remove?rows.some(r=>r.policyId===p.policyId):!rows.some(r=>r.policyId===p.policyId&&r.status==="INACTIVE"))throw Object.assign(new Error("Chưa xác nhận trạng thái chính sách. Tải lại trước khi gửi tiếp."),{uncertain:true});return true; } }); if (out.error) {onApiError(out.error);if(out.uncertain)setBlocked(true);} if(out.ok)load.reload(); };
  return <main className="container page workflow-page"><PageHeader title="Quản lý trạng thái chính sách" description="Giữ lịch sử chính sách đã áp dụng; chỉ xoá bản nháp." />{blocked&&<Button onClick={()=>window.location.reload()}>Tải lại trước khi thao tác tiếp</Button>}<LoadState load={load}>{rows => <>{!rows.length&&<Empty title="Chưa có chính sách"/>}{rows.map(p => <RecordCard key={p.policyId} title={p.policyName} subtitle={`${p.policyType} · ${p.effectiveFrom}`} status={p.status === "ACTIVE" ? "Đang áp dụng" : p.status === "DRAFT" ? "Bản nháp" : p.status==="INACTIVE"?"Đã ngừng":"Chưa rõ trạng thái"} actions={p.status === "ACTIVE" ? <Button disabled={blocked||load.loading} variant="outline" onClick={() => change(p, false)}>Ngừng áp dụng</Button> : p.status === "DRAFT" ? <Button disabled={blocked||load.loading} variant="outline" onClick={() => change(p, true)}>Xoá bản nháp</Button> : null}><p>{p.ruleDescription}</p></RecordCard>)}</>}</LoadState>{flow}</main>;
}
