import React from "react";
import { LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { POLICY_SECTIONS, defaultRentalPolicy } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function RentalPolicyPage() {
  const load = useWorkflowData("policy"), policy = load.data || defaultRentalPolicy();
  return <main className="container page workflow-page"><PageHeader title="Chính sách cho thuê SafeSpace" description="Đọc các quy định về thời hạn sử dụng, gia hạn, trả kho, tiền cọc và hoàn tiền." />
    {load.error && <Notice>Đang hiển thị bản chính sách được duyệt trên giao diện. Máy chủ chưa cung cấp phiên bản áp dụng; kiểm tra điều kiện trên đơn trước khi giao dịch.</Notice>}
    <section className="panel form-card"><h2>Các mốc bạn cần nhớ</h2><InfoTiles items={[["QR hết hiệu lực", "Hết hạn thuê / Gửi trả kho thành công"], ["Khấu trừ mỗi ngày", `${policy.rate}% cọc ban đầu`], ["Giới hạn", `100% · ${Math.ceil(100 / policy.rate)} ngày`]]} /></section>
    {POLICY_SECTIONS.map(([id, title], i) => <section className="panel form-card" key={id}><h2>{String(i + 1).padStart(2, "0")} · {title}</h2><p>{policy.sections[id]}</p></section>)}
    <LinkButton to="units" variant="outline">Về Kho của tôi</LinkButton>
  </main>;
}
