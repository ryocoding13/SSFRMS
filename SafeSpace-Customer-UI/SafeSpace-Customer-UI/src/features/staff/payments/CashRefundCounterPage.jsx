/**
 * CASH REFUND COUNTER PAGE - THỰC HIỆN CHI TRẢ TIỀN MẶT TẠI QUẦY (S10 / D42 / D44)
 *
 * Quy trình chi tiền mặt 4 bước:
 * 1. Kiểm tra đối chiếu giấy tờ tùy thân chính chủ người nhận.
 * 2. Đối chiếu mã tham chiếu hoàn tiền từ hệ thống.
 * 3. Đếm đủ số tiền mặt cần hoàn trả.
 * 4. Khách hàng ký nhận biên bản chi tiền mặt.
 */
import React, { useState } from "react";
import { Button, Field, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { DatePicker } from "../../../shared/components/Pickers.jsx";
import { money, today } from "../../../shared/utils/format.js";
import { vnDate } from "../../../shared/utils/vnTime.js";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { CASH_STATUS, CASH_SOURCE, cashPath } from "../../facility-operations/workflows/cashRefundModel.js";

const CALL_RESULTS = {
  APPOINTMENT: "Khách hẹn đến quầy · ghi ngày hẹn",
  NO_ANSWER: "Không nghe máy · nhắc lại ở mốc sau",
  SWITCH_TO_BANK: "Khách muốn đổi sang chuyển khoản",
  WRONG_NUMBER: "Sai số điện thoại · báo quản lý",
};

// Figma S10b · D42/D44/D66: nhân viên chỉ gọi nhắc khách (ngày 10, 20, 25); quản lý xác nhận đã trả tiền mặt.
/**
 * Màn hình nhân viên thực hiện chi trả tiền mặt cho khách hàng tại cơ sở.
 */
export function CashRefundCounterPage() {
  const { reload: reloadOps } = useOps() || {};
  const load = useOpsEndpoint("/api/ops/cash-refunds");
  const [call, setCall] = useState(null), [error, setError] = useState("");
  const items = (Array.isArray(load.data) ? load.data : []).filter(r => ["WAITING_APPROVAL", "READY", "REMIND", "APPOINTMENT"].includes(r.status));
  const close = () => { setCall(null); setError(""); };
  const saveCall = async () => {
    if (call.result === "APPOINTMENT" && !call.appointmentDate) return setError("Chọn ngày khách hẹn đến quầy.");
    const deadline = String(call.item?.deadlineDate || "").slice(0, 10);
    if (call.result === "APPOINTMENT" && (call.appointmentDate < today() || (deadline && call.appointmentDate > deadline))) return setError(`Ngày hẹn phải từ hôm nay${deadline ? ` đến hạn nhận ${vnDate(deadline)}` : ""}.`);
    const res = await load.post(cashPath(call.item.id, "calls"), { result: call.result, appointmentDate: call.result === "APPOINTMENT" ? call.appointmentDate : null, note: call.note.trim() || null });
    if (res.ok) { close(); await reloadOps?.(); } else setError(res.error);
  };
  return <main className="container page workflow-page">
    <PageHeader title="Gọi nhắc nhận tiền hoàn" description="Khách chọn nhận tiền mặt tại quầy. Gọi nhắc khách ở ngày 10, 20 và 25; khi khách đến, quản lý xác nhận đã trả tiền. Quá 30 ngày khách chưa đến nhận thì mất khoản hoàn." />
    <WorkflowState load={load}>
      {items.map(r => {
        return <RecordCard key={r.id} title={`${r.id} · ${r.customer}`} subtitle={`${CASH_SOURCE[r.source] || r.source} ${r.reference} · ${r.phone || "Chưa có SĐT"}`}
          status={CASH_STATUS[r.status]?.[0] || r.status}
          actions={<Button variant="outline" disabled={load.busy} onClick={() => setCall({ item: r, result: "APPOINTMENT", appointmentDate: "", note: "" })}>Ghi cuộc gọi</Button>}>
          <strong className="price money-total">{money(r.amount)}</strong>
          <p className="muted">Hạn nhận {r.deadlineDate ? vnDate(r.deadlineDate) : "Chưa có thông tin"}{r.daysSinceApproved != null ? ` · ngày ${r.daysSinceApproved} kể từ khi chốt hoàn` : ""}{r.appointmentDate ? ` · khách hẹn ${r.appointmentDate}` : ""}{r.lastCall ? ` · lần gọi trước: ${r.lastCall}` : ""}</p>
        </RecordCard>;
      })}
      {!items.length && <WorkflowEmpty title="Không có khoản cần gọi nhắc" text="Khoản khách chọn nhận tiền mặt tại quầy sẽ hiện ở đây." />}
    </WorkflowState>
    {call && <Modal title={`Kết quả cuộc gọi · ${call.item.id}`} onClose={close}>
      <fieldset className="choice-list">{Object.entries(CALL_RESULTS).map(([k, label]) => <label key={k} className="choice-list__item"><input type="radio" name="call" checked={call.result === k} onChange={() => setCall({ ...call, result: k })} /><span>{label}</span></label>)}</fieldset>
      {call.result === "APPOINTMENT" && <DatePicker label="Ngày khách hẹn đến quầy *" value={call.appointmentDate} min={today()} max={String(call.item?.deadlineDate || "").slice(0, 10) || undefined} onChange={v => setCall({ ...call, appointmentDate: v })} />}
      <Field label="Ghi chú (không bắt buộc)"><textarea rows={2} maxLength={500} value={call.note} onChange={e => setCall({ ...call, note: e.target.value })} /></Field>
      <p className="hint">Có ngày hẹn thì hệ thống tạm dừng gọi nhắc. Khách muốn đổi sang chuyển khoản tự đổi trong tài khoản trong thời hạn 30 ngày.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions"><Button variant="outline" onClick={close}>Để sau</Button><Button disabled={load.busy} onClick={saveCall}>Lưu kết quả gọi</Button></div>
    </Modal>}
  </main>;
}
