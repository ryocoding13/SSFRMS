import React from "react";
import { EmptyInline } from "../components/Inline";
import { LinkButton } from "../components/UI";
import { typeLabel } from "../lib/catalog";
import { dateLabel, dayMonth } from "../lib/format";
import { href } from "../lib/router";
import { CONTRACT_STATUS } from "../lib/status";
import {
  activeContracts,
  contractStatus,
  expiringContracts,
  facilityOf,
  milestones,
  pendingRenewal,
  pendingReturn,
  unpaidCount,
  upcomingAppointments,
} from "../state/selectors";
import { useApp } from "../state/store";

const TONES = { amber: "#b45309", green: "#047857", blue: "#2563eb" };

export default function Overview() {
  const { data } = useApp();
  const now = new Date();
  const active = activeContracts(data, now);
  const expiring = expiringContracts(data, now);
  const unpaid = unpaidCount(data);
  const nextAppt = upcomingAppointments(data, now)[0];
  const renewTarget = expiring.find((c) => !pendingRenewal(data, c.contract_id) && !pendingReturn(data, c.contract_id));
  const firstContract = active[0];
  const marks = milestones(data, now);
  const activities = data.activities.slice(0, 4);

  const tiles = [
    renewTarget
      ? { title: `Gia hạn kho ${renewTarget.unit_number}`, text: `Hợp đồng kết thúc ${dateLabel(renewTarget.end_date)}`, cta: "Gửi yêu cầu gia hạn", to: `units/${renewTarget.contract_id}/renew` }
      : { title: "Tìm kho mới", text: "Chọn loại kho và diện tích phù hợp", cta: "Bắt đầu tìm kho", to: "find" },
    firstContract
      ? { title: "Xem hợp đồng", text: `${firstContract.contract_id} · Kho ${firstContract.unit_number}`, cta: "Mở hợp đồng", to: `units/${firstContract.contract_id}` }
      : { title: "Đơn đặt chỗ", text: "Theo dõi đơn và trạng thái đối soát", cta: "Xem đơn", to: "reservations" },
    {
      title: "Thanh toán & lịch hẹn",
      text: nextAppt ? `${nextAppt.kind === "CHECK_IN" ? "Nhận kho" : "Trả kho"} ${nextAppt.unit_number} ngày ${dayMonth(nextAppt.date)} · ${nextAppt.slot.slice(0, 5)}` : "Xem khoản thu và lịch hẹn",
      cta: "Xem chi tiết",
      to: "payments",
    },
    { title: "Cần hỗ trợ?", text: "Gửi yêu cầu đến cơ sở, theo dõi phản hồi", cta: "Gửi yêu cầu", to: "support" },
  ];

  return (
    <main className="container page">
      <header className="page-header">
        <div>
          <h1>Xin chào, {data.user.full_name}</h1>
          <p>Đây là tổng quan các kho bạn đang thuê tại SafeSpace.</p>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><strong>{active.length}</strong><span>Kho đang thuê</span></div>
        <div className="stat"><strong className="warn">{expiring.length}</strong><span>Sắp hết hạn (30 ngày)</span></div>
        <div className="stat"><strong className="ok">{unpaid}</strong><span>Hoá đơn chưa thanh toán</span></div>
      </div>

      <h2 className="section-title">Kho đang thuê</h2>
      {active.length === 0 ? (
        <EmptyInline text="Bạn chưa thuê kho nào. Tìm cơ sở phù hợp để bắt đầu." />
      ) : (
        <ul className="rows">
          {active.map((c) => {
            const f = facilityOf(data, c.facility_id);
            const status = contractStatus(c, now);
            const [label, tone] = CONTRACT_STATUS[status];
            return (
              <li key={c.contract_id}>
                <a className="row" href={href(`units/${c.contract_id}`)}>
                  <span className="row__icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 3 8v9l9 5 9-5V8l-9-5ZM3 8l9 5 9-5M12 13v9" /></svg>
                  </span>
                  <span className="row__main">
                    <strong>Kho #{c.unit_number}</strong>
                    <span>SafeSpace {f.district} · {typeLabel(c.type)} · {c.size_m2} m²</span>
                  </span>
                  <span className="row__side">
                    <span className={`tag tag--${tone}`}>{status === "ACTIVE" ? "Đang hoạt động" : label}</span>
                    <small>Hết hạn: {dateLabel(c.end_date)}</small>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <LinkButton to="find">Tìm kho mới</LinkButton>

      <h2 className="section-title">Hành động nhanh</h2>
      <div className="tiles">
        {tiles.map((t) => (
          <a className="panel tile" key={t.title} href={href(t.to)}>
            <strong>{t.title}</strong>
            <span>{t.text}</span>
            <em>{t.cta} →</em>
          </a>
        ))}
      </div>

      <h2 className="section-title">Mốc sắp tới & hoạt động</h2>
      <div className="grid grid--2">
        <section className="panel timeline">
          <h3>Mốc sắp tới</h3>
          {marks.length === 0 && <p className="muted">Chưa có mốc nào sắp tới.</p>}
          {marks.map((m) => (
            <div className="milestone" key={m.key}>
              <span className="milestone__date">{dayMonth(m.date)}</span>
              <div>
                <strong>{m.title}</strong>
                <span>{m.detail}</span>
              </div>
            </div>
          ))}
        </section>
        <section className="panel timeline">
          <h3>Hoạt động gần đây</h3>
          {activities.length === 0 && <p className="muted">Hoạt động của bạn sẽ hiện ở đây.</p>}
          {activities.map((a) => (
            <div className="activity" key={a.id}>
              <i style={{ background: TONES[a.tone] || TONES.blue }} aria-hidden="true" />
              <div>
                <strong>{a.text}</strong>
                <span>{dateLabel(a.at)}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
