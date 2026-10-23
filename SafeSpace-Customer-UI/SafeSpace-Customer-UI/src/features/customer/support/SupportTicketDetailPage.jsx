import React from "react";
import { Empty, Icon, LinkButton, StatusTag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { href } from "../../../app/router.js";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { TICKET_STATUS, TICKET_TOPICS } from "../../../shared/utils/status.js";
import bluePoint from "../../../assets/customer/auth-support/timeline-blue.svg";
import greenPoint from "../../../assets/customer/auth-support/timeline-green.svg";
import pendingPoint from "../../../assets/customer/auth-support/timeline-pending.svg";

function TimelineStep({ title, at, by, pending, success, children }) {
  return <li className={`support-step${pending ? " support-step--pending" : ""}${success ? " support-step--success" : ""}`}>
    <div className="support-step__marker"><img src={pending ? pendingPoint : success ? greenPoint : bluePoint} alt="" /></div>
    <div className="support-step__body">
      <div className="support-step__title"><strong>{title}</strong><span>{[at && dateTimeLabel(at), by].filter(Boolean).map((text) => ` · ${text}`).join("")}</span></div>
      {children}
    </div>
  </li>;
}

export default function SupportTicketDetailPage({ id }) {
  const { data } = useApp();
  const ticket = data.tickets.find((t) => t.ticket_id === id || String(t.api_id) === id);
  if (!ticket) return <main className="container page"><Empty title="Không tìm thấy yêu cầu hỗ trợ" text="Yêu cầu không tồn tại hoặc không thuộc tài khoản đang đăng nhập."><LinkButton to="support">Quay lại Hỗ trợ</LinkButton></Empty></main>;
  const contract = data.contracts.find((c) => c.contract_id === ticket.contract_id);
  const facility = contract && facilityOf(data, contract.facility_id, contract.facility_name);
  const replies = ticket.responses || [];
  return <main className="container page support-detail">
    <a className="support-back" href={href("support")}><Icon name="back" size={14} /> Quay lại Hỗ trợ</a>
    <h1>{ticket.ticket_id} · {ticket.title || TICKET_TOPICS[ticket.topic]?.title}</h1>
    <p className="muted">Gửi lúc {dateTimeLabel(ticket.created_at)}</p>
    <section className="panel support-progress" aria-label="Tiến trình xử lý">
      <div className="stack"><h2>Tiến trình xử lý</h2><StatusTag map={TICKET_STATUS} status={ticket.status} square /></div>
      <dl className="support-facts">
        <div><dt>Loại sự cố</dt><dd>{TICKET_TOPICS[ticket.topic]?.label || ticket.topic}</dd></div>
        <div><dt>Kho</dt><dd>{[contract?.unit_number || ticket.unit_number, facility?.name].filter(Boolean).join(" · ") || "Chưa có thông tin kho"}</dd></div>
        <div><dt>Nhân viên phản hồi</dt><dd>{replies.at(-1)?.by || "Chưa có phản hồi"}</dd></div>
      </dl>
      {ticket.responses_error && <p role="alert" className="password-error">Chưa tải được phản hồi. Vui lòng quay lại Hỗ trợ và cập nhật yêu cầu.</p>}
      <ol className="support-timeline">
        <TimelineStep title="Đã gửi yêu cầu" at={ticket.created_at} by="Bạn">
          <p className="support-description">{ticket.description}</p>
          {ticket.attachments?.length > 0 && <div className="support-attachments"><strong>Ảnh đính kèm ({ticket.attachments.length})</strong><ul>{ticket.attachments.map((name, i) => <li key={i}>{name}</li>)}</ul></div>}
        </TimelineStep>
        <TimelineStep title="Nhân viên tiếp nhận" at={ticket.assigned_at} pending={!ticket.assigned_at} by={!ticket.assigned_at ? "Chưa có thời gian tiếp nhận" : null} />
        {replies.map((reply, index) => <TimelineStep key={`${reply.at}-${index}`} title={index === replies.length - 1 && ticket.status === "RESOLVED" ? "Đã xử lý" : "Nhân viên phản hồi"} at={reply.at} by={reply.by} success={index === replies.length - 1 && ticket.status === "RESOLVED"}>
          <div className="support-response"><strong>Phản hồi của nhân viên</strong><p>{reply.text}</p></div>
        </TimelineStep>)}
        {replies.length === 0 && !ticket.responses_error && <TimelineStep title="Phản hồi của nhân viên" pending by="Chưa có phản hồi" />}
        <TimelineStep title={ticket.raw_status === "CANCELLED" ? "Đã huỷ yêu cầu" : "Đóng yêu cầu"} at={ticket.closed_at} pending={!ticket.closed_at} by={!ticket.closed_at && ticket.raw_status !== "CANCELLED" ? "Chưa đóng" : null} />
      </ol>
      <p className="hint">Chỉ hủy được yêu cầu khi nhân viên chưa tiếp nhận. Nếu đang đứng tại cổng cơ sở, liên hệ nhân viên trực để được hỗ trợ ngay.</p>
    </section>
  </main>;
}
