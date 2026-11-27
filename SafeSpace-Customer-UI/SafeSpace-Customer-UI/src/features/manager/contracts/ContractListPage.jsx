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
import { canFinalizeReturn, isReturnSettlementReady, returnCaseState, returnRefundChoice, settlementFromRefund, settlementOf } from "../../facility-operations/settlements/settlementModel.js";
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

// M07 · D67: một nút — chốt đối soát và xác nhận luôn đã chuyển khoản / đã bàn giao tiền mặt cho quầy.
function ReturnConfirmDialog({ contract, ret, onClose, onConfirm }) {
  // #16: hiện đúng số trên bảng đối soát (cùng RefundPolicy với bước chốt), không còn "Máy chủ tính khi chốt"
  const st = settlementOf(ret?.settlement);
  const choice = returnRefundChoice(ret);
  const total = Number(st?.total);
  const hasRefund = Number.isFinite(total) ? total > 0 : true;
  // Chuyển khoản thiếu tài khoản nhận → chỉ chốt, xác nhận chuyển sau ở mục Hoàn tiền khi khách bổ sung.
  const payout = hasRefund && choice.complete;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const label = !hasRefund ? "Chốt đối soát" : !payout ? "Chốt đối soát" : choice.cash ? "Chốt & giao tiền về quầy" : "Chốt & đã chuyển khoản"; // D68: ngắn để không xuống dòng
  const text = !hasRefund
    ? "Không còn khoản hoàn. Chốt đối soát để đóng hợp đồng."
    : !payout
      ? "Khách chưa khai đủ tài khoản nhận hoàn. Chốt đối soát trước, xác nhận chuyển khoản ở mục Hoàn tiền sau khi khách bổ sung."
      : choice.cash
        ? `Chốt đối soát và bàn giao ${amountLabel(st?.total)} tiền mặt về quầy cơ sở. Khách đến nhận lúc nào cũng được.`
        : `Chuyển ${amountLabel(st?.total)} vào tài khoản dưới đây trước khi bấm. Bấm là chốt đối soát và ghi đã chuyển khoản; không cần mã giao dịch.`;
  const rows = [["Khách hàng / kho", `${contract.customer} · ${contract.unit}`], ["Tổng khấu trừ", amountLabel(st?.totalDeduction)], ["Cọc còn hoàn", amountLabel(st?.depositRefund)], ["Tiền thuê được hoàn", amountLabel(st?.rentRefund)], ["Tổng tiền hoàn", amountLabel(st?.total)],
    ...(hasRefund ? (choice.cash ? [["Khách chọn nhận", "Tiền mặt tại quầy"]]
      : [["Khách chọn nhận", "Chuyển khoản"], ["Ngân hàng", choice.bankName || "Chưa có"], ["Số tài khoản", choice.accountNumber || "Chưa có"], ["Chủ tài khoản", choice.accountHolder || "Chưa có"]]) : [])];
  return <ConfirmDialog title={`Duyệt đối soát · ${contract.id}`} text={text} busy={busy} rows={rows} label={label} hint="Khấu trừ không vượt cọc; không thu thêm. Kho cần vệ sinh/sửa tiếp tục bảo trì." onCancel={onClose} onConfirm={async()=>{if(busy)return;setBusy(true);try{const ok=await onConfirm(note.trim(), payout);if(!ok)setBusy(false);}catch{setBusy(false);}}}><Field label="Ghi chú đối soát"><textarea maxLength={255} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></Field></ConfirmDialog>;
}

// #19 · Figma M-ĐS-CHỐT: sau khi chốt vẫn mở được biên bản, ảnh, kết quả tiền và đường tới khoản hoàn.
/**
 * D68: không còn tab "Hoàn tiền". Khoản hoàn còn chờ (đơn huỷ đã thanh toán, khách khai thiếu tài khoản, khoản trước D67)
 * hiện thành một dòng nhắc ở đầu "Biên bản & trả kho" và mở trang xác nhận.
 */
