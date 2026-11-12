/**
 * CONTRACT LIST PAGE - DANH SÁCH VÀ CHI TIẾT HỢP ĐỒNG THUÊ CƠ SỞ (UC05)
 *
 * Nghiệp vụ:
 * - Tra cứu toàn bộ hợp đồng thuộc cơ sở: Đang thuê (ACTIVE), Sắp hết hạn (EXPIRING),
 *   Quá hạn (OVERDUE), Đã trả kho chờ quyết toán (RETURNED), Đã thanh lý (TERMINATED).
 * - Xem chi tiết hợp đồng, lịch sử thanh toán, mã truy cập cửa kho và biên bản kiểm kê.
 */
import React, { useEffect, useRef, useState } from "react";
import { InspectionReview } from "../../facility-operations/settlements/SettlementComponents.jsx";
import { canFinalizeReturn, isReturnSettlementReady } from "../../facility-operations/settlements/settlementModel.js";
import { RecordCard } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button, Empty, Field, LinkButton, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, daysBetween, money, today } from "../../../shared/utils/format.js";
import { go, qs } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";
import { supportsReturnPolicy, RETURN_POLICY_PENDING } from "../../../shared/utils/returnPolicy.js";

export const CONTRACT_STATE = (c) =>
  c.state === "OVERDUE"
    ? [`Quá hạn ${Math.max(1, daysBetween(c.end, today()))} ngày`, "red"]
    : c.state === "RETURNED"
      ? ["Chờ xác nhận trả kho", "amber"]
      : ["CLOSED", "RESOLVED"].includes(c.state)
        ? ["Đã xử lý", "green"]
        : ["Chưa rõ trạng thái", "amber"];

