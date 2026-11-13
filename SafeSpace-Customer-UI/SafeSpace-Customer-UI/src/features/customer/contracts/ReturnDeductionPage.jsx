/**
 * RETURN DEDUCTION PAGE - PHẢN HỒI BIÊN BẢN KHẤU TRỪ TIỀN CỌC (D30-13 / D39 / D40)
 *
 * Nghiệp vụ D39:
 * - Khách hàng có 48 giờ để phản hồi biên bản kiểm kê trả kho của cơ sở:
 *   1. Đồng ý khấu trừ (AGREE) -> Quản lý chốt và hoàn số tiền cọc còn lại.
 *   2. Tự dọn dẹp (SELF_CLEAN) -> Quay lại dọn trong 48h để không mất phí vệ sinh 10%.
 *   3. Tự khắc phục/thay thế (SELF_REPLACE) -> Tải ảnh hóa đơn/vật tư thay thế.
 *   4. Khiếu nại (DISPUTE) -> Nêu rõ lý do và cung cấp ảnh phản hồi.
 */
import React, { useRef, useState } from "react";
import { Button, DetailList, Empty, Field, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
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
  SELF_REMEDY: ["Chờ cơ sở kiểm tra lại · tự dọn & tự thay", "amber"],
  DISPUTE: ["Đang xem xét khiếu nại", "amber"], RECHECKED: ["Cơ sở đã kiểm tra lại", "green"],
};
const DECISIONS = {
  AGREE: "Đồng ý khấu trừ · hoàn tất hoàn cọc",
  SELF_CLEAN: "Tự dọn dẹp kho thay cho phí vệ sinh",
  SELF_REPLACE: "Tự thay thế vật dụng tương đương thay cho phí hư hỏng",
  SELF_REMEDY: "Tự dọn dẹp và tự thay thế vật dụng",
  DISPUTE: "Khiếu nại nội dung biên bản",
};
const CLEAN_DECISIONS = {
  AGREE: "Đồng ý khấu trừ phí vệ sinh",
  SELF_CLEAN: "Tự dọn dẹp kho thay cho phí vệ sinh",
  DISPUTE: "Khiếu nại khoản vệ sinh",
};
const DAMAGE_DECISIONS = {
  AGREE: "Đồng ý khấu trừ phí hư hỏng",
  SELF_REPLACE: "Tự thay thế vật dụng tương đương thay cho phí hư hỏng",
  DISPUTE: "Khiếu nại khoản hư hỏng",
};
const safeUrl = url => typeof url === "string" && (/^https:\/\//.test(url) || /^\/[^/]/.test(url));

/**
 * Màn hình cho phép khách hàng xem xét và phản hồi phương án khấu trừ cọc.
 * @param {{ contract: Object }} props
 */
export function ReturnDeductionPage({ id }) {
  const { data } = useApp();
  const c = contractOf(data, id);
  const load = useReturnDeduction(c?.api_id ?? id);
  const [cleaningDecision, setCleaningDecision] = useState(""), [damageDecision, setDamageDecision] = useState("");
  const [note, setNote] = useState(""), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [files, setFiles] = useState([]), [reading, setReading] = useState(false);
  const guard = useRef(false);
  if (!c) return <NotFound />;
  const d = load.data;
  const hasCleaning = Number(d?.cleaningFee || 0) > 0;
  const hasDamage = Number(d?.damageFee || 0) > 0;
  const total = d ? Math.max(0, Number(d.deposit) - (Number(d.overdueFee) || 0) - Number(d.cleaningFee) - Number(d.damageFee)) : 0;
  const left = d ? hoursLeft(d.deadlineAt) : null;
  const open = d?.status === "WAITING" && left !== 0;
  const needsNote = cleaningDecision === "DISPUTE" || damageDecision === "DISPUTE";
  const allowPhotos = damageDecision === "SELF_REPLACE" || needsNote;
  const summaryDecision = needsNote ? "DISPUTE"
    : cleaningDecision === "SELF_CLEAN" && damageDecision === "SELF_REPLACE" ? "SELF_REMEDY"
    : cleaningDecision === "SELF_CLEAN" ? "SELF_CLEAN"
    : damageDecision === "SELF_REPLACE" ? "SELF_REPLACE"
    : "AGREE";
  const agreeAll = () => {
    if (hasCleaning) setCleaningDecision("AGREE");
    if (hasDamage) setDamageDecision("AGREE");
    setError("");
  };
  const submit = e => {
    e.preventDefault();
    if (hasCleaning && !cleaningDecision) return setError("Chọn phương án cho khoản vệ sinh.");
    if (hasDamage && !damageDecision) return setError("Chọn phương án cho khoản hư hỏng.");
    if (needsNote && !note.trim()) return setError("Ghi rõ nội dung khiếu nại.");
    setError(""); setConfirm(true);
  };
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      await load.decide(
        {
          decision: summaryDecision,
          cleaningDecision: hasCleaning ? cleaningDecision : null,
          damageDecision: hasDamage ? damageDecision : null,
          note: note.trim() || null,
        },
        allowPhotos ? files : [],
      );
      setConfirm(false); setDone(true); await load.reload();
    } catch (e) { setError(e?.message || "Chưa gửi được lựa chọn. Tải lại trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  const [label, tone] = STATUS[d?.status] || ["Chưa có biên bản", "blue"];
  const overdue = Number(d?.overdueFee) || 0, deposit = Number(d?.deposit) || 0;
  const pct = deposit > 0 && d?.cleaningFee > 0 ? Math.round(Number(d.cleaningFee) / deposit * 100) : null;
  const pill = d?.status === "WAITING" && left != null ? `${label} · còn ${left} giờ` : label;
  const noteLabel = needsNote ? "Nội dung khiếu nại *"
    : (cleaningDecision === "SELF_CLEAN" || damageDecision === "SELF_REPLACE") ? "Phương án và thời gian thực hiện"
    : "Ghi chú cho cơ sở (không bắt buộc)";
  const deductRows = d ? [
    ...(d.cleaningFee > 0 ? [["Vệ sinh · theo chính sách", <strong>{money(d.cleaningFee)}{pct != null ? ` (${pct}% cọc)` : ""}</strong>]] : []),
    ...(d.damageFee > 0 ? [[`Hư hỏng${d.damageItem ? ` · ${d.damageItem}` : ""}`, <strong>{money(d.damageFee)} (theo biên bản)</strong>]] : []),
  ] : [];
  const minus = v => v > 0 ? <span className="money-deduct">− {money(v)}</span> : money(0);
  const summaryRows = [
    ...(hasCleaning && cleaningDecision ? [["Khoản vệ sinh", CLEAN_DECISIONS[cleaningDecision]]] : []),
    ...(hasDamage && damageDecision ? [["Khoản hư hỏng", DAMAGE_DECISIONS[damageDecision]]] : []),
    ...(note.trim() ? [["Ghi chú", note.trim()]] : []),
  ];
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id}</p>
    <PageHeader title={`Xác nhận khấu trừ trả kho · Kho ${c.unit_number}`} description="Nhân viên đã kiểm tra kho. Xem các khoản trừ vào cọc rồi xác nhận để hoàn tất hoàn cọc.">{d && <Tag tone={tone}>{pill}</Tag>}</PageHeader>
    {load.demo ? <Notice>Chế độ mô phỏng chưa có biên bản trả kho thật. Vui lòng dùng chế độ kết nối máy chủ.</Notice>
      : load.loading ? <Notice>Đang tải biên bản…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : !d ? <Empty title="Chưa có biên bản trả kho" text="Nhân viên gửi biên bản trong 3 ngày sau khi bạn gửi yêu cầu trả kho." />
      : <div className="customer-detail__grid">
        <div className="customer-detail__column">
          <section className="panel customer-detail__card"><h2>Khoản khấu trừ từ cọc</h2>
            {deductRows.length ? <DetailList items={deductRows} /> : <p className="hint">Biên bản không có khoản trừ vào cọc.</p>}
            {d.photos?.length > 0 && <ul className="deduction-photos">{d.photos.filter(p => safeUrl(p.url)).map((p, i) => <li key={i}><a href={p.url} target="_blank" rel="noreferrer" aria-label={`Xem ảnh biên bản ${i + 1}`}><img src={p.url} alt={`Ảnh biên bản ${i + 1}`} loading="lazy" /></a></li>)}</ul>}
            <p className="hint">Biên bản do {d.staffName || "nhân viên cơ sở"} lập lúc {vnStamp(d.sentAt)}.{d.cleaningFee > 0 ? " Phí vệ sinh cố định theo chính sách trả kho." : ""}{d.damageFee > 0 ? " Hư hỏng kèm ảnh bằng chứng." : ""}{d.feeReason ? ` Ghi chú: ${d.feeReason}` : ""}</p>
          </section>
          {open ? <form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Phản hồi của bạn</h2>
            {hasCleaning && hasDamage && <div className="customer-detail__actions"><Button type="button" variant="outline" disabled={busy} onClick={agreeAll}>Đồng ý toàn bộ biên bản</Button></div>}
            {hasCleaning && <fieldset className="choice-list" disabled={busy}>
              <legend><strong>Khoản vệ sinh ({money(d.cleaningFee)})</strong></legend>
              {Object.keys(CLEAN_DECISIONS).map(k => <label key={k} className="choice-list__item"><input type="radio" name="cleaningDecision" checked={cleaningDecision === k} onChange={() => { setCleaningDecision(k); setError(""); }} /><span>{CLEAN_DECISIONS[k]}</span></label>)}
            </fieldset>}
            {hasDamage && <fieldset className="choice-list" disabled={busy}>
              <legend><strong>Khoản hư hỏng ({money(d.damageFee)})</strong></legend>
              {Object.keys(DAMAGE_DECISIONS).map(k => <label key={k} className="choice-list__item"><input type="radio" name="damageDecision" checked={damageDecision === k} onChange={() => { setDamageDecision(k); setError(""); }} /><span>{DAMAGE_DECISIONS[k]}</span></label>)}
            </fieldset>}
            {(cleaningDecision || damageDecision) && <Field label={noteLabel}><textarea rows={3} maxLength={1000} value={note} disabled={busy} onChange={e => { setNote(e.target.value); setError(""); }} /></Field>}
            {allowPhotos && <ReturnPhotoInput files={files} onChange={setFiles} onReading={setReading} disabled={busy} required={false} max={5} label="Đính kèm ảnh / hoá đơn · không bắt buộc" />}
            <p className="hint">Bạn có 48 giờ để xác nhận{d.deadlineAt ? ` (đến ${vnStamp(d.deadlineAt)})` : ""}. Quá 48 giờ không phản hồi, hệ thống tự hoàn cọc theo biên bản của nhân viên. Cơ sở luôn chấp nhận phương án tự dọn dẹp; kiểm tra lại đạt thì không trừ phí vệ sinh.</p>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="customer-detail__actions"><Button type="submit" disabled={busy || reading}>Gửi phản hồi cho cơ sở</Button></div>
          </form>
          : <section className="panel customer-detail__card"><h2>Kết quả</h2>
            {done && <Notice tone="success">Đã gửi phản hồi của bạn.</Notice>}
            <DetailList items={[
              ["Trạng thái", label],
              ...(d.decision ? [["Phương án chung", DECISIONS[d.decision] || d.decision], ["Lúc", vnStamp(d.decidedAt)]] : []),
              ...(d.cleaningDecision ? [["Khoản vệ sinh", CLEAN_DECISIONS[d.cleaningDecision] || d.cleaningDecision]] : []),
              ...(d.damageDecision ? [["Khoản hư hỏng", DAMAGE_DECISIONS[d.damageDecision] || d.damageDecision]] : []),
              ...(d.decisionNote ? [["Ghi chú", d.decisionNote]] : []),
              ...(d.recheckNote ? [["Kết quả kiểm tra lại", d.recheckNote]] : []),
            ]} />
            {d.customerPhotos?.length > 0 && <ul className="deduction-photos" aria-label="Ảnh bạn đã gửi">{d.customerPhotos.filter(p => safeUrl(p.url)).map((p, i) => <li key={i}><a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`Ảnh bạn gửi ${i + 1}`} loading="lazy" /></a></li>)}</ul>}
            {d.status === "NONE" && <p className="hint">Biên bản không có khoản trừ nên không cần xác nhận; cơ sở chốt hoàn cọc theo quy trình.</p>}
          </section>}
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Khoản hoàn sau khấu trừ</h2>
          <DetailList items={[["Cọc ban đầu", money(deposit)], ...(overdue > 0 ? [[`Quá hạn ${d.overdueDays} ngày`, minus(overdue)]] : []), ["Vệ sinh · theo chính sách", minus(d.cleaningFee)], ["Hư hỏng · theo biên bản", minus(d.damageFee)]]} />
          <div className="summary-total"><span>Cọc còn hoàn dự kiến</span><strong>{money(total)}</strong></div>
          {/* #16: cùng cách gọi với bảng đối soát của quản lý; tiền thuê tháng chưa bắt đầu tính khi chốt (D49) */}
          <p className="hint">Nếu bạn trả kho trước hạn, tiền thuê các tháng chưa bắt đầu sử dụng được cộng vào khoản hoàn khi cơ sở chốt đối soát. Không giữ 30% cọc. Hoàn cọc chỉ hoàn tất sau khi bạn xác nhận. Nếu cơ sở chấp nhận bạn tự dọn hoặc thay thế, khoản đó không bị trừ. Tổng khấu trừ tối đa bằng tiền cọc.</p>
        </aside>
      </div>}
    {confirm && <ConfirmDialog title="Gửi phản hồi cho cơ sở?" tone="warning" text="Bạn chỉ chọn được một lần cho biên bản này." rows={summaryRows} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Gửi phản hồi" />}
  </main>;
}
