import React, { useState } from "react";
import { Button, Empty, Field, LinkButton, Notice, PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RecordSummaryCard from "../../../shared/components/RecordSummaryCard.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { LEDGER_STATUS } from "../../../shared/utils/status.js";
import { money } from "../../../shared/utils/format.js";
import "../../../shared/styles/customer-detail.css";

export function PaymentHistoryPage() {
  const { data, loadError, retry } = useApp();
  const [contract, setContract] = useState(""), [kind, setKind] = useState(""), [detail, setDetail] = useState(null);
  const recorded = data.ledger.filter(r => ["RECONCILED", "REFUNDED", "DEPOSIT_HELD", "DEDUCTED"].includes(r.status));
  const kinds = [...new Set(recorded.map(r => r.kind).filter(Boolean))];
  const labels = { RENT: "Tiền thuê", RENEWAL: "Gia hạn", DEPOSIT: "Tiền cọc", REFUND: "Hoàn tiền", CLEANING_FEE: "Vệ sinh", DAMAGE_FEE: "Hư hỏng", OVERDUE_FEE: "Quá hạn" };
  const rows = recorded.filter(r => (!contract || r.contract_id === contract) && (!kind || r.kind === kind));
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Thanh toán & lịch hẹn / Lịch sử</p>
    <PageHeader title="Lịch sử thanh toán" description="Tra cứu giao dịch đã ghi nhận theo từng hợp đồng." />
    <section className="panel customer-detail__card"><h2>Bộ lọc</h2><div className="customer-history__filters">
      <Field label="Hợp đồng"><select value={contract} onChange={e => setContract(e.target.value)}><option value="">Tất cả hợp đồng</option>{data.contracts.map(c => <option key={c.contract_id} value={c.contract_id}>{c.contract_id} · {c.unit_number}</option>)}</select></Field>
      <Field label="Loại khoản"><select value={kind} onChange={e => setKind(e.target.value)}><option value="">Tất cả loại khoản</option>{kinds.map(k => <option key={k} value={k}>{labels[k] || k}</option>)}</select></Field>
    </div></section>
    {loadError && <Notice tone="error">{loadError} <Button onClick={retry}>Thử lại</Button></Notice>}
    <section className="panel customer-detail__card"><h2>Giao dịch đã ghi nhận</h2>
      {rows.map(r => <RecordSummaryCard key={r.ref} title={r.label || r.ref}
        status={<StatusTag map={{ ...LEDGER_STATUS, DEDUCTED: ["Trừ cọc", "gray"] }} status={r.status} />}
        actions={<Button variant="outline" onClick={() => setDetail(r)}>Chi tiết</Button>}>
        <p>{money(r.amount)} · {r.ref}{r.contract_id ? ` · ${r.contract_id}` : ""}</p>
        {r.transaction_ref && <p>Mã giao dịch: {r.transaction_ref}</p>}
      </RecordSummaryCard>)}
      {!rows.length && <Empty title="Chưa có giao dịch" text="Chưa có giao dịch đã ghi nhận phù hợp với bộ lọc." />}
    </section>
    <p className="hint">Khoản chờ thanh toán hoặc chờ hoàn vẫn hiển thị ở Thanh toán & lịch hẹn. Thời gian giao dịch sẽ hiển thị khi máy chủ cung cấp.</p>
    <LinkButton to="payments" variant="outline">Về thanh toán</LinkButton>
    {detail && <ConfirmDialog title="Chi tiết giao dịch" tone="info" hint={null} cancelLabel={null} label="Đóng chi tiết" rows={[["Mã khoản thu", detail.ref], ["Hợp đồng", detail.contract_id], ["Số tiền", money(detail.amount)], ["Trạng thái", detail.status === "DEDUCTED" ? "Trừ cọc" : LEDGER_STATUS[detail.status]?.[0] || detail.status], ["Mã giao dịch", detail.transaction_ref || "Chưa có dữ liệu"]]} onCancel={() => setDetail(null)} onConfirm={() => setDetail(null)} />}
  </main>;
}
