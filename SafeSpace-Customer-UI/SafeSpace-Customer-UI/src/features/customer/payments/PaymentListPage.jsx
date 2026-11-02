import { canPayLedger, isReturnFee } from "../../../shared/utils/returnPolicy.js";
import React, { useState } from "react";
import PayosModal from "../../../shared/components/PayosModal.jsx";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { APPOINTMENT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

import RecordSummaryCard from "../../../shared/components/RecordSummaryCard.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import "../../../shared/styles/customer-detail.css";

// C11 — Thanh toán & lịch hẹn. Khoản gia hạn đã duyệt có nút "Thanh toán" mở QR PayOS (C11q), trả xong → C11b.
export default function PaymentListPage() {
  const { data } = useApp();
  const [paying, setPaying] = useState(null);
  const [paid, setPaid] = useState(null);
  const [detail, setDetail] = useState(null);
  const ledger = data.ledger.filter(l => !isReturnFee(l) || !["UNPAID", "AT_COUNTER"].includes(l.status));
  const appointments = [...data.appointments].sort((a, b) => a.date.localeCompare(b.date));
  const canPay = canPayLedger;
  const payable = ledger.filter(canPay);
  const contractOfRow = (l) => data.contracts.find((c) => c.contract_id === l.contract_id);
  const subtitle = (l) => {
    const c = contractOfRow(l);
    const f = c && facilityOf(data, c.facility_id, c.facility_name);
    return [l.period?.from && l.period?.to ? `Kỳ ${dateLabel(l.period.from)}–${dateLabel(l.period.to)}` : null, l.period?.months ? `${l.period.months} tháng` : null, f?.name].filter(Boolean).join(" · ");
  };
  return (
    <main className="container page customer-records customer-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Thanh toán & lịch hẹn</p>
      <PageHeader title="Thanh toán & lịch hẹn" description="Lịch hẹn tại cơ sở và các khoản thu theo từng hợp đồng."><Tag tone={payable.length ? "amber" : "green"}>{payable.length} khoản chờ thanh toán</Tag></PageHeader>
      <div className="customer-detail__grid">
        <div className="customer-detail__column">
          <section className="panel customer-detail__card">
            <h2>Lịch hẹn</h2>
            {!appointments.length && <Empty title="Chưa có lịch hẹn" text="Lịch nhận hoặc trả kho sẽ xuất hiện tại đây sau khi cơ sở xác nhận." />}
            {appointments.map(a => <RecordSummaryCard key={a.appointment_id}
              title={`${dateLabel(a.date)} · ${a.slot} · ${a.kind === "CHECK_IN" ? "Nhận chìa khóa" : "Kiểm tra trả kho"} ${a.unit_number || ""}`}
              status={<StatusTag map={APPOINTMENT_STATUS} status={a.status} />}
              actions={a.status !== "CANCELLED" && a.status !== "DONE" && <LinkButton to={`support?contract=${encodeURIComponent(a.contract_id || "")}&topic=SCHEDULE`} variant="outline">Đổi lịch</LinkButton>}>
              <p>{facilityOf(data, a.facility_id).name}{a.note ? ` · ${a.note}` : ""}</p>
            </RecordSummaryCard>)}
          </section>
          <section className="panel customer-detail__card">
            <h2>Khoản thu</h2>
            {!ledger.length && <Empty title="Chưa có khoản thu nào" text="Khoản thu xuất hiện sau khi bạn thanh toán đặt chỗ." />}
            {ledger.map(l => <RecordSummaryCard key={l.ref} title={l.label || l.ref}
              status={<StatusTag map={LEDGER_STATUS} status={l.status} />}
              actions={canPay(l) ? <>
                {l.contract_id && <LinkButton to={`units/${encodeURIComponent(l.contract_id)}/renewal-status`} variant="outline">Tại quầy</LinkButton>}
                <Button onClick={() => setPaying(l)}>Thanh toán QR</Button>
              </> : <Button variant="outline" onClick={() => setDetail(l)}>Chi tiết</Button>}>
              <p>{l.ref} · {money(l.amount)}</p>
              {l.kind === "RENEWAL" && <p><a href={`#/payments/check/${encodeURIComponent(l.ref)}`}>Kiểm tra trạng thái thanh toán</a></p>}
              {subtitle(l) && <p>{subtitle(l)}</p>}
            </RecordSummaryCard>)}
            <p className="hint">Phí khi trả kho chỉ khấu trừ tối đa bằng tiền cọc, không phát sinh khoản phải thanh toán thêm.</p>
          </section>
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar">
          <h2>Tóm tắt</h2>
          <DetailList items={[
            ["Cần thanh toán", money(payable.reduce((sum, l) => sum + Number(l.amount || 0), 0))],
            ["Cọc đang giữ", money(ledger.filter(l => l.status === "DEPOSIT_HELD").reduce((sum, l) => sum + Number(l.amount || 0), 0))],
            ["Khoản chờ hoàn", ledger.filter(l => l.status === "REFUND_PENDING").length],
          ]} />
          <div className="customer-detail__actions"><LinkButton to="payments/history" variant="outline">Lịch sử thanh toán</LinkButton><LinkButton to="refunds" variant="outline">Theo dõi hoàn cọc</LinkButton></div>
          <p className="hint">Gia hạn chỉ kéo dài kỳ thuê sau khi đã thanh toán đủ. Tiền cọc đang giữ chuyển sang kỳ mới, không thu thêm.</p>
          <LinkButton to="policies" variant="outline">Chính sách cho thuê</LinkButton>
        </aside>
      </div>
      {paid && <Notice tone="success">Đã nhận thanh toán gia hạn qua mã QR. Kỳ thuê được cập nhật theo kết quả máy chủ.</Notice>}
      {detail && <ConfirmDialog title="Chi tiết giao dịch" tone="info" hint={null} cancelLabel={null} label="Đóng chi tiết" rows={[["Mã khoản thu", detail.ref], ["Hợp đồng", detail.contract_id], ["Số tiền", money(detail.amount)], ["Trạng thái", LEDGER_STATUS[detail.status]?.[0] || detail.status], ["Mã giao dịch", detail.transaction_ref || "Chưa có dữ liệu"]]} onCancel={() => setDetail(null)} onConfirm={() => setDetail(null)} />}
      {paying && (
        <PayosModal
          target={{ kind: "payment", item: paying }}
          title={`Thanh toán gia hạn · Kho ${paying.unit_number || contractOfRow(paying)?.unit_number || paying.label.split(" ").pop()}`}
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
