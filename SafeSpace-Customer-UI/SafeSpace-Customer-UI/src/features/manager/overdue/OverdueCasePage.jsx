/**
 * OVERDUE CASE PAGE - QUẢN LÝ HỒ SƠ HỢP ĐỒNG QUÁ HẠN THANH TOÁN (M04 / D32)
 *
 * Quy trình xử lý quá hạn:
 * - Nhắc nợ lần 1, lần 2, lần 3 kèm nhật ký cuộc gọi và thông báo hệ thống.
 * - Tạm khóa mã truy cập QR/PIN vào kho.
 * - Sau thời hạn quy định, chuyển sang quy trình niêm phong và xử lý tài sản bỏ lại (S06).
 */
import React, { useState } from "react";
import { Button, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { depositSchedule, policyRate } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

/**
 * Màn hình xử lý các ca vi phạm hợp đồng và nợ phí quá hạn.
 */
export function OverdueCasePage({ query = new URLSearchParams() } = {}) {
  const load = useWorkflowData("overdue"), policy = useWorkflowData("policy"), defaultRate = policyRate(policy.data), [selected, setSelected] = useState("");
  const [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page">
    <PageHeader title="Hồ sơ quá hạn & xử lý đồ" description="Theo dõi khấu trừ cọc và biên bản xử lý đồ thực tế." />
    <WorkflowState load={load}>
      {/* #7: mở từ nút "Xử lý quá hạn" trên hợp đồng → chỉ hiện hồ sơ của hợp đồng đó */}
      {query.get("contract") && <p className="hint">Đang xem hồ sơ của {query.get("contract")} · <a href="#/manager/overdue">Xem tất cả hồ sơ quá hạn</a></p>}
      {(load.data || []).filter(item => !query.get("contract") || item.contractId === query.get("contract")).map(item => {
        const rate = item.overdueRate ?? defaultRate;
        const d = depositSchedule(item.deposit, item.endDate, undefined, rate);
        const overdueDays = item.overdueDays ?? d.days;
        const overdueFee = item.overdueFee ?? d.deducted;
        const remainingDeposit = item.remainingDeposit ?? d.balance;
        const depletionDay = item.depletionDay ?? d.depletionDay;
        const disposalDay = item.removalDay || d.disposalDay;
        const canAssign = overdueDays >= disposalDay;

        return <RecordCard
          key={item.id}
          title={`${item.customer} · Kho ${item.unit}`}
          subtitle={`${item.contractId} · Hết hạn ${dateLabel(item.endDate)}`}
          status={item.status === "DONE" ? "Đã lập biên bản" : `Quá hạn ${overdueDays} ngày`}
          actions={<Button onClick={() => setSelected(selected === item.id ? "" : item.id)}>Xem chi tiết</Button>}
        >
          <InfoTiles items={[
            ["Cọc ban đầu", money(item.deposit)],
            ["Đã khấu trừ", money(overdueFee)],
            ["Cọc còn lại", money(remainingDeposit)]
          ]} />
          {selected === item.id && <>
            <Notice>
              QR hết hiệu lực khi hết hạn thuê. Khấu trừ {rate}% cọc ban đầu/ngày (tối đa 100% cọc, cạn cọc ngày thứ {depletionDay}). Mốc xử lý tài sản quá hạn là ngày thứ {disposalDay} theo D32/D45.
            </Notice>
            {item.record ? (
              <InfoTiles items={[
                ["Người thực hiện", item.record.staff],
                ["Danh sách / tình trạng đồ", item.record.inventory],
                ["Vị trí đưa đồ ra ngoài", item.record.location]
              ]} />
            ) : canAssign ? (
              <p>Đã đến mốc xử lý đồ. Nhân viên của cơ sở thấy việc này ở "Công việc xử lý đồ quá hạn" và lập biên bản; không cần phân công (D66).</p>
            ) : (
              <p>Chưa đến mốc xử lý đồ (ngày thứ {disposalDay} quá hạn). Cọc cạn vào ngày thứ {depletionDay}.</p>
            )}
          </>}
        </RecordCard>;
      })}
      {!load.data?.length && !load.error && <WorkflowEmpty />}
      <LinkButton to="manager/contracts" variant="outline">Về hợp đồng</LinkButton>
    </WorkflowState>
    {dialog}
  </main>;
}
