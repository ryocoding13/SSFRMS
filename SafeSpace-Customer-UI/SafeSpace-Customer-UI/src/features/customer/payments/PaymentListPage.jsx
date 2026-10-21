import React, { useState } from "react";
import PayosModal from "../../../shared/components/PayosModal.jsx";
import { Button, Empty, LinkButton, Notice, PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { APPOINTMENT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

// C11 — Thanh toán & lịch hẹn. Khoản gia hạn đã duyệt có nút "Thanh toán" mở QR PayOS (C11q), trả xong → C11b.
export default function PaymentListPage() {
  const { data } = useApp();
  const [paying, setPaying] = useState(null);
  const [paid, setPaid] = useState(null);
  const appointments = [...data.appointments].sort((a, b) => a.date.localeCompare(b.date));
  const payable = data.ledger.filter((l) => l.payable && l.status === "UNPAID");
  const contractOfRow = (l) => data.contracts.find((c) => c.contract_id === l.contract_id);
  const subtitle = (l) => {
    const c = contractOfRow(l);
    const f = c && facilityOf(data, c.facility_id, c.facility_name);
    return [l.period?.from && l.period?.to ? `Kỳ ${dateLabel(l.period.from)}–${dateLabel(l.period.to)}` : null, l.period?.months ? `${l.period.months} tháng` : null, f?.name].filter(Boolean).join(" · ");
  };
  return (
    <main className="container page">
      <PageHeader title="Thanh toán & lịch hẹn" description="Các khoản phí, trạng thái thanh toán và lịch nhận kho của bạn." />

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
              {a.status !== "CANCELLED" && a.status !== "DONE" && (
                <LinkButton to={`support?contract=${encodeURIComponent(a.contract_id || "")}&topic=SCHEDULE`} variant="outline">Cần đổi lịch?</LinkButton>
              )}
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
              {payable.length > 0 && <th><span className="visually-hidden">Thao tác</span></th>}
            </tr>
          </thead>
          <tbody>
            {data.ledger.map((l) => (
              <tr key={l.ref}>
                <td>{l.label}</td>
                <td>{l.ref}</td>
                <td>{money(l.amount)}</td>
                <td>{(LEDGER_STATUS[l.status] || [l.status])[0]}</td>
                {payable.length > 0 && (
                  <td className="cell-action">
                    {l.payable && l.status === "UNPAID" && <Button className="btn--sm" onClick={() => setPaying(l)}>Thanh toán</Button>}
                  </td>
                )}
              </tr>
            ))}
            {data.ledger.length === 0 && (
              <tr>
                <td colSpan={4} className="table__empty">Chưa có khoản thu nào. Khoản thu xuất hiện sau khi bạn thanh toán đặt chỗ.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paid ? (
        <Notice tone="success">
          Đã nhận thanh toán gia hạn qua mã QR.{paid.period?.to ? ` Hợp đồng ${paid.unit_number || contractOfRow(paid)?.unit_number || ""} được gia hạn đến ${dateLabel(paid.period.to)}.` : ""}
        </Notice>
      ) : (
        payable.length > 0 && (
          <p className="hint">Gia hạn đã được cơ sở duyệt. Thanh toán qua mã QR để giữ kho sang kỳ mới; tiền cọc đang giữ chuyển sang kỳ mới, không thu thêm.</p>
        )
      )}
      {paying && (
        <PayosModal
          target={{ kind: "payment", item: paying }}
          title={`Thanh toán gia hạn · Kho ${paying.unit_number || contractOfRow(paying)?.unit_number || ""}`}
          subtitle={subtitle(paying)}
          onPaid={() => {
            setPaid(paying);
            setPaying(null);
          }}
          onClose={() => setPaying(null)}
        />
      )}
    </main>
  );
}
