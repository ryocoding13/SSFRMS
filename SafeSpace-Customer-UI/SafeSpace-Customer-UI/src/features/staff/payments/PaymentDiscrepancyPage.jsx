import React, { useState } from "react";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, useWorkflowChange, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function PaymentDiscrepancyPage({ query }) {
  const { ops } = useOps();
  const items = [...ops.payments, ...(ops.fee_collections || [])];
  const [reference, setReference] = useState(query.get("id") || items[0]?.id || "");
  const payment = items.find(x => x.id === reference);
  const [actual, setActual] = useState(""), [note, setNote] = useState(""), [error, setError] = useState("");
  const load = useWorkflowData("discrepancies"), [dialog, ask] = useWorkflowChange(load);
  const submit = e => {
    e.preventDefault(); setError("");
    if (!payment || actual === "" || !Number.isFinite(Number(actual)) || Number(actual) < 0 || !note.trim()) return setError("Chọn khoản thu, nhập số tiền thực nhận hợp lệ và lý do cần kiểm tra.");
    ask("REPORT_DISCREPANCY", { reference, customer: payment.customer, expected: payment.amount, actual: Number(actual), note }, "Gửi báo cáo sai lệch?", "Báo cáo không tự đổi trạng thái khoản thu hoặc ghi nhận đã thanh toán.");
  };
  return <main className="container page workflow-page"><PageHeader title="Báo sai lệch thanh toán" description="Ghi nhận số tiền thực nhận để quản lý đối chiếu." />
    <WorkflowState load={load}><form className="panel form-card" onSubmit={submit}>
      <Field label="Khoản thu cần kiểm tra"><select value={reference} onChange={e => setReference(e.target.value)}>{items.map(p => <option key={p.id} value={p.id}>{p.id} · {p.customer}</option>)}</select></Field>
      <InfoTiles items={[["Khách hàng", payment?.customer], ["Hệ thống ghi nhận", money(payment?.amount || 0)], ["Chênh lệch", actual === "" ? "Chưa nhập" : money(Number(actual) - (payment?.amount || 0))]]} />
      <Field label="Số tiền thực nhận *"><input type="number" min="0" step="1" value={actual} onChange={e => setActual(e.target.value)} /></Field>
      <Field label="Lý do / nội dung cần kiểm tra *"><textarea rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></Field>
      <Notice>Không bấm xác nhận đã thu nếu số tiền hoặc nội dung chưa khớp.</Notice>{error && <Notice tone="error">{error}</Notice>}
      <div className="stack"><Button type="submit" disabled={load.busy}>Kiểm tra & gửi báo cáo</Button><LinkButton to="staff/reconcile" variant="outline">Quay lại</LinkButton></div>
    </form></WorkflowState>{dialog}</main>;
}