function PendingRefundsNotice({ ops }) {
  const cancel = (ops.refunds || []).filter((r) => r.status === "PENDING").length;
  const deposit = (ops.deposit_refunds || []).filter((r) => r.status === "PENDING").length;
  const total = cancel + deposit;
  if (!total) return null;
  return (
    <Notice>
      Còn {total} khoản hoàn chờ xác nhận{cancel ? ` (${cancel} khoản hoàn đơn huỷ)` : ""}.{" "}
      <LinkButton to="manager/refund" variant="outline">Xác nhận hoàn tiền</LinkButton>
    </Notice>
  );
}

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
          {ret ? <InspectionReview ret={ret} /> : <Notice>Biên bản cũ hơn 30 ngày: xem trong khoản hoàn bên dưới.</Notice>}
          {refund && (
            <section className="panel customer-detail__card">
              <h2>Khoản hoàn {refund.id}</h2>
              <p className="muted">{refund.method === "CASH" ? "Tiền mặt tại quầy" : `Chuyển khoản ${refund.bankName || ""}`} · {amountLabel(refund.amount)}</p>
              <p className="muted">{refund.status === "PAID" ? (refund.method === "CASH" ? `Đã bàn giao tiền mặt về quầy${refund.paidAt ? ` · ${dateTimeLabel(refund.paidAt)}` : ""}` : `Đã chuyển khoản${refund.paidAt ? ` · ${dateTimeLabel(refund.paidAt)}` : ""}`) : refund.method === "CASH" ? "Đang chờ: xác nhận đã giao tiền mặt về quầy." : "Đang chờ: chuyển khoản rồi bấm xác nhận."}</p>
              {refund.status === "PENDING" && <div className="customer-detail__actions"><LinkButton to={refund.method === "CASH" ? `manager/refund${qs({ kind: "cash" })}` : `manager/deposit-refunds${qs({ id: refund.id })}`}>Xác nhận hoàn tiền</LinkButton></div>}
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
              <p className="muted">{ret.status === "SUBMITTED" ? `Biên bản ${dateTimeLabel(ret.submitted_at)}` : ret.redo_note ? `Đã trả biên bản ${ret.previous_return_id || ""} cho nhân viên · ${ret.redo_note}` : "Khách đã gửi trả kho · chưa có biên bản và ảnh của nhân viên"}</p>
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
  // D71: trả biên bản cho nhân viên kiểm tra lại, kèm ghi chú bắt buộc
  const [redo, setRedo] = useState(null), [redoNote, setRedoNote] = useState(""), [redoError, setRedoError] = useState("");
  const visibleContracts = ops.contracts.filter((c) => c.state !== "RETURNED" || isReturnSettlementReady(ops, c));
  // Hợp đồng đã có hồ sơ trả kho chỉ hiện ở "Hồ sơ trả kho" phía trên, không lặp lại ở danh sách Hợp đồng.
  const returnContracts = new Set((ops.returns || []).map((r) => r.contract));
  const listedContracts = visibleContracts.filter((c) => !returnContracts.has(c.id));
  const sel = query.get("id") ? visibleContracts.find((c) => c.id === query.get("id")) : null;
  const [note, setNote] = useState("");
  const detailRef = useRef(null);
  // "Xem hồ sơ" mở chi tiết ngay dưới danh sách: cuộn tới để quản lý thấy trang đã chuyển
  useEffect(() => { if (sel) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [sel?.id]);
  return (
    <main className="container page">
      <PageHeaderBlock title="Biên bản & trả kho" text="Xem biên bản trả kho của nhân viên, chốt đối soát và xác nhận hoàn tiền; theo dõi hạn thuê và quá hạn." />
      <PendingRefundsNotice ops={ops} />
      <ReturnCases ops={ops} />
      <h2 className="section-title">Hợp đồng</h2>
      <div className="customer-detail__column">{!listedContracts.length&&<Empty title="Không có hợp đồng cần theo dõi" text="Hợp đồng đang trả kho xem ở Hồ sơ trả kho phía trên."/>}{listedContracts.map(c=>{const [label,tone]=CONTRACT_STATE(c);return <RecordCard key={c.id} title={`${c.id} · ${c.customer}`} subtitle={`Kho ${c.unit} · hết hạn ${dateLabel(c.end)}`} status={label} actions={<>{c.state==="OVERDUE"&&<LinkButton to={`manager/overdue${qs({contract:c.id})}`}>Xử lý quá hạn</LinkButton>}<LinkButton to={`manager/contracts${qs({id:c.id})}`} variant={c.state==="OVERDUE"?"outline":undefined}>{c.state==="RETURNED"?"Duyệt đối soát":"Xem hồ sơ"}</LinkButton></>}><p>{c.state==="RETURNED"?"Biên bản đã gửi · khấu trừ tối đa bằng cọc":"Theo dõi hạn thuê và lịch sử liên hệ khách"}</p></RecordCard>;})}</div>
      {query.get("id")&&!sel&&<Empty title="Không tìm thấy hợp đồng" text="Chọn đúng hồ sơ thuộc cơ sở phụ trách."/>}
      {sel && (
        <section className="panel form-card contract-detail" ref={detailRef}>
          <h2>{sel.id} · Bước tiếp theo</h2>
          {sel.state === "RETURNED" ? (
            <>
              {/* #16 · Figma M-ĐS: biên bản & ảnh bên trái, bảng đối soát dự kiến bên phải (cùng số với bước chốt) */}
              <div className="customer-detail__grid"><div className="customer-detail__column"><InspectionReview ret={ops.returns.find(r=>r.contract===sel.id)}/></div><SettlementTable settlement={settlementOf(ops.returns.find(r=>r.contract===sel.id)?.settlement)} report={ops.returns.find(r=>r.contract===sel.id)?.report}/></div>
              <p className="muted">Biên bản trả kho {sel.unit} đã được gửi và khách đã phản hồi. Kiểm tra số liệu và thông tin nhận hoàn, rồi chốt đối soát và xác nhận hoàn tiền ngay tại đây.</p>
              {!settlementReady && <Notice>{RETURN_POLICY_PENDING}</Notice>}
              <Button disabled={!settlementReady||saving||needsRefresh||!canFinalizeReturn(ops,sel,ops.returns.find(r=>r.contract===sel.id))||(source==="api"&&ops.returns.find(r=>r.contract===sel.id)?.damage_workflow_resolved!==true)} onClick={() => setReturning(true)}>Chốt đối soát &amp; hoàn tiền</Button>{" "}
              <Button variant="outline" disabled={saving||needsRefresh||ops.returns.find(r=>r.contract===sel.id)?.status!=="SUBMITTED"} onClick={() => { setRedo(ops.returns.find(r=>r.contract===sel.id)); setRedoNote(""); setRedoError(""); }}>Yêu cầu kiểm tra lại</Button>
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
              onConfirm={async (note, payout) => {
                // Giữ hộp thoại (và ghi chú) khi lưu thất bại để quản lý kiểm tra rồi thử lại
                const res = await run("CONFIRM_REFUND", { id: sel.id, note, payout }, payout ? "Đã chốt đối soát và xác nhận hoàn tiền" : "Đã xác nhận trả kho");
                if (res.ok) setReturning(false);
                return res.ok;
              }}
            />
          )}
          {redo && (
            <ConfirmDialog
              title={`Yêu cầu kiểm tra lại · Kho ${redo.unit}`}
              text="Biên bản hiện tại sẽ bị huỷ và lưu lại để đối chiếu. Nhân viên lập biên bản mới theo ghi chú của bạn. Khách không nhận thông báo; nếu khoản khấu trừ thay đổi, khách sẽ xác nhận lại."
              label="Gửi cho nhân viên" busy={saving} hint=""
              onCancel={() => setRedo(null)}
              onConfirm={async () => {
                if (!redoNote.trim()) return setRedoError("Ghi rõ điều nhân viên cần kiểm tra lại.");
                const res = await run("REDO_RETURN", { id: redo.id, contract: redo.contract, note: redoNote }, "Đã gửi yêu cầu kiểm tra lại cho nhân viên");
                if (res.ok) { setRedo(null); go("manager/contracts"); } else setRedoError(res.error || "Không gửi được yêu cầu.");
              }}
            >
              <Field label="Điều nhân viên cần kiểm tra lại *">
                <textarea rows={3} maxLength={1000} value={redoNote} placeholder="Ví dụ: chụp lại ảnh tường bên trái, kiểm tra lại ổ khoá" onChange={(e) => { setRedoNote(e.target.value); setRedoError(""); }} />
              </Field>
              {redoError && <Notice tone="error">{redoError}</Notice>}
            </ConfirmDialog>
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
