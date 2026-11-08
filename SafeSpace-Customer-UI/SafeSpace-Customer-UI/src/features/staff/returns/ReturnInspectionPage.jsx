import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Empty, Field, Icon, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
import { cleaningFee, earlyStopKeep, isEarlyStop } from "../../../shared/utils/returnPolicy.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { validateInspection } from "../../facility-operations/settlements/settlementModel.js";
import { OpsDemo, SettlementSummary } from "../../facility-operations/settlements/SettlementComponents.jsx";
import { DamagePhotos, timeLabel } from "../../facility-operations/damage/DamageComponents.jsx";
import "../../../shared/styles/customer-detail.css";

export const PROPOSALS = ["Chờ vệ sinh / kiểm tra trước khi cho thuê lại", "Sẵn sàng cho thuê lại", "Cần bảo trì trước khi cho thuê lại"];
const READY = PROPOSALS[1];

// Biên bản S06 (Figma D30-08): mỗi mục là nhãn + ô chọn mở danh sách xếp bên dưới; không ô chữ nào bắt buộc.
// Không điền sẵn kết luận (Batch08): phải chọn 3 mục, có nút "Tất cả đạt tiêu chuẩn" để chọn nhanh.
// D38: đạt dưới 2/3 tiêu chuẩn thì không được chọn "Sẵn sàng cho thuê lại".
// Chỉ khi có hư hỏng mới cần số tiền khấu trừ và ảnh (D32, BE kiểm lại).
export const CHECKS = [
  { key: "items", label: "Đồ còn lại", options: [
    { value: "Đạt · không còn đồ", tone: "ok" },
    { value: "Chưa đạt · còn ít đồ", tone: "warn", cleaning: true },
    { value: "Chưa đạt · còn nhiều đồ", tone: "warn", cleaning: true },
  ] },
  { key: "walls", label: "Tường, sàn và cửa", options: [
    { value: "Đạt tiêu chuẩn", tone: "ok" },
    { value: "Chưa đạt tiêu chuẩn vệ sinh", tone: "warn", cleaning: true },
    { value: "Hư hỏng (trầy, móp, thủng…)", tone: "bad", damage: true },
  ] },
  { key: "keys", label: "Chìa khóa vật lý", options: [
    { value: "Đã nhận đủ chìa", tone: "ok" },
    { value: "Thiếu chìa", tone: "bad", damage: true },
    { value: "Chìa hỏng", tone: "bad", damage: true },
  ] },
];
const optionOf = (check, value) => check.options.find((o) => o.value === value);
const ALL_OK = { items: CHECKS[0].options[0].value, walls: CHECKS[1].options[0].value, keys: CHECKS[2].options[0].value, cleaning_required: false, proposal: READY };
const DEFAULT_FORM = { items: "", walls: "", keys: "", cleaning_required: false, proposal: "", damage_fee: "0", note: "" };
const chosen = (form) => CHECKS.every((c) => Boolean(form[c.key]));

// Tình trạng được chọn → hạng mục hư hỏng, có cần vệ sinh không, trạng thái ô đề xuất
export function inspectionFlags(form) {
  const picked = CHECKS.map((c) => ({ check: c, option: optionOf(c, form[c.key]) }));
  const damaged = picked.filter((p) => p.option?.damage);
  const dirty = picked.some((p) => p.option?.cleaning);
  const clean = picked.filter((p) => p.option?.tone === "ok").length;
  return {
    damaged: damaged.length > 0,
    dirty,
    clean,
    damageItem: damaged.map((p) => `${p.check.label}: ${p.option.value}`).join("; "),
    proposal: damaged.length ? PROPOSALS[2] : dirty ? PROPOSALS[0] : READY,
  };
}

