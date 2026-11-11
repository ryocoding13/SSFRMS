/**
 * OVERDUE CASE PAGE - QUẢN LÝ HỒ SƠ HỢP ĐỒNG QUÁ HẠN THANH TOÁN (M04 / D32)
 *
 * Quy trình xử lý quá hạn:
 * - Nhắc nợ lần 1, lần 2, lần 3 kèm nhật ký cuộc gọi và thông báo hệ thống.
 * - Tạm khóa mã truy cập QR/PIN vào kho.
 * - Sau thời hạn quy định, chuyển sang quy trình niêm phong và xử lý tài sản bỏ lại (S06).
 */
import React, { useState } from "react";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { depositSchedule, policyRate } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

/**
 * Màn hình xử lý các ca vi phạm hợp đồng và nợ phí quá hạn.
 */
export function OverdueCasePage() {
  const load = useWorkflowData("overdue"), policy = useWorkflowData("policy"), defaultRate = policyRate(policy.data), [selected, setSelected] = useState(""), [assignee, setAssignee] = useState(""), [error, setError] = useState("");
  const [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page">
    <PageHeader title="Hồ sơ quá hạn & xử lý đồ" description="Theo dõi khấu trừ cọc, phân công nhân viên và biên bản thực tế." />
    <WorkflowState load={load}>
      {(load.data || []).map(item => {
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
          actions={<Button onClick={() => { setSelected(selected === item.id ? "" : item.id); setAssignee(item.assignee || ""); }}>Xem chi tiết</Button>}
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
              <form onSubmit={e => {
                e.preventDefault();
                if (!assignee.trim()) return setError("Nhập nhân viên phụ trách.");
                ask("ASSIGN_REMOVAL", { id: item.id, assignee }, "Phân công xử lý đồ quá hạn?", "Nhân viên cần lập biên bản và ghi vị trí thực tế sau khi thực hiện.");
              }}>
                <Field label="Nhân viên phụ trách" error={error}>
                  <input value={assignee} onChange={e => { setAssignee(e.target.value); setError(""); }} />
                </Field>
                <Button type="submit" disabled={load.busy}>Xác nhận phân công</Button>
              </form>
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
