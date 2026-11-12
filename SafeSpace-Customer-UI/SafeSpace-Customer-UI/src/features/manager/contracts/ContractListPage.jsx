/**
 * CONTRACT LIST PAGE - DANH SÁCH VÀ CHI TIẾT HỢP ĐỒNG THUÊ CƠ SỞ (UC05)
 *
 * Nghiệp vụ:
 * - Tra cứu toàn bộ hợp đồng thuộc cơ sở: Đang thuê (ACTIVE), Sắp hết hạn (EXPIRING),
 *   Quá hạn (OVERDUE), Đã trả kho chờ quyết toán (RETURNED), Đã thanh lý (TERMINATED).
 * - Xem chi tiết hợp đồng, lịch sử thanh toán, mã truy cập cửa kho và biên bản kiểm kê.
 */
import React, { useEffect, useRef, useState } from "react";
import { InspectionReview, SettlementTable } from "../../facility-operations/settlements/SettlementComponents.jsx";
import { canFinalizeReturn, isReturnSettlementReady, returnCaseState, settlementFromRefund, settlementOf } from "../../facility-operations/settlements/settlementModel.js";
import { amountLabel } from "../../facility-operations/damage/DamageComponents.jsx";
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
        ? ["Đã chốt đối soát", "green"] // #19: không chỉ ghi "Đã xử lý"
        : ["Chưa rõ trạng thái", "amber"];

// M07: chốt số tiền, không xác nhận đã chuyển hoàn.
function ReturnConfirmDialog({ contract, ret, onClose, onConfirm }) {
  // #16: hiện đúng số trên bảng đối soát (cùng RefundPolicy với bước chốt), không còn "Máy chủ tính khi chốt"
  const st = settlementOf(ret?.settlement);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return <ConfirmDialog title={`Duyệt đối soát · ${contract.id}`} text="Sau khi chốt, số dự kiến trở thành chính thức và tạo khoản chờ hoàn; chưa xác nhận đã chuyển tiền." busy={busy} rows={[["Khách hàng / kho",`${contract.customer} · ${contract.unit}`],["Tổng khấu trừ",amountLabel(st?.totalDeduction)],["Cọc còn hoàn",amountLabel(st?.depositRefund)],["Tiền thuê được hoàn",amountLabel(st?.rentRefund)],["Tổng tiền hoàn",amountLabel(st?.total)]]} label="Chốt đối soát" hint="Khấu trừ không vượt cọc; không thu thêm. Kho cần vệ sinh/sửa tiếp tục bảo trì." onCancel={onClose} onConfirm={async()=>{if(busy)return;setBusy(true);try{const ok=await onConfirm(note.trim());if(!ok)setBusy(false);}catch{setBusy(false);}}}><Field label="Ghi chú đối soát"><textarea maxLength={255} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></Field></ConfirmDialog>;
}

// #19 · Figma M-ĐS-CHỐT: sau khi chốt vẫn mở được biên bản, ảnh, kết quả tiền và đường tới khoản hoàn.
function SettledCase({ ops, contract }) {
  const ret = ops.returns.find((r) => r.contract === contract.id);
  const refund = (ops.deposit_refunds || []).find((r) => (r.contractId || r.contract_id) === contract.id);
  const [, label, tone] = returnCaseState(ops, contract, ret);
  const settlement = refund ? settlementFromRefund(refund) : settlementOf(ret?.settlement);
  return (
    <>
      <div className="customer-detail__actions"><Tag tone={tone}>{label}</Tag></div>
      <div className="customer-detail__grid">
        <div className="customer-detail__column">
          {ret ? <InspectionReview ret={ret} /> : <Notice>Biên bản cũ hơn 30 ngày không còn trên bảng việc; xem lại tại khoản hoàn.</Notice>}
          {refund && (
            <section className="panel customer-detail__card">
              <h2>Khoản hoàn {refund.id}</h2>
              <p className="muted">Mã hồ sơ nội bộ · {refund.method === "CASH" ? "Tiền mặt tại quầy" : `Chuyển khoản ${refund.bankName || ""}`} · {amountLabel(refund.amount)}</p>
              <p className="muted">{refund.status === "PAID" ? `Đã hoàn · mã giao dịch ngân hàng ${refund.transactionRef || "chưa có"}` : "Đang chờ hoàn: nhập mã giao dịch ngân hàng sau khi chuyển tiền."}</p>
              <div className="customer-detail__actions"><LinkButton to={`manager/deposit-refunds${qs({ id: refund.id })}`}>Mở khoản hoàn</LinkButton></div>
            </section>
          )}
        </div>
        <SettlementTable title="Kết quả đối soát" settlement={settlement} report={ret?.report} />
      </div>
    </>
  );
}