// Dữ liệu gửi đi: giữ đúng 4 mục + phí như trước (OpsReturnInspectionRequest), lý do khấu trừ tự ghép
export function buildInspectionReport(form, deposit) {
  const flags = inspectionFlags(form);
  const raw = String(form.damage_fee ?? "").trim();
  const damageFee = flags.damaged ? (raw === "" ? NaN : Number(raw)) : 0;
  const note = String(form.note || "").trim();
  const reasons = [
    form.cleaning_required && "Kho chưa đạt tiêu chuẩn vệ sinh (10% cọc)",
    flags.damaged && damageFee > 0 && `Hư hỏng · ${flags.damageItem}`,
    note && `Ghi chú: ${note}`,
  ].filter(Boolean);
  return {
    items: form.items, walls: form.walls, keys: form.keys, proposal: form.proposal,
    damage_fee: damageFee, damage_item: flags.damaged ? flags.damageItem : "",
    cleaning_required: Boolean(form.cleaning_required), fee_reason: reasons.join("; "),
    cleaning_fee: cleaningFee(deposit, form.cleaning_required),
  };
}

// Ô chọn: bấm mở danh sách xếp ngay dưới ô (listbox), chọn xong tự đóng; Esc hoặc bấm ra ngoài để đóng
function ChoiceSelect({ label, value, options, onChange, disabled, placeholder = "Chọn tình trạng", extra }) {
  const [open, setOpen] = useState(false), ref = useRef(null), id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return <div className={`inspect-field${open ? " is-open" : ""}`} ref={ref}>
    <div className="inspect-field__label"><span id={`${id}-l`}>{label}</span>{extra}</div>
    <button type="button" className={`inspect-select${current ? "" : " is-empty"}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-l ${id}-v`} onClick={() => setOpen((v) => !v)}>
      <span id={`${id}-v`} className="inspect-select__value">{current ? current.value : value || placeholder}</span>
      <Icon name="chevron" size={16} className="inspect-select__chevron" />
    </button>
    {open && <ul className="inspect-options" role="listbox" aria-labelledby={`${id}-l`}>
      {options.map((o) => <li key={o.value} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined}
        className={`inspect-option${o.value === value ? " is-selected" : ""}${o.disabled ? " is-disabled" : ""}`}
        onClick={() => { if (o.disabled) return; onChange(o.value); setOpen(false); }}>
        <span>{o.value}</span>{o.value === value && <Icon name="check" size={16} />}
      </li>)}
    </ul>}
  </div>;
}

