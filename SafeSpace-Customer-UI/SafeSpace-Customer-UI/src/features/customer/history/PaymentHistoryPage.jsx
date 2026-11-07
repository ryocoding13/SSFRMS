import React, { useState } from "react";
import { Button, Empty, Field, LinkButton, Notice, PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RecordSummaryCard from "../../../shared/components/RecordSummaryCard.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { LEDGER_STATUS } from "../../../shared/utils/status.js";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import { historyMonths, historyRows, KIND_LABELS, methodLabel, monthLabel } from "./paymentHistoryModel.js";
import "../../../shared/styles/customer-detail.css";

// 3.6 · Figma C11h + LS02: giao dịch đã ghi nhận kèm thời gian, phương thức và mã giao dịch (dữ liệu payments của chi tiết hợp đồng).
const STATUS_MAP = { ...LEDGER_STATUS, DEDUCTED: ["Trừ cọc", "gray"] };
const statusOf = (r) => (r.deducted ? "DEDUCTED" : r.status);
const when = (r) => (r.paid_at ? dateTimeLabel(r.paid_at) : "Chưa có thời gian");

export function PaymentHistoryPage() {
  const { data, loadError, retry } = useApp();
  const [contract, setContract] = useState(""), [kind, setKind] = useState(""), [month, setMonth] = useState(""), [detail, setDetail] = useState(null);
  const all = historyRows(data.ledger);
  const kinds = [...new Set(all.map((r) => r.kind).filter(Boolean))];
  const months = historyMonths(data.ledger);
  const rows = historyRows(data.ledger, { contract, kind, month });
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Thanh toán & lịch hẹn / Lịch sử</p>
    <PageHeader title="Lịch sử thanh toán" description="Tra cứu giao dịch đã ghi nhận theo từng hợp đồng." />
    <section className="panel customer-detail__card"><h2>Bộ lọc</h2><div className="customer-history__filters customer-history__filters--3">
      <Field label="Hợp đồng"><select value={contract} onChange={(e) => setContract(e.target.value)}><option value="">Tất cả hợp đồng</option>{data.contracts.map((c) => <option key={c.contract_id} value={c.contract_id}>{c.contract_id} · Kho {c.unit_number}</option>)}</select></Field>
      <Field label="Thời gian"><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Tất cả thời gian</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></Field>
      <Field label="Loại khoản"><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Tất cả loại khoản</option>{kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k] || k}</option>)}</select></Field>
    </div></section>
    {loadError && <Notice tone="error">{loadError} <Button onClick={retry}>Thử lại</Button></Notice>}
    <section className="panel customer-detail__card"><h2>Giao dịch đã ghi nhận</h2>
      {rows.map((r) => <RecordSummaryCard key={r.api_id ?? r.ref} title={`${when(r)} · ${r.label || KIND_LABELS[r.kind] || r.ref}`}
        status={<StatusTag map={STATUS_MAP} status={statusOf(r)} />}
        actions={<Button variant="outline" onClick={() => setDetail(r)}>Chi tiết</Button>}>
        <p>{money(r.amount)} · {methodLabel(r)}{r.transaction_ref ? ` · mã ${r.transaction_ref}` : ""}{r.contract_id ? ` · ${r.contract_id}` : ""}</p>
      </RecordSummaryCard>)}
      {!rows.length && <Empty title="Chưa có giao dịch" text="Chưa có giao dịch đã ghi nhận phù hợp với bộ lọc." />}
    </section>
    <p className="hint">Khoản chờ thanh toán hoặc chờ hoàn vẫn hiển thị ở Thanh toán & lịch hẹn.</p>
    <LinkButton to="payments" variant="outline">Về thanh toán</LinkButton>
    {detail && <ConfirmDialog title="Chi tiết thanh toán" tone="info" hint={null} cancelLabel={null} label="Đóng chi tiết"
      text={`${detail.label || KIND_LABELS[detail.kind] || "Giao dịch"}${detail.contract_id ? ` · ${detail.contract_id}` : ""}`}
      rows={[["Mã khoản thu", detail.code || detail.ref], ["Mã giao dịch", detail.transaction_ref || "Không có (ghi nhận nội bộ)"], ["Số tiền", money(detail.amount)],
        ["Phương thức", methodLabel(detail)], ["Thời gian", detail.paid_at ? dateTimeLabel(detail.paid_at) : "Chưa có dữ liệu"], ["Trạng thái", STATUS_MAP[statusOf(detail)]?.[0] || detail.status]]}
      onCancel={() => setDetail(null)} onConfirm={() => setDetail(null)} />}
  </main>;
}