// #15 · Figma M-ĐS-DS: hồ sơ trả kho tách theo trạng thái; chỉ "Sẵn sàng duyệt" mới duyệt được đối soát.
const CASE_FILTERS = [["ALL", "Tất cả"], ["WAIT_STAFF", "Chờ nhân viên kiểm tra"], ["WAIT_CUSTOMER", "Chờ khách phản hồi"], ["READY", "Sẵn sàng duyệt"], ["DONE", "Đã chốt"]];
function ReturnCases({ ops }) {
  const [filter, setFilter] = useState("ALL");
  const rows = (ops.returns || []).map((ret) => {
    const contract = ops.contracts.find((c) => c.id === ret.contract);
    const [code, label, tone] = returnCaseState(ops, contract, ret);
    return { ret, contract, code, label, tone, group: ["SETTLED", "PAID"].includes(code) ? "DONE" : code };
  });
  if (!rows.length) return null;
  const count = (k) => (k === "ALL" ? rows.length : rows.filter((r) => r.group === k).length);
  const shown = rows.filter((r) => filter === "ALL" || r.group === filter);
  return (
    <section className="return-cases" aria-label="Hồ sơ trả kho">
      <h2 className="section-title">Hồ sơ trả kho</h2>
      <div className="page-tabs__inner return-cases__filters" role="tablist">
        {CASE_FILTERS.map(([k, l]) => <button type="button" role="tab" key={k} aria-selected={filter === k} className={filter === k ? "is-active" : ""} onClick={() => setFilter(k)}>{l} · {count(k)}</button>)}
      </div>
      <div className="customer-detail__column">
        {shown.map(({ ret, code, label, tone }) => (
          <article className="panel record-card" key={ret.id}>
            <div className="record-card__body">
              <h2>{ret.unit} · {ret.contract} · {ret.customer}</h2>
              <p className="muted">{ret.status === "SUBMITTED" ? `Biên bản ${dateTimeLabel(ret.submitted_at)}` : "Khách đã gửi trả kho · chưa có biên bản và ảnh của nhân viên"}</p>
              <p className="muted">{ret.settlement ? `Tổng hoàn ${ret.settlement.official ? "" : "dự kiến "}${amountLabel(ret.settlement.total)}` : "Chưa có số dự kiến"}</p>
            </div>
            <div className="record-card__actions">
              <Tag tone={tone}>{label}</Tag>
              {code === "READY" ? <LinkButton to={`manager/contracts${qs({ id: ret.contract })}`}>Duyệt đối soát</LinkButton>
                : ["SETTLED", "PAID"].includes(code) ? <LinkButton to={`manager/contracts${qs({ id: ret.contract })}`} variant="outline">Xem hồ sơ</LinkButton>
                  : <Button variant="outline" disabled title={code === "WAIT_STAFF" ? "Chưa có biên bản và ảnh hiện trạng của nhân viên" : "Khách chưa phản hồi hết các khoản khấu trừ"}>Chưa thể duyệt</Button>}
            </div>
          </article>
        ))}
        {!shown.length && <Empty title="Không có hồ sơ" text="Không có hồ sơ trả kho ở trạng thái này." />}
      </div>
      <p className="hint">“Chưa thể duyệt”: hồ sơ chưa có biên bản và ảnh của nhân viên, hoặc khách chưa phản hồi hết các khoản khấu trừ.</p>
    </section>
  );
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
      <ReturnCases ops={ops} />
      <h2 className="section-title">Hợp đồng</h2>
      <div className="customer-detail__column">{visibleContracts.map(c=>{const [label,tone]=CONTRACT_STATE(c);return <RecordCard key={c.id} title={`${c.id} · ${c.customer}`} subtitle={`Kho ${c.unit} · hết hạn ${dateLabel(c.end)}`} status={label} actions={<>{c.state==="OVERDUE"&&<LinkButton to={`manager/overdue${qs({contract:c.id})}`}>Xử lý quá hạn</LinkButton>}<LinkButton to={`manager/contracts${qs({id:c.id})}`} variant={c.state==="OVERDUE"?"outline":undefined}>{c.state==="RETURNED"?"Duyệt đối soát":"Xem hồ sơ"}</LinkButton></>}><p>{c.state==="RETURNED"?"Biên bản đã gửi · khấu trừ tối đa bằng cọc":"Theo dõi hạn thuê và lịch sử liên hệ khách"}</p></RecordCard>;})}</div>
      {query.get("id")&&!sel&&<Empty title="Không tìm thấy hợp đồng" text="Chọn đúng hồ sơ thuộc cơ sở phụ trách."/>}
      {sel && (
        <section className="panel form-card contract-detail" ref={detailRef}>
          <h2>{sel.id} · Bước tiếp theo</h2>
          {sel.state === "RETURNED" ? (
            <>
              {/* #16 · Figma M-ĐS: biên bản & ảnh bên trái, bảng đối soát dự kiến bên phải (cùng số với bước chốt) */}
              <div className="customer-detail__grid"><div className="customer-detail__column"><InspectionReview ret={ops.returns.find(r=>r.contract===sel.id)}/></div><SettlementTable settlement={settlementOf(ops.returns.find(r=>r.contract===sel.id)?.settlement)} report={ops.returns.find(r=>r.contract===sel.id)?.report}/></div>
              <p className="muted">Biên bản trả kho {sel.unit} đã được gửi và khách đã phản hồi. Kiểm tra số liệu rồi chốt đối soát để chuyển sang hoàn tiền.</p>
              {!settlementReady && <Notice>{RETURN_POLICY_PENDING}</Notice>}
              <Button disabled={!settlementReady||saving||needsRefresh||!canFinalizeReturn(ops,sel,ops.returns.find(r=>r.contract===sel.id))||(source==="api"&&ops.returns.find(r=>r.contract===sel.id)?.damage_workflow_resolved!==true)} onClick={() => setReturning(true)}>Xác nhận trả kho</Button>
            </>
          ) : sel.state === "CLOSED" || sel.state === "RESOLVED" ? (
            <SettledCase ops={ops} contract={sel} />
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
      {/* #7: lối vào Hoàn tiền đơn huỷ / Hoàn cọc trả kho nay là tab đầu trang (Figma G2), bỏ thẻ liên kết trùng ở cuối trang */}
    </main>
  );
}
