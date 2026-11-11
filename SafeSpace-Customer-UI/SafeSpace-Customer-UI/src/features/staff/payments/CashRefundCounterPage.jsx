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
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { CASH_STATUS, CASH_SOURCE, cashPath } from "../../facility-operations/workflows/cashRefundModel.js";
import { useMe } from "../hooks/useStaffIdentity.js";

const CALL_RESULTS = {
  APPOINTMENT: "Khách hẹn đến quầy · ghi ngày hẹn",
  NO_ANSWER: "Không nghe máy · nhắc lại ở mốc sau",
  SWITCH_TO_BANK: "Khách muốn đổi sang chuyển khoản",
  WRONG_NUMBER: "Sai số điện thoại · báo quản lý",
};
const PAY_CHECKS = [
  ["identityChecked", "CCCD trùng tên trên hợp đồng"],
  ["codeChecked", "Khách đọc đúng mã đơn và số điện thoại"],
  ["amountCounted", "Đã đếm đủ tiền trước mặt khách"],
  ["signed", "Khách đã nhận tiền và ký sổ chi tại quầy"],
];

// Figma S10 / S10b · D42/D44: nhân viên gọi nhắc (ngày 10, 20, 25) và chi tiền hoàn tại quầy sau khi quản lý duyệt.
/**
 * Màn hình nhân viên thực hiện chi trả tiền mặt cho khách hàng tại cơ sở.
 */
export function CashRefundCounterPage() {
  const { reload: reloadOps } = useOps() || {};
  const load = useOpsEndpoint("/api/ops/cash-refunds");
  const me = useMe();
  const [call, setCall] = useState(null), [pay, setPay] = useState(null), [error, setError] = useState("");
  const items = (Array.isArray(load.data) ? load.data : []).filter(r =>
    ["READY", "REMIND", "APPOINTMENT"].includes(r.status) &&
    (!r.staffId && !r.staff_id || !me?.staff_id || (r.staffId || r.staff_id) === me.staff_id)
  );
  const close = () => { setCall(null); setPay(null); setError(""); };
  const saveCall = async () => {
    if (call.result === "APPOINTMENT" && !call.appointmentDate) return setError("Chọn ngày khách hẹn đến quầy.");
    const res = await load.post(cashPath(call.item.id, "calls"), { result: call.result, appointmentDate: call.result === "APPOINTMENT" ? call.appointmentDate : null, note: call.note.trim() || null });
    if (res.ok) { close(); await reloadOps?.(); } else setError(res.error);
  };
  const savePay = async () => {
    if (PAY_CHECKS.some(([k]) => !pay[k])) return setError("Tick đủ 4 mục trước khi xác nhận đã chi.");
    const { item, ...checks } = pay;
    const res = await load.post(cashPath(item.id, "pay"), checks);
    if (res.ok) { close(); await reloadOps?.(); } else setError(res.error);
  };
  return <main className="container page workflow-page">
    <PageHeader title="Chi tiền hoàn tại quầy" description="Khoản quản lý đã duyệt. Gọi nhắc khách ở ngày 10, 20 và 25; quá 30 ngày khách chưa đến nhận thì mất khoản hoàn." />
    <WorkflowState load={load}>
      {items.map(r => {
        const staffCode = r.staffId || r.staff_id;
        const staffName = r.staffName || r.staff_name;
        const isOther = staffCode && me?.staff_id && staffCode !== me.staff_id;
        return <RecordCard key={r.id} title={`${r.id} · ${r.customer}`} subtitle={`${CASH_SOURCE[r.source] || r.source} ${r.reference} · ${r.phone || "Chưa có SĐT"}`}
          status={CASH_STATUS[r.status]?.[0] || r.status}
          actions={isOther ? <span className="hint">Đã giao cho {staffName || staffCode}</span> : <><Button variant="outline" disabled={load.busy} onClick={() => setCall({ item: r, result: "APPOINTMENT", appointmentDate: "", note: "" })}>Ghi cuộc gọi</Button>
            <Button disabled={load.busy} onClick={() => setPay({ item: r })}>Chi tiền</Button></>}>
          <strong className="price money-total">{money(r.amount)}</strong>
          <p className="muted">Hạn nhận {r.deadlineDate}{staffName ? ` · nhân viên: ${staffName}` : staffCode ? ` · nhân viên: ${staffCode}` : ""}{r.daysSinceApproved != null ? ` · ngày ${r.daysSinceApproved} sau khi duyệt` : ""}{r.appointmentDate ? ` · khách hẹn ${r.appointmentDate}` : ""}{r.lastCall ? ` · lần gọi trước: ${r.lastCall}` : ""}</p>
        </RecordCard>;
      })}
      {!items.length && <WorkflowEmpty title="Không có khoản chờ chi" text="Khoản tiền mặt quản lý đã duyệt và phân công cho bạn sẽ hiện ở đây." />}
    </WorkflowState>
    {call && <Modal title={`Kết quả cuộc gọi · ${call.item.id}`} onClose={close}>
      <fieldset className="choice-list">{Object.entries(CALL_RESULTS).map(([k, label]) => <label key={k} className="choice-list__item"><input type="radio" name="call" checked={call.result === k} onChange={() => setCall({ ...call, result: k })} /><span>{label}</span></label>)}</fieldset>
      {call.result === "APPOINTMENT" && <DatePicker label="Ngày khách hẹn đến quầy *" value={call.appointmentDate} min={today()} onChange={v => setCall({ ...call, appointmentDate: v })} />}
      <Field label="Ghi chú (không bắt buộc)"><textarea rows={2} maxLength={500} value={call.note} onChange={e => setCall({ ...call, note: e.target.value })} /></Field>
      <p className="hint">Có ngày hẹn thì hệ thống tạm dừng gọi nhắc. Khách muốn đổi sang chuyển khoản tự đổi trong tài khoản trong thời hạn 30 ngày.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions"><Button variant="outline" onClick={close}>Để sau</Button><Button disabled={load.busy} onClick={saveCall}>Lưu kết quả gọi</Button></div>
    </Modal>}
    {pay && <Modal title={`Chi tiền hoàn · ${pay.item.id}`} onClose={close}>
      <p className="modal__text">Chi {money(pay.item.amount)} cho {pay.item.customer}. Không chi nếu chưa đối chiếu đủ.</p>
      <fieldset className="choice-list">{PAY_CHECKS.map(([k, label]) => <label key={k} className="choice-list__item"><input type="checkbox" checked={!!pay[k]} onChange={e => setPay({ ...pay, [k]: e.target.checked })} /><span>{label}</span></label>)}</fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions"><Button variant="outline" onClick={close}>Quay lại</Button><Button disabled={load.busy} onClick={savePay}>Xác nhận đã chi</Button></div>
    </Modal>}
  </main>;
}
