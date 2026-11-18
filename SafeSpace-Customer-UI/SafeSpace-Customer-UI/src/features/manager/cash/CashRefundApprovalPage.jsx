/**
 * CASH REFUND PAGE - HOÀN TIỀN MẶT TẠI QUẦY (M08 / D42 / D44 / D66)
 *
 * - Khách chọn nhận tiền hoàn bằng tiền mặt khi huỷ đơn, trả kho hoặc kết thúc do sự cố.
 * - D66 (18/11): mỗi cơ sở 1 nhân viên nên không còn bước duyệt & giao nhân viên. Khi khách đến nhận đủ tiền,
 *   quản lý bấm "Xác nhận đã trả tiền mặt" (Figma M-ĐS-CHỐT · tiền mặt). Không nhập mã giao dịch.
 * - Hạn nhận tiền mặt 30 ngày; quá hạn khách mất khoản hoàn (FORFEITED). Nhân viên gọi nhắc ở ngày 10, 20, 25.
 */
import React, { useState } from "react";
import { Button, DetailList, Modal, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";
import { CASH_SOURCE, CASH_STATUS, cashPath } from "../../facility-operations/workflows/cashRefundModel.js";

const OPEN = ["WAITING_APPROVAL", "READY", "REMIND", "APPOINTMENT"];
// Máy chủ vẫn nhận bốn mục đối chiếu; quản lý xác nhận một lần thay cho các mục này.
const CONFIRM_ALL = { identityChecked: true, codeChecked: true, amountCounted: true, signed: true };

/**
 * Màn hình quản lý cơ sở xác nhận đã trả tiền mặt cho khách tại quầy.
 */
export function CashRefundApprovalPage({ embedded = false } = {}) {
  const { reload: reloadOps } = useOps() || {};
  const load = useOpsEndpoint("/api/ops/cash-refunds");
  const [paying, setPaying] = useState(null), [error, setError] = useState("");
  const items = Array.isArray(load.data) ? load.data : [];
  const close = () => { setPaying(null); setError(""); };
  const save = async () => {
    const res = await load.post(cashPath(paying.id, "pay"), CONFIRM_ALL);
    if (!res.ok) return setError(res.error || "Chưa ghi nhận được. Tải lại trước khi thử tiếp; không trả tiền lần nữa.");
    close();
    await reloadOps?.();
  };
  const Wrap = embedded ? "section" : "main";
  return <Wrap className={embedded ? "refund-center__section" : "container page workflow-page"}>
    {embedded ? <h2 className="section-title">Hoàn tiền mặt tại quầy</h2> : <PageHeader title="Hoàn tiền mặt tại quầy" description="Khách chọn nhận tiền mặt khi huỷ đơn, trả kho hoặc kết thúc do sự cố. Khi khách đến nhận đủ tiền, bấm xác nhận; quá 30 ngày khách không đến nhận thì mất khoản hoàn." />}
    <WorkflowState load={load}>
      {items.map(r => {
        const [label, tone] = CASH_STATUS[r.status] || [r.status, "amber"];
        return <RecordCard key={r.id} title={`${r.id} · ${r.customer}`}
          subtitle={`${CASH_SOURCE[r.source] || r.source} ${r.reference} · ${r.phone || "Chưa có SĐT"}`}
          actions={<><Tag tone={tone}>{label}</Tag>{OPEN.includes(r.status) && <Button disabled={load.busy} onClick={() => setPaying(r)}>Xác nhận đã trả tiền mặt</Button>}</>}>
          <strong className="price money-total">{money(r.amount)}</strong>
          <p className="muted">{r.deadlineDate ? `Hạn nhận ${r.deadlineDate}` : "Chờ khách đến nhận"}{r.paidAt ? ` · đã trả ${r.paidAt}${r.paidBy ? ` bởi ${r.paidBy}` : ""}` : ""}{r.appointmentDate ? ` · khách hẹn ${r.appointmentDate}` : ""}</p>
        </RecordCard>; })}
      {!items.length && <WorkflowEmpty title="Chưa có khoản hoàn tiền mặt" text="Khoản khách chọn nhận tiền mặt tại quầy sẽ hiện ở đây." />}
    </WorkflowState>
    {paying && <Modal title="Xác nhận đã trả tiền mặt?" onClose={close}>
      <p className="modal__text">Chỉ xác nhận khi khách đã nhận đủ tiền tại quầy. Không cần nhập mã giao dịch.</p>
      <DetailList items={[["Khoản hoàn", paying.id], ["Người nhận", `${paying.customer}${paying.phone ? ` · ${paying.phone}` : ""}`], ["Số tiền cần trả", money(paying.amount)]]} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions"><Button variant="outline" onClick={close}>Quay lại</Button><Button disabled={load.busy} onClick={save}>Đã trả tiền mặt</Button></div>
    </Modal>}
  </Wrap>;
}
