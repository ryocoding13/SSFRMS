import React, { useState } from "react";
import { Button, Field, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { InfoTiles, useWorkflowChange } from "./WorkflowComponents.jsx";

export function InquiryThread({ ticket, load, customer = false }) {
  // D43: hỗ trợ là cuộc trò chuyện — không có thao tác đóng; yêu cầu CLOSED cũ hiển thị "Đã trả lời" và vẫn nhắn tiếp được
  const [note, setNote] = useState(""), [error, setError] = useState("");
  const [dialog, ask] = useWorkflowChange(load);
  return <section className="panel form-card"><h2>{ticket.id} · {ticket.title}</h2><InfoTiles items={[["Khách hàng", ticket.customer], ["Hợp đồng", "Chưa có hợp đồng"], ["Trạng thái", ticket.status === "OPEN" ? "Chờ cơ sở phản hồi" : ticket.status === "CLOSED" ? "Đã trả lời" : "Chờ khách phản hồi"]]} /><p>{ticket.description}</p>
    <ol className="workflow-thread">{ticket.responses.map((r, i) => <li key={`${r.at}-${i}`}><strong>{r.by} · {dateTimeLabel(r.at)}</strong><p>{r.text}</p></li>)}</ol>
    {<form onSubmit={e => { e.preventDefault(); if (!note.trim()) return setError("Vui lòng nhập nội dung phản hồi trước khi gửi."); setError(""); ask("REPLY_INQUIRY", { id: ticket.id, note }, "Gửi phản hồi?", "Kiểm tra nội dung và trạng thái yêu cầu trước khi gửi."); }}><Field label="Nội dung phản hồi *" error={error}><textarea rows={3} value={note} maxLength={1000} onChange={e => { setNote(e.target.value); setError(""); }} /></Field><Button type="submit" disabled={load.busy}>Kiểm tra & gửi phản hồi</Button></form>}
    {!ticket.responses.length && <Notice>Cơ sở chưa có phản hồi trong yêu cầu này.</Notice>}{dialog}
  </section>;
}
