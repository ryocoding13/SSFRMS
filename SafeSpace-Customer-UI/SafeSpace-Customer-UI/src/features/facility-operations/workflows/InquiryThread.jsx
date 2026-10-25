import React, { useState } from "react";
import { Button, Field, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { InfoTiles, useWorkflowChange } from "./WorkflowComponents.jsx";

export function InquiryThread({ ticket, load, customer = false }) {
  const [note, setNote] = useState(""), [error, setError] = useState(""), [close, setClose] = useState(false);
  const [dialog, ask] = useWorkflowChange(load);
  return <section className="panel form-card"><h2>{ticket.id} · {ticket.title}</h2><InfoTiles items={[["Khách hàng", ticket.customer], ["Hợp đồng", "Chưa có hợp đồng"], ["Trạng thái", ticket.status === "OPEN" ? "Chờ cơ sở phản hồi" : ticket.status === "CLOSED" ? "Đã đóng" : "Chờ khách phản hồi"]]} /><p>{ticket.description}</p>
    <ol className="workflow-thread">{ticket.responses.map((r, i) => <li key={`${r.at}-${i}`}><strong>{r.by} · {dateTimeLabel(r.at)}</strong><p>{r.text}</p></li>)}</ol>
    {ticket.status !== "CLOSED" && <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return setError("Vui lòng nhập nội dung phản hồi trước khi gửi."); setError(""); ask("REPLY_INQUIRY", { id: ticket.id, note, close }, "Gửi phản hồi?", "Kiểm tra nội dung và trạng thái yêu cầu trước khi gửi."); }}><Field label="Nội dung phản hồi *" error={error}><textarea rows={3} value={note} maxLength={1000} onChange={e => { setNote(e.target.value); setError(""); }} /></Field>{!customer && <label className="check"><input type="checkbox" checked={close} onChange={e => setClose(e.target.checked)} /> Đóng yêu cầu sau khi phản hồi</label>}<Button type="submit" disabled={load.busy}>Kiểm tra & gửi phản hồi</Button></form>}
    {!ticket.responses.length && <Notice>Cơ sở chưa có phản hồi trong yêu cầu này.</Notice>}{dialog}
  </section>;
}
