import React, { useRef, useState } from "react";
import { Button, DetailList, Empty, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { money } from "../../../shared/utils/format.js";
import { hoursLeft, vnStamp } from "../../../shared/utils/vnTime.js";
import { contractOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { useReturnDeduction } from "./useReturnDeduction.js";
import "../../../shared/styles/customer-detail.css";

// D30-13 · D39/D40: khách xác nhận khoản trừ cọc trong 48 giờ; quá hạn hệ thống tự hoàn theo biên bản nhân viên.
const STATUS = {
  NONE: ["Không có khấu trừ", "green"], WAITING: ["Chờ bạn xác nhận", "amber"], AUTO_AGREED: ["Đã chốt theo biên bản (quá 48 giờ)", "blue"],
  AGREED: ["Bạn đã đồng ý", "green"], SELF_CLEAN: ["Chờ cơ sở kiểm tra lại · tự dọn", "amber"], SELF_REPLACE: ["Chờ cơ sở kiểm tra lại · tự thay", "amber"],
  DISPUTE: ["Đang xem xét khiếu nại", "amber"], RECHECKED: ["Cơ sở đã kiểm tra lại", "green"],
};
const DECISIONS = {
  AGREE: ["Đồng ý khấu trừ · hoàn tất hoàn cọc", "Cơ sở chốt hoàn cọc theo biên bản."],
  SELF_CLEAN: ["Tự dọn dẹp kho thay cho phí vệ sinh", "Bạn dọn kho; cơ sở kiểm tra lại, đạt tiêu chuẩn thì không trừ phí vệ sinh."],
  SELF_REPLACE: ["Tự thay thế vật dụng tương đương thay cho phí hư hỏng", "Bạn thay vật dụng; cơ sở kiểm tra lại, đạt thì không trừ phí hư hỏng."],
  DISPUTE: ["Khiếu nại nội dung biên bản", "Ghi rõ nội dung chưa đúng; cơ sở xem xét và kiểm tra lại."],
};
const safeUrl = url => typeof url === "string" && (/^https:\/\//.test(url) || /^\/[^/]/.test(url));

export function ReturnDeductionPage({ id }) {
  const { data } = useApp();
  const c = contractOf(data, id);
  const load = useReturnDeduction(c?.api_id ?? id);
  const [decision, setDecision] = useState(""), [note, setNote] = useState(""), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const guard = useRef(false);
  if (!c) return <NotFound />;
  const d = load.data;
  const total = d ? Math.max(0, Number(d.deposit) - Number(d.cleaningFee) - Number(d.damageFee)) : 0;
  const left = d ? hoursLeft(d.deadlineAt) : null;
  const options = d ? Object.keys(DECISIONS).filter(k => (k !== "SELF_CLEAN" || d.cleaningFee > 0) && (k !== "SELF_REPLACE" || d.damageFee > 0)) : [];
  const open = d?.status === "WAITING" && left !== 0;
  const submit = e => {
    e.preventDefault();
    if (!decision) return setError("Chọn một phương án.");
    if (decision === "DISPUTE" && !note.trim()) return setError("Ghi rõ nội dung khiếu nại.");
    setError(""); setConfirm(true);
  };
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await load.decide(decision, note.trim() || null); setConfirm(false); setDone(true); await load.reload(); }
    catch (e) { setError(e?.message || "Chưa gửi được lựa chọn. Tải lại trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  const [label, tone] = STATUS[d?.status] || ["Chưa có biên bản", "blue"];
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id} / Xác nhận khấu trừ</p>
    <PageHeader title={`Xác nhận khấu trừ · Kho ${c.unit_number}`} description="Kiểm tra biên bản trả kho của nhân viên và chọn phương án trong 48 giờ.">{d && <Tag tone={tone}>{label}</Tag>}</PageHeader>
    {load.demo ? <Notice>Chế độ mô phỏng chưa có biên bản trả kho thật. Vui lòng dùng chế độ kết nối máy chủ.</Notice>
      : load.loading ? <Notice>Đang tải biên bản…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : !d ? <Empty title="Chưa có biên bản trả kho" text="Nhân viên gửi biên bản trong 3 ngày sau khi bạn gửi yêu cầu trả kho." />
      : <div className="customer-detail__grid">
        <div className="customer-detail__column">
          {d.needsConfirmation && <section className="panel customer-detail__card deadline-banner"><div><h2>Hạn xác nhận: {vnStamp(d.deadlineAt)}</h2><p className="hint">{left != null ? `Còn khoảng ${left} giờ.` : ""} Quá hạn, hệ thống tự hoàn cọc theo biên bản của nhân viên.</p></div><Tag tone="amber">48 giờ</Tag></section>}
          <section className="panel customer-detail__card"><h2>Biên bản {d.returnId}</h2>
            <DetailList items={[["Gửi lúc", vnStamp(d.sentAt)], ...(d.damageItem ? [["Hạng mục hư hỏng", d.damageItem]] : []), ["Lý do khấu trừ", d.feeReason || "Không có"]]} />
            {d.photos?.length ? <ul className="deduction-photos">{d.photos.filter(p => safeUrl(p.url)).map((p, i) => <li key={i}><a href={p.url} target="_blank" rel="noreferrer">Xem ảnh biên bản {i + 1}</a></li>)}</ul> : <p className="hint">Biên bản không kèm ảnh.</p>}
          </section>
          {open ? <form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Phương án của bạn</h2>
            <fieldset className="deduction-options" disabled={busy}>
              {options.map(k => <label key={k} className={`refund-method__option${decision === k ? " is-active" : ""}`}><input type="radio" name="deduction" checked={decision === k} onChange={() => { setDecision(k); setError(""); }} /><span><strong>{DECISIONS[k][0]}</strong><small>{DECISIONS[k][1]}</small></span></label>)}
            </fieldset>
            <Field label={decision === "DISPUTE" ? "Nội dung khiếu nại *" : "Ghi chú cho cơ sở (không bắt buộc)"}><textarea rows={3} maxLength={1000} value={note} disabled={busy} onChange={e => { setNote(e.target.value); setError(""); }} /></Field>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="customer-detail__actions"><LinkButton to={`units/${encodeURIComponent(id)}/progress`} variant="outline">Tiến độ trả kho</LinkButton><Button type="submit" disabled={busy}>Gửi lựa chọn</Button></div>
          </form>
          : <section className="panel customer-detail__card"><h2>Kết quả</h2>
            {done && <Notice tone="success">Đã gửi lựa chọn của bạn.</Notice>}
            <DetailList items={[["Trạng thái", label], ...(d.decision ? [["Bạn đã chọn", DECISIONS[d.decision]?.[0] || d.decision], ["Lúc", vnStamp(d.decidedAt)]] : []), ...(d.decisionNote ? [["Ghi chú", d.decisionNote]] : []), ...(d.recheckNote ? [["Kết quả kiểm tra lại", d.recheckNote]] : [])]} />
            {d.status === "NONE" && <p className="hint">Biên bản không có khoản trừ nên không cần xác nhận; cơ sở chốt hoàn cọc theo quy trình.</p>}
          </section>}
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar return-refund"><h2>Khoản hoàn dự kiến</h2>
          <DetailList items={[["Cọc ban đầu", money(d.deposit)], ["Phí vệ sinh theo chính sách", d.cleaningFee > 0 ? <span className="money-deduct">− {money(d.cleaningFee)}</span> : money(0)], ["Hư hỏng theo biên bản", d.damageFee > 0 ? <span className="money-deduct">− {money(d.damageFee)}</span> : money(0)]]} />
          <div className="return-refund__total"><span>Dự kiến hoàn</span><strong>{money(total)}</strong></div>
          <p className="hint">Phí quá hạn (nếu có) và tiền thuê chưa dùng được tính khi cơ sở chốt hoàn cọc. Tổng khấu trừ tối đa bằng tiền cọc.</p>
        </aside>
      </div>}
    {confirm && <ConfirmDialog title="Gửi lựa chọn khấu trừ?" tone="warning" text="Bạn chỉ chọn được một lần cho biên bản này." rows={[["Phương án", DECISIONS[decision][0]], ...(note.trim() ? [["Ghi chú", note.trim()]] : [])]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Gửi lựa chọn" />}
  </main>;
}
