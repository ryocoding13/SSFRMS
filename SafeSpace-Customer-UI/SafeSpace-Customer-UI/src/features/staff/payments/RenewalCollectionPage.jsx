import React from "react";
import { Button, PageHeader } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function RenewalCollectionPage() {
  const load = useWorkflowData("counterRenewals"), [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page"><PageHeader title="Thu tiền gia hạn tại quầy" description="Chỉ nhận khoản đã được duyệt; gia hạn không thu thêm cọc." /><WorkflowState load={load}>
    {(load.data || []).map(r => <RecordCard key={r.id} title={r.customer} subtitle={`${r.contractId} · Kho ${r.unit} · Gia hạn ${r.months} tháng`} status={r.status === "PAID" ? "Đã thu / Đã gia hạn" : "Chờ thu tại quầy"} actions={r.status !== "PAID" && <Button disabled={load.busy} onClick={() => ask("COLLECT_RENEWAL", { id: r.id }, "Xác nhận đã thu tiền gia hạn?", `Đã nhận đủ ${money(r.amount)}. Kiểm tra khoản thu trước khi xác nhận; không thu lại nếu đã thanh toán.`)}>Xác nhận đã thu</Button>}><strong className="price">{money(r.amount)}</strong><p className="muted">Tiền thuê kỳ gia hạn · Không thu lại cọc</p></RecordCard>)}{!load.data?.length && !load.error && <WorkflowEmpty />}
  </WorkflowState>{dialog}</main>;
}
