import React, { useState } from "react";
import PayosModal from "../../../shared/components/PayosModal.jsx";
import { Button, Empty, LinkButton, Modal, Notice, PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { APPOINTMENT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

// C11fc · Chọn trả phí phát sinh tại quầy → C11fcp. Không làm giảm công nợ cho tới khi nhân viên xác nhận đã thu (S09f).
function CounterDialog({ rows, contract, facilityName, onClose }) {
  const { dispatch } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const total = rows.reduce((sum, l) => sum + l.amount, 0);
  const contractLabel = contract?.contract_id ? contract.contract_id.replace(/^HĐ-\d{4}-/, "HĐ-") : rows[0]?.contract_id;
  const choose = async () => {
    setBusy(true);
    const res = await dispatch("CHOOSE_FEE_AT_COUNTER", { refs: rows.map((l) => l.ref) });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
  };
  if (done)
    return (
      <Modal title="Đã chọn thanh toán tại quầy" size="confirm" onClose={onClose}>
        <span className="modal__state modal__state--success" aria-hidden="true" />
        <p className="modal__text">{contractLabel} còn phải thu {money(total)}. Nhân viên sẽ cập nhật khi nhận đủ tiền; chọn phương thức chưa làm giảm công nợ.</p>
        <Button block onClick={onClose}>Về khoản phải thanh toán</Button>
      </Modal>
    );
  return (
    <Modal title="Thanh toán tại quầy?" size="confirm" onClose={onClose}>
      <p className="modal__text">Đến quầy cơ sở để thanh toán. Khoản nợ vẫn chờ thu cho đến khi nhân viên xác nhận đã thực nhận tiền.</p>
      <dl className="confirm-summary">
        <div><dt>Hợp đồng / khách hàng</dt><dd>{[contractLabel, contract?.customer].filter(Boolean).join(" · ")}</dd></div>
        <div><dt>Tổng cần thanh toán</dt><dd>{money(total)}</dd></div>
        <div><dt>Cơ sở nhận tiền</dt><dd>{facilityName || "—"}</dd></div>
      </dl>
      {error && <Notice tone="error">{error}</Notice>}
      <p className="hint">Kiểm tra thông tin trước khi xác nhận.</p>
      <div className="modal__actions">
        <Button variant="outline" onClick={onClose}>Quay lại</Button>
        <Button disabled={busy} onClick={choose}>{busy ? "Đang lưu…" : "Chọn tại quầy"}</Button>
      </div>
    </Modal>
  );
}

// C11 — Thanh toán & lịch hẹn. Khoản gia hạn đã duyệt có nút "Thanh toán" mở QR PayOS (C11q), trả xong → C11b.
// C11f / C11fb / C11fq: phí phát sinh trả kho trả qua PayOS hoặc tại quầy (C11fc → C11fcp).
export default function PaymentListPage() {
  const { data } = useApp();
  const [paying, setPaying] = useState(null);
  const [paid, setPaid] = useState(null);
  const [counter, setCounter] = useState(false);
  const fees = data.ledger.filter((l) => l.fee && ["UNPAID", "AT_COUNTER"].includes(l.status));
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
                <td className={l.fee && l.status === "UNPAID" ? "tone-amber" : undefined}>{(LEDGER_STATUS[l.status] || [l.status])[0]}</td>
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
      {paid?.fee ? (
        <p className="hint tone-green">Đã thanh toán {paid.label.toLowerCase()} {money(paid.amount)}. Khoản phí đã được ghi nhận; không làm thay đổi ngày kết thúc hợp đồng.</p>
      ) : paid ? (
        <Notice tone="success">
          Đã nhận thanh toán gia hạn qua mã QR.{paid.period?.to ? ` Hợp đồng ${paid.unit_number || contractOfRow(paid)?.unit_number || ""} được gia hạn đến ${dateLabel(paid.period.to)}.` : ""}
        </Notice>
      ) : fees.length > 0 ? (
        <>
          <p className="hint">{[...new Set(fees.map((l) => l.detail).filter(Boolean))].join(" ")} Thanh toán qua PayOS hoặc tại quầy; khoản còn nợ vẫn được theo dõi sau khi trả kho.</p>
          {fees.some((l) => l.status === "UNPAID") && <Button variant="outline" className="btn--fit" onClick={() => setCounter(true)}>Thanh toán phí tại quầy</Button>}
        </>
      ) : (
        payable.length > 0 && (
          <p className="hint">Gia hạn đã được cơ sở duyệt. Thanh toán qua mã QR để giữ kho sang kỳ mới; tiền cọc đang giữ chuyển sang kỳ mới, không thu thêm.</p>
        )
      )}
      {paying && (
        <PayosModal
          target={{ kind: "payment", item: paying }}
          title={`${paying.fee ? "Thanh toán phí phát sinh" : "Thanh toán gia hạn"} · Kho ${paying.unit_number || contractOfRow(paying)?.unit_number || paying.label.split(" ").pop()}`}
          subtitle={paying.fee ? paying.detail || subtitle(paying) : subtitle(paying)}
          note={paying.fee ? "Hệ thống tự xác nhận khi nhận được tiền, bạn không cần bấm gì thêm. Đóng cửa sổ này thì khoản phí vẫn chờ thanh toán." : undefined}
          onPaid={() => {
            setPaid(paying);
            setPaying(null);
          }}
          onClose={() => setPaying(null)}
        />
      )}
      {counter && (
        <CounterDialog
          rows={fees.filter((l) => l.status === "UNPAID")}
          contract={contractOfRow(fees[0]) ? { ...contractOfRow(fees[0]), customer: data.user?.full_name } : { contract_id: fees[0]?.contract_id, customer: data.user?.full_name }}
          facilityName={(() => { const c = contractOfRow(fees[0]); return c ? facilityOf(data, c.facility_id, c.facility_name)?.name : null; })()}
          onClose={() => setCounter(false)}
        />
      )}
    </main>
  );
}
