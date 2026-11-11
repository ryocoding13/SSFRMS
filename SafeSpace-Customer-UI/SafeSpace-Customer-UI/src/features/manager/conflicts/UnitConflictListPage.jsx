/**
 * UNIT CONFLICT LIST PAGE - QUẢN LÝ XUNG ĐỘT Ô KHO ĐẶT TRƯỚC (D41)
 *
 * Nghiệp vụ D41:
 * - Phát hiện khi khách cũ chưa trả kho hoặc gia hạn đè lên đơn đặt trước của khách mới.
 * - Cung cấp các phương án giải quyết: Đổi ô ngang giá (SWAP), nâng cấp ô lớn miễn phí (UPGRADE),
 *   hoặc dời ngày / hủy đơn hoàn tiền 100% không mất phí.
 */
import React from "react";
import { PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";

const OPTION = { SWAP: "Đổi ngang", UPGRADE: "Nâng cấp miễn phí", NONE: "Không còn ô phù hợp" };
const RESOLUTION = { SWAP: "Khách nhận đổi ngang", UPGRADE: "Khách nhận nâng cấp", AUTO_SWAP: "Hệ thống tự đổi ngang", AUTO_UPGRADE: "Hệ thống tự nâng cấp", RESCHEDULE: "Khách dời ngày", CANCEL: "Khách huỷ · hoàn 100%" };

// D41 · Figma M-D41: ô khách mới đặt chưa về Trống 5 ngày trước ngày nhận; khách có 48 giờ để chọn.
/**
 * Màn hình theo dõi và xử lý các ca xung đột bố trí ô kho giữa các khách hàng.
 */
export function UnitConflictListPage() {
  const load = useOpsEndpoint("/api/ops/unit-conflicts");
  const items = Array.isArray(load.data) ? load.data : [];
  return <main className="container page workflow-page">
    <PageHeader title="Xung đột lịch đặt kho" description="Khách thuê trước chưa trả kho hoặc kho chưa kiểm tra đạt trước ngày nhận của khách mới. Hệ thống đề xuất và tự xử lý sau 48 giờ." />
    <WorkflowState load={load}>
      {items.map(c => <RecordCard key={c.id} title={`${c.id} · ${c.customer}`} subtitle={`Ô ${c.oldUnit} · nhận ${c.startDate}${c.blockingContractId ? ` · đang vướng ${c.blockingContractId}` : ""}`}
        actions={<Tag tone={c.status === "OPEN" ? "amber" : "green"}>{c.status === "OPEN" ? "Chờ khách chọn" : RESOLUTION[c.resolution] || "Đã xử lý"}</Tag>}>
        <p>{OPTION[c.option] || c.option}{c.proposedUnit ? ` · ô ${c.proposedUnit}${c.proposedUnitType ? ` (${c.proposedUnitType})` : ""}` : ""}</p>
        <p className="muted">{c.reason}{c.expiresAt && c.status === "OPEN" ? ` · hết hạn chọn ${c.expiresAt}` : ""}{c.newUnit ? ` · ô mới ${c.newUnit}` : ""}{c.newStartDate ? ` · nhận từ ${c.newStartDate}` : ""}{c.phone ? ` · ${c.phone}` : ""}</p>
      </RecordCard>)}
      {!items.length && <WorkflowEmpty title="Không có xung đột" text="Các ô đặt trước đều sẵn sàng theo lịch." />}
    </WorkflowState>
  </main>;
}
