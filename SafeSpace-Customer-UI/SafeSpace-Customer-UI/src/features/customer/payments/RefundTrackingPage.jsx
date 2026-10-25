import React, { useState } from "react";
import { Button, LinkButton, Modal, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { money } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function RefundTrackingPage() {
  const { user } = useApp(), load = useWorkflowData("depositRefunds"), [detail, setDetail] = useState(null);
  const rows = (load.data || []).filter(r => String(r.ownerId) === String(user?.user_id));
  return <main className="container page workflow-page"><PageHeader title="Theo dõi hoàn cọc" description="Xem kết quả đối soát, số tiền được hoàn và trạng thái chuyển tiền." /><WorkflowState load={load}>{rows.map(r => <RecordCard key={r.id} title={`Kho ${r.unit} · ${r.contractId}`} subtitle={r.id} status={r.amount <= 0 ? "Không còn cọc hoàn" : r.status === "PAID" ? "Đã hoàn cọc" : "Chờ hoàn cọc"} actions={<Button variant="outline" onClick={() => setDetail(r)}>Xem kết quả đối soát</Button>}><strong className="price tone-green">{money(r.amount)}</strong></RecordCard>)}{!rows.length && !load.error && <WorkflowEmpty text="Chưa có khoản hoàn cọc thuộc tài khoản của bạn." />}</WorkflowState><LinkButton to="payments" variant="outline">Về thanh toán</LinkButton>
    {detail && <Modal title={`Đối soát ${detail.id}`} size="md" onClose={() => setDetail(null)}><InfoTiles items={[["Cọc ban đầu", money(detail.deposit)], ["Khoản chưa thanh toán", money(detail.unpaid)], ["Phí vệ sinh", money(detail.cleaning)], ["Phí hư hỏng", money(detail.damage)], ["Tiền hoàn", money(detail.amount)]]} /><p>{detail.status === "PAID" ? `Cơ sở đã xác nhận chuyển tiền${detail.transactionRef ? ` · ${detail.transactionRef}` : ""}.` : detail.amount <= 0 ? "Không còn cọc để chuyển hoàn sau đối soát." : "Đang chờ cơ sở xác nhận chuyển tiền. Liên hệ hỗ trợ nếu cần đối chiếu."}</p><div className="stack"><LinkButton to="support" variant="outline">Liên hệ hỗ trợ</LinkButton><Button onClick={() => setDetail(null)}>Đóng</Button></div></Modal>}
  </main>;
}
