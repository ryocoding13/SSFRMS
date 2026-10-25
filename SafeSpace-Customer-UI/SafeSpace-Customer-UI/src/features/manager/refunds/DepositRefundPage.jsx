import React, { useState } from "react";
import { Button, Field, PageHeader } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function DepositRefundPage() {
  const load = useWorkflowData("depositRefunds"), [selected, setSelected] = useState(""), [ref, setRef] = useState(""), [error, setError] = useState("");
  const [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page"><PageHeader title="Hoàn cọc sau trả kho" description="Đối chiếu biên bản và ghi nhận sau khi đã chuyển tiền." /><WorkflowState load={load}>
    {(load.data || []).map(r => <RecordCard key={r.id} title={`${r.customer} · Kho ${r.unit}`} subtitle={`${r.id} · ${r.contractId}`} status={r.status === "PAID" ? "Đã hoàn cọc" : r.amount > 0 ? "Chờ hoàn cọc" : "Không còn cọc hoàn"} actions={<Button onClick={() => { setSelected(selected === r.id ? "" : r.id); setRef(""); }}>Xem khoản hoàn</Button>}>
      <strong className="price tone-green">{money(r.amount)}</strong>{selected === r.id && <><InfoTiles items={[["Cọc ban đầu", money(r.deposit)], ["Khoản chưa thanh toán", money(r.unpaid)], ["Phí vệ sinh", money(r.cleaning)], ["Phí hư hỏng", money(r.damage)], ["Khoản hoàn", money(r.amount)]]} />
        {r.status !== "PAID" && r.amount > 0 ? <form onSubmit={e => { e.preventDefault(); if (!ref.trim()) return setError("Nhập mã giao dịch hoàn cọc."); ask("CONFIRM_DEPOSIT_REFUND", { id: r.id, transactionRef: ref }, "Xác nhận đã hoàn cọc?", `Chỉ xác nhận sau khi chuyển thành công ${money(r.amount)} cho khách. Thao tác không thực hiện chuyển tiền.`); }}><Field label="Mã giao dịch hoàn cọc *" error={error}><input value={ref} onChange={e => { setRef(e.target.value); setError(""); }} /></Field><Button type="submit" disabled={load.busy}>Xác nhận đã hoàn cọc</Button></form> : <p>{r.transactionRef ? `Mã giao dịch: ${r.transactionRef}` : "Không có khoản chuyển tiền cần thực hiện."}</p>}</>}
    </RecordCard>)}{!load.data?.length && !load.error && <WorkflowEmpty />}
  </WorkflowState>{dialog}</main>;
}
