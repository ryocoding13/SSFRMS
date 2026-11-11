/**
 * DEPOSIT LEDGER PAGE - SỔ THEO DÕI BIẾN ĐỘNG TIỀN CỌC (UC05 / D09)
 *
 * Minh bạch tài chính:
 * - Ghi nhận số tiền cọc ban đầu (1 tháng tiền thuê - D09).
 * - Các khoản cọc chênh nộp thêm khi nâng cấp kho hoặc gia hạn sang ô lớn hơn (D46).
 * - Lịch sử hoàn trả hoặc khấu trừ cọc khi kết thúc hợp đồng.
 */
import React from "react";
import { LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { depositSchedule, policyRate } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";

/**
 * Màn hình tra cứu sổ cái lịch sử tiền đặt cọc của hợp đồng thuê.
 * @param {{ contract: Object }} props
 */
export function DepositLedgerPage({ id }) {
  const { data } = useApp(), c = data.contracts.find(x => x.contract_id === id), policy = useWorkflowData("policy");
  if (!c) return <NotFound />;
  const rate = c.overdue?.rate_per_day ?? policyRate(policy.data);
  // Hợp đồng đã trả kho / kết thúc: không tính tiếp khấu trừ quá hạn, số chính thức xem ở tiến độ trả kho
  const ended = c.status === "ENDED" || c.overdue?.is_settled;
  const ledger = depositSchedule(c.deposit, c.end_date, ended ? String(c.end_date).slice(0, 10) : today(), rate);
  const overdueDays = c.overdue?.overdue_days ?? ledger.days;
  const overdueFee = c.overdue?.overdue_fee ?? ledger.deducted;
  const remainingDeposit = c.overdue?.remaining_deposit ?? ledger.balance;
  const depletionDay = c.overdue?.depletion_day ?? ledger.depletionDay;
  const disposalDay = c.overdue?.disposal_day ?? ledger.disposalDay;

  return <main className="container page workflow-page">
    <PageHeader title={`Lịch khấu trừ cọc · Kho ${c.unit_number}`} description={`${id} · Cọc ban đầu ${money(c.deposit)}`} />
    <Notice>
      {ended
        ? "Hợp đồng đã kết thúc. Khoản khấu trừ và tiền hoàn chính thức xem tại Tiến độ trả kho / hoàn cọc."
        : `Bảng xem trước theo chính sách cho thuê: mỗi ngày trễ hạn trừ ${rate}% cọc ban đầu, cạn cọc vào ngày thứ ${depletionDay} (tối đa 100% cọc). Mốc xử lý tài sản quá hạn theo quy định là ngày thứ ${disposalDay}. Số tiền chính thức do cơ sở đối soát khi trả kho.`}
    </Notice>
    <section className="panel form-card">
      <InfoTiles items={[
        ["Số ngày quá hạn", overdueDays],
        ["Khấu trừ theo chính sách", money(overdueFee)],
        ["Cọc còn lại theo chính sách", money(remainingDeposit)]
      ]} />
    </section>
    {!ended && overdueDays >= depletionDay && (
      <Notice tone="error">
        Cọc đã khấu trừ hết (tối đa 100% cọc). Mốc xử lý tài sản quá hạn theo quy định là ngày thứ {disposalDay}. Sau ngày {disposalDay} nhân viên đưa đồ ra ngoài, khách hàng tự chịu trách nhiệm. Liên hệ cơ sở để biết tình trạng thực tế.
      </Notice>
    )}
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Khấu trừ trong ngày</th>
            <th>Cọc còn lại</th>
          </tr>
        </thead>
        <tbody>
          {ledger.rows.map(r => (
            <tr key={r.day}>
              <td>{dateLabel(r.date)}</td>
              <td>{money(r.amount)}</td>
              <td>{money(r.balance)}</td>
            </tr>
          ))}
          {!ledger.rows.length && <tr><td colSpan={3}>Chưa phát sinh ngày quá hạn.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="stack">
      {ended && <LinkButton to={`units/${encodeURIComponent(id)}/progress`}>Xem tiến độ trả kho / hoàn cọc</LinkButton>}
      <LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton>
    </div>
  </main>;
}
