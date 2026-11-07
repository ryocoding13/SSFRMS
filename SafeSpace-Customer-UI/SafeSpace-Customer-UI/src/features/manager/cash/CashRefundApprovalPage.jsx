import React, { useState } from "react";
import { Button, Field, Modal, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { Select } from "../../../shared/components/Pickers.jsx";
import { money } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";
import { CASH_SOURCE, CASH_STATUS, cashPath } from "../../facility-operations/workflows/cashRefundModel.js";

// D42/D44 · Quản lý duyệt chi tiền mặt và giao nhân viên. Không đổi được cách nhận hoàn khách đã chọn.
export function CashRefundApprovalPage() {
  const { ops, reload: reloadOps } = useOps() || {};
  const load = useOpsEndpoint("/api/ops/cash-refunds");
  const [approve, setApprove] = useState(null), [error, setError] = useState("");
  const items = Array.isArray(load.data) ? load.data : [];
  const save = async () => {
    if (!approve.staffId) return setError("Chọn nhân viên chi tiền.");
    const res = await load.post(cashPath(approve.item.id, "approve"), { staffId: approve.staffId });
    if (!res.ok) return setError(res.error);
    setApprove(null); setError("");
    await reloadOps?.();
  };
  return <main className="container page workflow-page">
    <PageHeader title="Hoàn tiền mặt tại quầy" description="Khách chọn nhận tiền mặt khi huỷ đơn, trả kho hoặc kết thúc do sự cố. Duyệt và giao nhân viên chi; quá 30 ngày khách không đến nhận thì mất khoản hoàn." />
    <WorkflowState load={load}>
      {items.map(r => {
        const [label, tone] = CASH_STATUS[r.status] || [r.status, "amber"];
        const staffCode = r.staffId || r.staff_id;
        const staffName = r.staffName || r.staff_name;
        return <RecordCard key={r.id} title={`${r.id} · ${r.customer}`}
          subtitle={`${CASH_SOURCE[r.source] || r.source} ${r.reference} · ${r.phone || "Chưa có SĐT"}`}
          actions={<><Tag tone={tone}>{label}</Tag>{["WAITING_APPROVAL", "READY", "REMIND"].includes(r.status) && <Button disabled={load.busy} onClick={() => setApprove({ item: r, staffId: staffCode || ops.staff[0]?.staff_id || "" })}>{r.status === "WAITING_APPROVAL" ? "Duyệt & giao" : "Giao người khác"}</Button>}</>}>
          <strong className="price money-total">{money(r.amount)}</strong>
          <p className="muted">{r.deadlineDate ? `Hạn nhận ${r.deadlineDate}` : "Chưa duyệt"}{staffName ? ` · nhân viên: ${staffName}` : staffCode ? ` · nhân viên: ${staffCode}` : ""}{r.paidAt ? ` · đã chi ${r.paidAt}${r.paidBy ? ` bởi ${r.paidBy}` : ""}` : ""}{r.appointmentDate ? ` · khách hẹn ${r.appointmentDate}` : ""}</p>
        </RecordCard>; })}
      {!items.length && <WorkflowEmpty title="Chưa có khoản hoàn tiền mặt" text="Khoản khách chọn nhận tiền mặt tại quầy sẽ hiện ở đây." />}
    </WorkflowState>
    {approve && <Modal title={`Duyệt chi tiền mặt · ${approve.item.id}`} onClose={() => { setApprove(null); setError(""); }}>
      <p className="modal__text">Chi {money(approve.item.amount)} cho {approve.item.customer}. Nhân viên được giao tick đủ 4 mục khi chi.</p>
      <Field label="Nhân viên chi tiền *"><Select value={approve.staffId} onChange={e => setApprove({ ...approve, staffId: e.target.value })}>
        {ops.staff.map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>)}
        {!ops.staff.length && <option value="">Chưa có nhân viên tại cơ sở</option>}
      </Select></Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions"><Button variant="outline" onClick={() => { setApprove(null); setError(""); }}>Quay lại</Button><Button disabled={load.busy} onClick={save}>Duyệt chi</Button></div>
    </Modal>}
  </main>;
}
