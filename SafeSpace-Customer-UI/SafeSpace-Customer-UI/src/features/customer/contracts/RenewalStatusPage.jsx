import React, { useState } from "react";
import { Button, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { InfoTiles, RecordCard, WorkflowEmpty } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function RenewalStatusPage({ id }) {
  const { data, dispatch } = useApp(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const rows = data.renewals.filter(r => r.contract_id === id);
  // Mapper gộp PAID/COMPLETED của backend thành APPROVED; đã trả hay chưa xác định qua khoản thu RENEWAL cùng kỳ mới
  const paidOf = r => r.status === "PAID" || data.ledger.some(l => l.kind === "RENEWAL" && l.contract_id === id && l.period?.to === r.new_end && l.status === "RECONCILED");
  const label = r => r.status === "REJECTED" ? "Đã từ chối" : paidOf(r) ? "Đã thanh toán · Đã gia hạn" : r.status === "APPROVED" ? (r.at_counter ? "Chờ thu tại quầy" : "Đã duyệt · Chờ thanh toán") : "Chờ cơ sở duyệt";
  return <main className="container page workflow-page"><PageHeader title="Theo dõi yêu cầu gia hạn" description="Ngày hết hạn chỉ cập nhật sau khi duyệt và thanh toán đủ." />{error && <Notice tone="error">{error}</Notice>}
    {rows.map(r => <RecordCard key={r.renewal_id} title={`${r.renewal_id} · ${r.months} tháng`} subtitle={id} status={label(r)} actions={r.status === "APPROVED" && !paidOf(r) && <><LinkButton to="payments">Thanh toán PayOS</LinkButton><Button variant="outline" disabled={busy || r.at_counter} onClick={async () => { setBusy(true); const out = await dispatch("CHOOSE_RENEWAL_AT_COUNTER", { renewal_id: r.renewal_id }); setBusy(false); setError(out.ok ? "" : out.error); }}>Chọn thanh toán tại quầy</Button></>}>
      <InfoTiles items={[["Kỳ dự kiến", `${dateLabel(r.old_end)} → ${dateLabel(r.new_end)}`], ["Tiền thuê gia hạn", money(r.amount)], ["Cọc bổ sung", "Không thu lại cọc"]]} />
      {r.reason && <Notice tone="error">Lý do từ chối: {r.reason}</Notice>}{r.at_counter && !paidOf(r) && <Notice>Đang chờ nhân viên thu tiền tại quầy. Kỳ thuê hiện tại chưa thay đổi.</Notice>}
    </RecordCard>)}{!rows.length && <WorkflowEmpty text="Chưa có yêu cầu gia hạn cho hợp đồng này." />}<LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton></main>;
}
