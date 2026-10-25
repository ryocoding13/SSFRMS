import React from "react";
import { LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { depositSchedule, policyRate } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";

export function DepositLedgerPage({ id }) {
  const { data } = useApp(), c = data.contracts.find(x => x.contract_id === id), policy = useWorkflowData("policy");
  if (!c) return <NotFound />;
  const rate = policyRate(policy.data);
  // Hợp đồng đã trả kho / kết thúc: không tính tiếp khấu trừ quá hạn, số chính thức xem ở tiến độ trả kho
  const ended = c.status === "ENDED";
  const ledger = depositSchedule(c.deposit, c.end_date, ended ? String(c.end_date).slice(0, 10) : today(), rate);
  return <main className="container page workflow-page"><PageHeader title={`Lịch khấu trừ cọc · Kho ${c.unit_number}`} description={`${id} · Cọc ban đầu ${money(c.deposit)}`} /><Notice>{ended ? "Hợp đồng đã kết thúc. Khoản khấu trừ và tiền hoàn chính thức xem tại Tiến độ trả kho / hoàn cọc." : `Bảng xem trước theo chính sách cho thuê: mỗi ngày trễ hạn trừ ${rate}% cọc ban đầu, tối đa 100% (${ledger.limitDays} ngày). Số tiền chính thức do cơ sở đối soát khi trả kho.`}</Notice>
    <section className="panel form-card"><InfoTiles items={[["Số ngày quá hạn", ledger.days], ["Khấu trừ theo chính sách", money(ledger.deducted)], ["Cọc còn lại theo chính sách", money(ledger.balance)]]} /></section>
    {!ended && ledger.days >= ledger.limitDays && <Notice tone="error">Cọc đã hết. Sau {ledger.limitDays} ngày nhân viên đưa đồ ra ngoài, khách hàng tự chịu trách nhiệm. Liên hệ cơ sở để biết tình trạng thực tế.</Notice>}
    <div className="panel table-wrap"><table className="table"><thead><tr><th>Ngày</th><th>Khấu trừ trong ngày</th><th>Cọc còn lại</th></tr></thead><tbody>{ledger.rows.map(r => <tr key={r.day}><td>{dateLabel(r.date)}</td><td>{money(r.amount)}</td><td>{money(r.balance)}</td></tr>)}{!ledger.rows.length && <tr><td colSpan={3}>Chưa phát sinh ngày quá hạn.</td></tr>}</tbody></table></div><div className="stack">{ended && <LinkButton to={`units/${encodeURIComponent(id)}/progress`}>Xem tiến độ trả kho / hoàn cọc</LinkButton>}<LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton></div>
  </main>;
}
