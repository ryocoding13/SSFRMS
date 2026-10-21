import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Empty, Field, LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { TICKET_STATE } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { useMe } from "../hooks/useStaffIdentity.js";

export const NEXT_STATES = [
  ["WAITING_CUSTOMER", "Chờ khách xác nhận đã sử dụng được"],
  ["IN_PROGRESS", "Tiếp tục xử lý tại cơ sở"],
  ["DONE", "Đã xử lý xong · Đóng yêu cầu"],
];

export function StaffSupportPage({ query }) {
  const { ops, run } = useOps();
  const me = useMe();
  const mine = ops.tickets.filter((t) => t.status !== "DONE" && (t.assignee === me.staff_id || !t.assignee));
  const t = ops.tickets.find((x) => x.id === query.get("id")) || mine[0];
  const [note, setNote] = useState("Đã kiểm tra thông tin và hẹn hỗ trợ tại cơ sở.");
  const [next, setNext] = useState("WAITING_CUSTOMER");
  const [err, setErr] = useState("");
  if (!t)
    return (
      <main className="container page">
        <Empty title="Không có yêu cầu hỗ trợ" text="Yêu cầu được phân công cho bạn sẽ hiện ở đây.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const assignee = ops.staff.find((s) => s.staff_id === t.assignee);
  const submit = async (e) => {
    e.preventDefault();
    const r = await run("TICKET_RESPONSE", { id: t.id, note, next, staff: me.staff_id }, `Đã lưu phản hồi ${t.id}`);
    if (!r.ok) return setErr(r.error);
    go("staff/done?kind=support");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/support")}>← Danh sách hỗ trợ</a>
      <form className="panel ops-card" onSubmit={submit} noValidate>
        <div className="ops-card__head">
          <h1>Yêu cầu hỗ trợ {t.id}</h1>
          <Tag tone={TICKET_STATE[t.status][1]}>{TICKET_STATE[t.status][0]}</Tag>
        </div>
        <p className="muted">{ops.facility.name} · Kho {t.unit} · {t.customer}</p>
        <div className="note-box">
          <strong>{t.title}</strong>
          <p className="muted">Khách gửi {dateTimeLabel(t.created_at)}. Nhân viên phụ trách: {assignee?.full_name || "chưa phân công"}.</p>
        </div>
        {t.notes.length > 0 && (
          <ul className="ops-notes">
            {t.notes.map((n, i) => <li key={i}><small>{dateTimeLabel(n.at)}</small>{n.text}</li>)}
          </ul>
        )}
        {t.status === "DONE" ? (
          <Notice tone="success">Yêu cầu đã đóng.</Notice>
        ) : (
          <>
            <Field label="Ghi nhận xử lý" error={err}>
              <textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} />
            </Field>
            <Field label="Trạng thái tiếp theo">
              <Select value={next} onChange={(e) => setNext(e.target.value)}>
                {NEXT_STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Button type="submit">Lưu phản hồi</Button>
          </>
        )}
      </form>
    </main>
  );
}
