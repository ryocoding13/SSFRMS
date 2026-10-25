import React from "react";
import { LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";

export function ReturnProgressPage({ id }) {
  const { data, user } = useApp(), load = useWorkflowData("depositRefunds"), c = data.contracts.find(x => x.contract_id === id);
  if (!c) return <NotFound />;
  const ret = data.returns.find(x => x.contract_id === id), refund = load.data?.find(r => r.contractId === id && String(r.ownerId) === String(user?.user_id));
  return <main className="container page workflow-page"><PageHeader title={`Tiến độ trả kho · ${c.unit_number}`} description={id} /><WorkflowState load={load}>
    <section className="panel form-card"><h2>{ret ? "Đã gửi lịch trả kho" : "Chưa có yêu cầu trả kho"}</h2>{ret && <><InfoTiles items={[["Lịch mong muốn", `${dateLabel(ret.date)} · ${ret.slot}`], ["Trạng thái yêu cầu", ret.status], ["QR mở cửa", "Hết hiệu lực sau khi gửi trả kho"]]} /><Notice>Liên hệ nhân viên nếu cần hỗ trợ ra vào sau khi gửi yêu cầu. Gửi yêu cầu chưa đồng nghĩa đã kiểm tra hoặc đã hoàn tiền.</Notice></>}</section>
    <section className="panel form-card"><h2>Biên bản & hoàn cọc</h2>{refund ? <><InfoTiles items={[["Cọc ban đầu", money(refund.deposit)], ["Khoản chưa thanh toán", money(refund.unpaid)], ["Phí vệ sinh / hư hỏng", money(refund.cleaning + refund.damage)], ["Tiền hoàn", money(refund.amount)], ["Trạng thái", refund.status === "PAID" ? "Đã hoàn cọc" : refund.amount > 0 ? "Chờ hoàn cọc" : "Không còn cọc để hoàn"]]} />{refund.transactionRef && <p>Mã giao dịch: {refund.transactionRef}</p>}</> : <p className="muted">Chưa có kết quả kiểm tra / đối soát cọc từ cơ sở.</p>}</section>
  </WorkflowState><div className="stack"><LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton><LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Liên hệ cơ sở</LinkButton></div></main>;
}
