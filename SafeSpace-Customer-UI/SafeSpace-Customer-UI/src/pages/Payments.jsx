import React from "react";
import { Empty, LinkButton, PageHeader, StatusTag } from "../components/UI";
import { dateLabel, money, shortCode } from "../lib/format";
import { APPOINTMENT_STATUS, LEDGER_STATUS } from "../lib/status";
import { facilityOf } from "../state/selectors";
import { useApp } from "../state/store";

export default function Payments() {
  const { data } = useApp();
  const appointments = [...data.appointments].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <main className="container page">
      <PageHeader title="Thanh toán & lịch hẹn" description="Các khoản phí, trạng thái đối soát và lịch nhận kho của bạn." />

      {appointments.length === 0 ? (
        <Empty title="Chưa có lịch hẹn" text="Lịch nhận hoặc trả kho sẽ xuất hiện tại đây sau khi cơ sở xác nhận." />
      ) : (
        appointments.map((a) => {
          const f = facilityOf(data, a.facility_id);
          return (
            <section className="panel appointment" key={a.appointment_id}>
              <StatusTag map={APPOINTMENT_STATUS} status={a.status} square />
              <h2>{dateLabel(a.date)} · {a.slot}</h2>
              <p className="muted">
                {a.kind === "CHECK_IN" ? "Nhận kho" : "Trả kho"} {a.unit_number} · {f.name} · Mã đặt chỗ #{a.reservation_id}
                <br />
                {a.note}
              </p>
              <LinkButton to={`support?contract=${encodeURIComponent(a.contract_id)}&topic=SCHEDULE`} variant="outline">Cần đổi lịch?</LinkButton>
            </section>
          );
        })
      )}

      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Khoản thu</th>
              <th>Mã tham chiếu</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {data.ledger.map((l) => (
              <tr key={l.ref}>
                <td>{l.label}</td>
                <td>{l.ref}</td>
                <td>{money(l.amount)}</td>
                <td>{LEDGER_STATUS[l.status][0]}</td>
              </tr>
            ))}
            {data.ledger.length === 0 && (
              <tr>
                <td colSpan={4} className="table__empty">Chưa có khoản thu nào. Khoản thu xuất hiện sau khi bạn xác nhận chuyển khoản đặt chỗ.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
