import React, { useState } from "react";
import { DetailList, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { DatePicker } from "../../../shared/components/Pickers.jsx";
import { addDays, today } from "../../../shared/utils/format.js";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";

const KIND = { RETURN: "Biên bản trả kho", TICKET: "Hỗ trợ", HANDOVER: "Bàn giao chìa", CASH_CALL: "Gọi nhắc nhận tiền", CASH_PAY: "Chi tiền mặt" };

// D42 · Báo cáo cuối ngày: việc chưa xong và việc đã làm của từng nhân viên (hệ thống ghi lúc 22:00).
export function DailyStaffReportPage() {
  const [date, setDate] = useState(today());
  const load = useOpsEndpoint(`/api/ops/daily-report?date=${date}`);
  const rows = load.data?.staff || [];
  const task = t => `${KIND[t.kind] || t.kind} · ${t.label || t.reference}${t.late ? " · quá hạn" : ""}`;
  return <main className="container page workflow-page">
    <PageHeader title="Báo cáo cuối ngày" description="Việc nhân viên chưa xong và đã làm trong ngày. Việc xếp theo thời gian tạo; quá 3 ngày chỉ gắn nhãn." />
    <DatePicker label="Ngày báo cáo" value={date} min={addDays(today(), -90)} onChange={setDate} />
    <WorkflowState load={load}>
      {rows.map(s => <RecordCard key={s.staffId} title={`${s.fullName} · ${s.staffId}`} subtitle={s.oldestPendingSince ? `Việc chưa xong cũ nhất từ ${s.oldestPendingSince}` : "Không còn việc tồn"}
        actions={<Tag tone={s.pending ? "amber" : "green"}>{s.pending ? `${s.pending} việc chưa xong` : "Đã xong hết"}</Tag>}>
        <DetailList items={[["Đã làm", String(s.done)], ["Chưa xong", String(s.pending)]]} />
        {s.pendingTasks?.length > 0 && <ul className="muted">{s.pendingTasks.map(t => <li key={`${t.kind}-${t.reference}`}>{task(t)}</li>)}</ul>}
        {s.history?.length > 0 && <details><summary>Lịch sử việc đã làm ({s.history.length})</summary><ul>{s.history.map((t, i) => <li key={i}>{t.at} · {task(t)}</li>)}</ul></details>}
      </RecordCard>)}
      {!rows.length && <WorkflowEmpty title="Chưa có dữ liệu" text="Ngày này chưa có việc của nhân viên." />}
    </WorkflowState>
  </main>;
}
