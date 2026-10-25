import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { LEDGER_STATUS } from "../../../shared/utils/status.js";
import { money } from "../../../shared/utils/format.js";
import { InfoTiles, RecordCard, WorkflowEmpty } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function PaymentHistoryPage() {
  const { data, loadError, retry } = useApp(), [contract, setContract] = useState(""), [detail, setDetail] = useState(null);
  const rows = data.ledger.filter(r => !contract || r.contract_id === contract);
  return <main className="container page workflow-page"><PageHeader title="Lịch sử thanh toán" description="Tra cứu khoản thu và trạng thái giao dịch của tài khoản." /><Field label="Hợp đồng"><select value={contract} onChange={e => setContract(e.target.value)}><option value="">Tất cả hợp đồng</option>{data.contracts.map(c => <option key={c.contract_id} value={c.contract_id}>{c.contract_id} · {c.unit_number}</option>)}</select></Field>
    {loadError && <p role="alert">{loadError} <Button onClick={retry}>Thử lại</Button></p>}{rows.map(r => <RecordCard key={r.ref} title={r.label || r.ref} subtitle={`${r.ref} · ${r.contract_id || "Đơn đặt chỗ"}`} status={LEDGER_STATUS[r.status]?.[0] || r.status} actions={<Button variant="outline" onClick={() => setDetail(r)}>Xem chi tiết</Button>}><strong className="price">{money(r.amount)}</strong></RecordCard>)}{!rows.length && <WorkflowEmpty text="Chưa có giao dịch phù hợp với bộ lọc." />}<LinkButton to="payments" variant="outline">Về thanh toán</LinkButton>
    {detail && <Modal title="Chi tiết giao dịch" size="md" onClose={() => setDetail(null)}><InfoTiles items={[["Mã khoản thu", detail.ref], ["Hợp đồng", detail.contract_id], ["Số tiền", money(detail.amount)], ["Trạng thái", <StatusTag key="status" map={LEDGER_STATUS} status={detail.status} />], ["Mã giao dịch", detail.transaction_ref || "Chưa có dữ liệu"]]} /><Button onClick={() => setDetail(null)}>Đóng chi tiết</Button></Modal>}
  </main>;
}