export function ReturnInspectionPage({ query }) {
  const { ops, run, source, saving, needsRefresh } = useOps(), r = ops.returns.find((x) => x.id === query.get("id"));
  const [form, setForm] = useState(DEFAULT_FORM), [files, setFiles] = useState([]), [reading, setReading] = useState(false), [error, setError] = useState("");
  if (!r) return <main className="container page"><Empty title="Không tìm thấy lịch trả kho" text="Chọn đúng hồ sơ trong danh sách."><LinkButton to="staff/return">Danh sách trả kho</LinkButton></Empty></main>;
  const submitted = r.status === "SUBMITTED";
  const moveOutPhotos = r.move_out_photos || r.moveOutPhotos || [];
  const flags = inspectionFlags(form);
  // D27/D32: khách gửi trả trước ngày hết hạn → giữ 30% cọc thay cho phí vệ sinh cố định (RefundPolicy BE)
  const contract = ops.contracts.find((c) => c.id === r.contract);
  const moveOut = r.requested_at ? new Date(new Date(r.requested_at).getTime() + 7 * 3600000).toISOString().slice(0, 10) : null;
  const early = isEarlyStop(contract?.end, moveOut), keep = early ? earlyStopKeep(r.deposit) : 0;
  const keepLabel = `${keep.toLocaleString("vi-VN")} đ`;
  // D38: "Sẵn sàng cho thuê lại" chỉ khi đạt ≥ 2/3 tiêu chuẩn và không có khấu trừ (D32: ô cần vệ sinh/sửa giữ bảo trì)
  const charged = form.cleaning_required || (flags.damaged && Number(form.damage_fee) > 0);
  const canReady = flags.clean >= 2 && !charged;
  const proposal = form.proposal === READY && !canReady ? PROPOSALS[0] : form.proposal;
  const report = submitted ? r.report || {} : buildInspectionReport({ ...form, proposal }, r.deposit);
  const blocked = saving || needsRefresh || reading || r.status !== "SCHEDULED", supported = source !== "api" || ops.inspection_evidence_supported === true;
  const change = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setError(""); };
  // Chọn tình trạng: chưa đạt vệ sinh/còn đồ tự tick phí vệ sinh; trạng thái ô theo mức nặng nhất (người dùng vẫn đổi được)
  const pick = (key, value) => { setForm((f) => { const next = { ...f, [key]: value }; const fl = inspectionFlags(next); return { ...next, cleaning_required: fl.dirty, proposal: fl.proposal }; }); setError(""); };
  const allOk = () => { setForm((f) => ({ ...f, ...ALL_OK })); setError(""); };
  const proposalOptions = PROPOSALS.map((p) => ({ value: p, disabled: p === READY && !canReady }));
  const draftKey = `safespace.inspection-draft:${ops.facility?.facility_id}:${r.id}`;
  const submit = async (e) => {
    e.preventDefault(); if (blocked || !supported) return;
    if (!chosen(form)) { setError("Chọn đủ 3 mục Đồ còn lại, Tường, sàn và cửa, Chìa khóa vật lý trước khi gửi."); return; }
    if (proposal === READY && !canReady) { setError("Kho đạt dưới 2/3 tiêu chuẩn hoặc có khấu trừ, chưa được chọn \"Sẵn sàng cho thuê lại\"."); return; }
    try {
      validateInspection(r, report, files);
      const result = await run("SUBMIT_RETURN", { id: r.id, report, files }, "Đã gửi biên bản cho quản lý");
      if (!result.ok) setError(result.shown || result.cancelled ? "" : result.error); else localStorage.removeItem(draftKey);
    } catch (err) { setError(err.message); }
  };
  const saveDraft = () => { try { localStorage.setItem(draftKey, JSON.stringify(form)); setError("Đã lưu nháp nội dung trên thiết bị này; ảnh cần chọn lại nếu tải trang."); } catch { setError("Không lưu được nháp trên thiết bị này."); } };
  const openDraft = () => { try { const d = JSON.parse(localStorage.getItem(draftKey)); if (d && ["items", "walls", "keys"].every((k) => typeof d[k] === "string")) setForm({ ...DEFAULT_FORM, ...d }); else setError("Chưa có nháp hợp lệ."); } catch { setError("Không đọc được nháp."); } };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Nhân viên / Kiểm tra trả kho</p>
    <PageHeader title={`Kiểm tra trả kho ${r.unit}`} description={`${r.customer} · Khách gửi trả kho: ${timeLabel(r.requested_at)}. Phí quá hạn dừng tại thời điểm gửi thành công.`}><Tag tone="amber">{submitted ? "Đã gửi biên bản" : "Chờ kiểm tra"}</Tag></PageHeader>
    <OpsDemo source={source} />
    <div className="customer-detail__grid">
      <form className="panel customer-detail__card inspect-form" onSubmit={submit} noValidate>
        <div className="inspect-form__head"><h2>Biên bản kiểm tra</h2>{!submitted && <Button variant="soft" icon="check" disabled={blocked} onClick={allOk}>Tất cả đạt tiêu chuẩn</Button>}</div>
        {CHECKS.map((c) => submitted
          ? <Field key={c.key} label={c.label}><input value={report[c.key] || "Chưa có dữ liệu"} disabled readOnly /></Field>
          : <ChoiceSelect key={c.key} label={c.label} value={form[c.key]} options={c.options} disabled={blocked} onChange={(v) => pick(c.key, v)} />)}
        <label className="customer-detail__choice inspect-cleaning">
          <input type="checkbox" checked={Boolean(report.cleaning_required)} disabled={blocked} onChange={(e) => { const on = e.target.checked; setForm((f) => ({ ...f, cleaning_required: on, proposal: on && (!f.proposal || f.proposal === READY) ? PROPOSALS[0] : f.proposal })); setError(""); }} />
          <span><strong>Chưa đạt tiêu chuẩn vệ sinh · khấu trừ cố định 10% cọc</strong><small>{early ? `Trả trước hạn đã giữ 30% cọc (${keepLabel}) nên không cộng thêm phí vệ sinh; vẫn tick để ghi nhận cần vệ sinh.` : "Tự tick khi có mục chưa đạt tiêu chuẩn vệ sinh; bỏ tick nếu không tính phí."}</small></span>
        </label>
        {submitted
          ? <Field label="Trạng thái ô sau kiểm tra"><input value={report.proposal || "Chưa có dữ liệu"} disabled readOnly /></Field>
          : <ChoiceSelect label="Trạng thái ô sau kiểm tra" value={proposal} placeholder="Tự đề xuất sau khi chọn 3 mục" options={proposalOptions} disabled={blocked} onChange={(v) => change("proposal", v)}
              extra={chosen(form) && <span className={`inspect-clean inspect-clean--${flags.clean >= 2 ? "ok" : "bad"}`}>Đạt chuẩn {flags.clean}/3</span>} />}
        {!submitted && chosen(form) && !canReady && <p className="inspect-rule">{flags.clean < 2 ? `Đạt ${flags.clean}/3 tiêu chuẩn · cần đạt ít nhất 2/3` : "Có khấu trừ vệ sinh/hư hỏng"} nên chưa được chọn "Sẵn sàng cho thuê lại".</p>}
        {submitted ? <>
          <DamagePhotos photos={report.photos} />
          {Array.isArray(report.photo_files) && report.photo_files.length > 0 && <p className="hint">Tệp đã gửi (mô phỏng chỉ lưu tên): {report.photo_files.map((f) => f.fileName).join(", ")}</p>}
          {report.fee_reason && <p className="hint">Lý do / ghi chú: {report.fee_reason}</p>}
        </> : <>
          <ReturnPhotoInput files={files} onChange={setFiles} onReading={setReading} disabled={blocked} required={flags.damaged && Number(form.damage_fee) > 0} label="Tải ảnh hiện trạng / hư hỏng" />
          {flags.damaged && <Field label="Mức khấu trừ hư hỏng (đ)" hint={`Hạng mục: ${flags.damageItem}. Có khấu trừ thì cần ít nhất 1 ảnh.`}>
            <input inputMode="numeric" value={form.damage_fee} disabled={blocked} onChange={(e) => change("damage_fee", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>}
          <Field label="Ghi chú thêm (không bắt buộc)">
            <textarea rows={2} maxLength={300} placeholder="VD: khách xác nhận bỏ lại 1 thùng carton" value={form.note} disabled={blocked} onChange={(e) => change("note", e.target.value)} />
          </Field>
        </>}
        {!supported && <Notice>Máy chủ chưa hỗ trợ lưu đủ ảnh và phí kiểm kê; chưa thể gửi biên bản.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {submitted ? <Notice>Đã gửi lúc {timeLabel(r.submitted_at)}. Chờ quản lý duyệt đối soát.</Notice> : <div className="customer-detail__actions">
          <Button variant="outline" disabled={blocked} onClick={saveDraft}>Lưu nháp</Button>
          <Button variant="outline" disabled={blocked} onClick={openDraft}>Mở nháp</Button>
          <Button type="submit" disabled={blocked || !supported}>Gửi biên bản cho quản lý</Button>
        </div>}
      </form>
      <div className="customer-detail__column">
        <section className="panel customer-detail__card customer-detail__sidebar" aria-label="Ảnh kho trống do khách gửi">
          <h2>Ảnh kho trống do khách gửi</h2>
          <DamagePhotos photos={moveOutPhotos} emptyText="Khách hàng chưa đính kèm ảnh kho trống khi yêu cầu trả kho." />
          <p className="hint">Ảnh do khách chụp và gửi khi đăng ký trả kho để chứng minh kho đã dọn trống.</p>
        </section>
        <SettlementSummary deposit={r.deposit} damage={report.damage_fee} cleaning={early ? 0 : submitted ? report.cleaning_fee : cleaningFee(r.deposit, form.cleaning_required)} overdue={r.overdue_fee} keep={early ? keep : undefined} />
      </div>
    </div>
    <div className="workflow-links"><LinkButton to="staff/return" variant="outline">Danh sách trả kho</LinkButton></div>
  </main>;
}
