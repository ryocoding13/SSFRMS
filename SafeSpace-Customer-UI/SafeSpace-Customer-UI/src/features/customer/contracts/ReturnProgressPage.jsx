import React from "react";
import RefundSummary from "../../../shared/components/RefundSummary.jsx";
import { LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { pendingReturn } from "../../../app/state/appSelectors.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";

export function ReturnProgressPage({ id }) {
  const { data, user } = useApp(), load = useWorkflowData("customerRefunds"), c = data.contracts.find(x => x.contract_id === id);
  if (!c) return <NotFound />;
  const ret = pendingReturn(data, id), refund = load.data?.find(r => r.contractId === id && String(r.ownerId) === String(user?.user_id));
  return <main className="container page workflow-page"><PageHeader title={`Tiến độ trả kho · ${c.unit_number}`} description={id} /><WorkflowState load={load}>
    <section className="panel form-card"><h2>{ret ? "Đã gửi lịch trả kho" : "Chưa có yêu cầu trả kho"}</h2>{ret && <><InfoTiles items={[...(ret.date ? [["Ngày mong muốn trả kho", dateLabel(ret.date)]] : [["Yêu cầu trả kho", "Đã ghi nhận · chờ cơ sở kiểm tra"]]), ["Trạng thái yêu cầu", ret.status], ["QR mở cửa", "Hết hiệu lực sau khi gửi trả kho"]]} /><Notice>Liên hệ nhân viên nếu cần hỗ trợ ra vào sau khi gửi yêu cầu. Yêu cầu trả kho chưa được coi là đã kiểm tra xong — nhân viên sẽ kiểm tra thực tế và chụp ảnh hiện trạng trước khi đối soát hoàn cọc.</Notice></>}</section>
    <section className="panel form-card"><h2>Biên bản & hoàn cọc</h2>{refund ? <><RefundSummary refund={refund} />{refund.transactionRef && <p>Mã giao dịch: {refund.transactionRef}</p>}</> : <p className="muted">Chưa có kết quả kiểm tra / đối soát cọc từ cơ sở.</p>}</section>
  </WorkflowState><div className="stack"><LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton><LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Liên hệ cơ sở</LinkButton></div></main>;
}