// M07: chốt số tiền, không xác nhận đã chuyển hoàn.
function ReturnConfirmDialog({ contract, ret, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return <ConfirmDialog title={`Duyệt đối soát · ${contract.id}`} text="Chốt số tiền tạo khoản chờ hoàn, chưa xác nhận đã chuyển tiền." busy={busy} rows={[["Khách hàng / kho",`${contract.customer} · ${contract.unit}`],["Tiền cọc",ret?.deposit!=null?money(ret.deposit):"Chưa có dữ liệu"],["Số tiền chính thức","Máy chủ tính khi chốt"]]} label="Chốt đối soát" hint="Khấu trừ không vượt cọc; không thu thêm. Kho cần vệ sinh/sửa tiếp tục bảo trì." onCancel={onClose} onConfirm={async()=>{if(busy)return;setBusy(true);try{const ok=await onConfirm(note.trim());if(!ok)setBusy(false);}catch{setBusy(false);}}}><Field label="Ghi chú đối soát"><textarea maxLength={255} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></Field></ConfirmDialog>;
}

/**
 * Màn hình quản lý danh sách hợp đồng thuê kho của chi nhánh.
 */
export function ContractListPage({ query }) {
  const { ops, run, source, saving, needsRefresh } = useOps();
  const settlementReady = source === "local" || supportsReturnPolicy(ops);
  const [returning, setReturning] = useState(false);
  const visibleContracts = ops.contracts.filter((c) => c.state !== "RETURNED" || isReturnSettlementReady(ops, c));
  const sel = query.get("id") ? visibleContracts.find((c) => c.id === query.get("id")) : null;
  const [note, setNote] = useState("");
  const detailRef = useRef(null);
  // "Xem hồ sơ" mở chi tiết ngay dưới danh sách: cuộn tới để quản lý thấy trang đã chuyển
  useEffect(() => { if (sel) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [sel?.id]);
  return (
    <main className="container page">
      <PageHeaderBlock title="Hợp đồng & xử lý quá hạn" text="Theo dõi hạn thuê, đối soát trả kho và yêu cầu cần duyệt tại cơ sở." />
      <div className="workflow-links"><LinkButton to="manager/incidents" variant="outline">Sự cố cơ sở</LinkButton></div>
      <div className="customer-detail__column">{visibleContracts.map(c=>{const [label,tone]=CONTRACT_STATE(c);return <RecordCard key={c.id} title={`${c.id} · ${c.customer}`} subtitle={`Kho ${c.unit} · hết hạn ${dateLabel(c.end)}`} status={label} actions={<LinkButton to={`manager/contracts${qs({id:c.id})}`}>{c.state==="RETURNED"?"Duyệt đối soát":c.state==="OVERDUE"?"Xem hồ sơ quá hạn":"Xem hồ sơ"}</LinkButton>}><p>{c.state==="RETURNED"?"Biên bản đã gửi · khấu trừ tối đa bằng cọc":"Theo dõi hạn thuê và lịch sử liên hệ khách"}</p></RecordCard>;})}</div>
      {query.get("id")&&!sel&&<Empty title="Không tìm thấy hợp đồng" text="Chọn đúng hồ sơ thuộc cơ sở phụ trách."/>}
      {sel && (
        <section className="panel form-card contract-detail" ref={detailRef}>
          <h2>{sel.id} · Bước tiếp theo</h2>
          {sel.state === "RETURNED" ? (
            <>
              <InspectionReview ret={ops.returns.find(r=>r.contract===sel.id)}/><p className="muted">Biên bản trả kho {sel.unit} đã được gửi. Đối chiếu khấu trừ cọc và chốt khoản chờ hoàn.</p>
              {!settlementReady && <Notice>{RETURN_POLICY_PENDING}</Notice>}
              <Button disabled={!settlementReady||saving||needsRefresh||!canFinalizeReturn(ops,sel,ops.returns.find(r=>r.contract===sel.id))||(source==="api"&&ops.returns.find(r=>r.contract===sel.id)?.damage_workflow_resolved!==true)} onClick={() => setReturning(true)}>Xác nhận trả kho</Button>
            </>
          ) : sel.state === "CLOSED" || sel.state === "RESOLVED" ? (
            <Notice>Đã xử lý hợp đồng. Kiểm tra trạng thái chuyển tiền tại mục hoàn cọc.</Notice>
          ) : (
            <>
              <p className="muted">Kiểm tra thanh toán và trao đổi với khách trước khi áp dụng biện pháp xử lý. Ghi nhận liên hệ, phí phát sinh và quyết định của quản lý.</p>
              <Field label="Nội dung đã trao đổi (không bắt buộc)">
                <textarea rows={2} value={note} placeholder="Ví dụ: gọi điện nhắc, khách hẹn thanh toán trước 18:00" onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="ops-actions">
                <Button onClick={async () => { if ((await run("REMIND", { id: sel.id, note }, "Đã ghi nhận nhắc khách")).ok) setNote(""); }}>Ghi nhận đã nhắc khách</Button>
              </div>
            </>
          )}
          {returning && sel.state === "RETURNED" && (
            <ReturnConfirmDialog
              contract={sel}
              ret={ops.returns.find((x) => x.contract === sel.id)}
              onClose={() => setReturning(false)}
              onConfirm={async (note) => {
                // Giữ hộp thoại (và ghi chú) khi lưu thất bại để quản lý kiểm tra rồi thử lại
                const res = await run("CONFIRM_REFUND", { id: sel.id, note }, "Đã xác nhận trả kho");
                if (res.ok) setReturning(false);
                return res.ok;
              }}
            />
          )}
          {(sel.reminders || []).length > 0 && (
            <ul className="ops-notes">
              {sel.reminders.map((r, i) => <li key={i}><small>{dateTimeLabel(r.at)}</small>{r.text}</li>)}
            </ul>
          )}
        </section>
      )}
      {/* Figma M07: lối vào M08 hoàn tiền đơn huỷ và hoàn cọc, một thẻ cuối trang */}
      <div className="panel workflow-links workflow-links--panel"><LinkButton to="manager/refunds" variant="outline">Hoàn tiền đơn huỷ{(ops.refunds || []).some((r) => r.status === "PENDING") ? ` (${ops.refunds.filter((r) => r.status === "PENDING").length})` : ""}</LinkButton><LinkButton to="manager/deposit-refunds" variant="outline">Hoàn cọc sau trả kho</LinkButton></div>
    </main>
  );
}
