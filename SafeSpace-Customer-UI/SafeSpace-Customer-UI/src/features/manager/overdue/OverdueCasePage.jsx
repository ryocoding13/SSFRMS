import React, { useState } from "react";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { depositSchedule, policyRate } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function OverdueCasePage() {
  const load = useWorkflowData("overdue"), policy = useWorkflowData("policy"), rate = policyRate(policy.data), [selected, setSelected] = useState(""), [assignee, setAssignee] = useState(""), [error, setError] = useState("");
  const [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page"><PageHeader title="Hồ sơ quá hạn & xử lý đồ" description="Theo dõi khấu trừ cọc, phân công nhân viên và biên bản thực tế." /><WorkflowState load={load}>
    {(load.data || []).map(item => { const d = depositSchedule(item.deposit, item.endDate, undefined, rate); return <RecordCard key={item.id} title={`${item.customer} · Kho ${item.unit}`} subtitle={`${item.contractId} · Hết hạn ${dateLabel(item.endDate)}`} status={item.status === "DONE" ? "Đã lập biên bản" : `Quá hạn ${d.days} ngày`} actions={<Button onClick={() => { setSelected(selected === item.id ? "" : item.id); setAssignee(item.assignee || ""); }}>Xem chi tiết</Button>}>
      <InfoTiles items={[["Cọc ban đầu", money(d.initial)], ["Đã khấu trừ", money(d.deducted)], ["Cọc còn lại", money(d.balance)]]} />
      {selected === item.id && <><Notice>QR hết hiệu lực khi hết hạn thuê. Khấu trừ {rate}% cọc ban đầu/ngày, tối đa 100%; sau {d.limitDays} ngày nhân viên đưa đồ ra ngoài, khách tự chịu trách nhiệm.</Notice>
        {item.record ? <InfoTiles items={[["Người thực hiện", item.record.staff], ["Danh sách / tình trạng đồ", item.record.inventory], ["Vị trí đưa đồ ra ngoài", item.record.location]]} /> : d.days >= d.limitDays ? <form onSubmit={e => { e.preventDefault(); if (!assignee.trim()) return setError("Nhập nhân viên phụ trách."); ask("ASSIGN_REMOVAL", { id: item.id, assignee }, "Phân công xử lý đồ quá hạn?", "Nhân viên cần lập biên bản và ghi vị trí thực tế sau khi thực hiện."); }}><Field label="Nhân viên phụ trách" error={error}><input value={assignee} onChange={e => { setAssignee(e.target.value); setError(""); }} /></Field><Button type="submit" disabled={load.busy}>Xác nhận phân công</Button></form> : <p>Chưa đến mốc xử lý đồ (ngày {d.limitDays}).</p>}
      </>}
    </RecordCard>; })}
    {!load.data?.length && !load.error && <WorkflowEmpty />}<LinkButton to="manager/contracts" variant="outline">Về hợp đồng</LinkButton>
  </WorkflowState>{dialog}</main>;
}
