import React, { useState } from "react";
import { Button, DetailList, Field, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { money } from "../../../shared/utils/format.js";
import { vnDate, vnStamp } from "../../../shared/utils/vnTime.js";
import { RecordCard, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";
import { oldUnitDeduction } from "./oldUnitInspectionModel.js";

import "../../../shared/styles/customer-detail.css";

// D46 / D46b · Figma S04-ô cũ + S04-ô cũ-chi tiết: kiểm tra ô cũ sau khi khách gia hạn sang ô khác.
// Như biên bản trả kho (D38) nhưng không hoàn cọc; khấu trừ vào cọc đang giữ, tối đa bằng cọc, không bắt khách bù.
const GOODS = { CLEAR: "Đạt · không còn đồ", LEFT: "Chưa đạt · còn đồ" };
const WALLS = { OK: "Đạt tiêu chuẩn", DIRTY: "Chưa đạt tiêu chuẩn vệ sinh", DAMAGED: "Hư hỏng (trầy, móp, thủng…)" };
const KEYS = { OK: "Đã nhận đủ chìa", NONE: "Không có chìa vật lý", MISSING: "Thiếu chìa" };
const blank = { goods: "CLEAR", walls: "OK", keys: "OK", cleaning: false, damage: "", note: "" };

function Select({ label, value, options, onChange, disabled }) {
  return <Field label={label}><select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>;
}

export function OldUnitInspectionPage() {
  const load = useOpsEndpoint("/api/ops/unit-moves");
  const items = Array.isArray(load.data) ? load.data : [];
  const [openId, setOpenId] = useState(null), [form, setForm] = useState(blank);
  const [confirm, setConfirm] = useState(false), [result, setResult] = useState(null), [error, setError] = useState("");
  const item = items.find(x => x.renewalId === openId) || null;
  const calc = item ? oldUnitDeduction(item, form) : null;
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError(""); };
  const open = id => { setOpenId(id); setForm(blank); setError(""); };
  const submit = e => {
    e.preventDefault();
    if (form.goods === "LEFT") return setResult({ kind: "goods" });
    if (calc.invalidDamage) return setError("Nhập mức khấu trừ hư hỏng là số tiền VND không âm.");
    setConfirm(true);
  };
  const send = async () => {
    const note = [`Đồ còn lại: ${GOODS[form.goods]}`, `Tường, sàn và cửa: ${WALLS[form.walls]}`, `Chìa khóa: ${KEYS[form.keys]}`, form.note.trim()].filter(Boolean).join(" · ");
    const res = await load.post(`/api/ops/unit-moves/${encodeURIComponent(item.renewalId)}/inspection`,
      { goodsRemaining: false, cleaningRequired: calc.cleaningRequired, damageFee: calc.damage, note });
    setConfirm(false);
    setResult(res.ok ? { kind: "ok", unit: item.fromUnit, deduction: res.result?.deduction ?? calc.total } : { kind: "fail", message: res.error });
    if (res.ok) setOpenId(null);
  };
  return <main className="container page workflow-page">
    <PageHeader title="Kiểm tra ô cũ sau gia hạn sang ô khác" description="Khách đã chuyển sang ô mới. Kiểm tra ô cũ như trả kho nhưng không hoàn cọc; khoản khấu trừ trừ vào cọc đang giữ.">
      {items.length > 0 && <Tag tone="amber">{items.length} ô cần kiểm tra</Tag>}</PageHeader>
    <WorkflowState load={load}>
      {items.map(x => <RecordCard key={x.renewalId} title={`GH-${String(x.renewalId).padStart(4, "0")} · ${x.customerName}`}
        subtitle={`Ô cũ ${x.fromUnit} → ô mới ${x.toUnit} · HĐ ${x.contractId}`} status={x.autoMoved ? "Hệ thống tự chuyển" : "Chờ kiểm tra ô cũ"}
        actions={<Button variant={openId === x.renewalId ? "outline" : undefined} onClick={() => openId === x.renewalId ? setOpenId(null) : open(x.renewalId)}>{openId === x.renewalId ? "Thu gọn" : "Kiểm tra ô cũ"}</Button>}>
        <p className="muted">{x.autoMoved ? `Hệ thống tự chuyển ${vnStamp(x.movedAt)} · khách chưa báo · ô cũ tính quá hạn từ ngày sau ${vnDate(x.oldEndDate)}` : `Khách báo đã chuyển đồ ${vnStamp(x.movedAt)}`} · cọc đang giữ {money(x.depositHeld)}</p>
        {openId === x.renewalId && calc && <div className="customer-detail__grid">
          <form className="panel customer-detail__card" onSubmit={submit} noValidate>
            <h2>Biên bản kiểm tra ô {x.fromUnit}</h2>
            <Select label="Đồ còn lại" value={form.goods} options={GOODS} onChange={v => set({ goods: v })} disabled={load.busy} />
            <Select label="Tường, sàn và cửa" value={form.walls} options={WALLS} onChange={v => set({ walls: v, cleaning: v === "DIRTY" ? true : form.cleaning })} disabled={load.busy} />
            <Select label="Chìa khóa vật lý" value={form.keys} options={KEYS} onChange={v => set({ keys: v })} disabled={load.busy} />
            <label className="customer-detail__choice"><input type="checkbox" checked={form.cleaning} disabled={load.busy} onChange={e => set({ cleaning: e.target.checked })} /><span>Chưa đạt tiêu chuẩn vệ sinh · khấu trừ cố định 10% cọc ({money(calc.cleaningFee)})</span></label>
            {form.walls === "DAMAGED" && <Field label="Mức khấu trừ hư hỏng (đ)"><input inputMode="numeric" value={form.damage} disabled={load.busy} onChange={e => set({ damage: e.target.value.replace(/[^\d]/g, "") })} /></Field>}
            <Field label="Ghi chú thêm (không bắt buộc)"><textarea rows={2} maxLength={500} value={form.note} disabled={load.busy} onChange={e => set({ note: e.target.value })} /></Field>
            <p className="hint">Trạng thái ô sau kiểm tra: {calc.cleaningRequired || calc.damage > 0 ? "cần bảo trì trước khi cho thuê lại" : "sẵn sàng cho thuê lại (hoặc giữ cho khách đã đặt)"}.</p>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="customer-detail__actions"><Button type="button" variant="outline" disabled={load.busy} onClick={() => setResult({ kind: "goods" })}>Báo ô còn đồ</Button><Button type="submit" disabled={load.busy}>Ghi kết quả kiểm tra</Button></div>
          </form>
          <aside className="panel customer-detail__card customer-detail__sidebar">
            <h2>Đối chiếu khấu trừ từ cọc</h2>
            <DetailList items={[["Cọc đang giữ", money(x.depositHeld)], [calc.overdueDays > 0 ? `Quá hạn ${calc.overdueDays} ngày · 5%/ngày (dự kiến)` : "Quá hạn · không tính", calc.overdue ? `− ${money(calc.overdue)}` : "0 đ"],
              ["Chưa đạt tiêu chuẩn vệ sinh · 10% cọc", calc.cleaning ? `− ${money(calc.cleaning)}` : "0 đ"], ["Hư hỏng có bằng chứng", calc.damageTaken ? `− ${money(calc.damageTaken)}` : "0 đ"], ["Tổng khấu trừ", money(calc.total)]]} />
            <div className="summary-total"><span>Cọc còn giữ cho ô mới</span><strong>{money(calc.left)}</strong></div>
            <p className="hint">Không hoàn cọc lúc này. Khấu trừ tối đa bằng cọc đang giữ, không bắt khách bù cọc. Số tiền chính thức do máy chủ chốt.</p>
          </aside>
        </div>}
      </RecordCard>)}
      {!items.length && <WorkflowEmpty title="Không có ô cũ cần kiểm tra" text="Khi khách gia hạn sang ô khác và chuyển đồ xong, ô cũ cần kiểm tra sẽ hiện ở đây." />}
    </WorkflowState>
    {confirm && item && <ConfirmDialog title={`Ghi kết quả kiểm tra ô ${item.fromUnit}?`} busy={load.busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Ghi kết quả"
      text={`Khấu trừ vào cọc đang giữ, không hoàn cọc.${calc.cleaningRequired || calc.damage > 0 ? " Ô cũ chuyển sang bảo trì." : ""}`}
      rows={[["Tổng khấu trừ (dự kiến)", money(calc.total)], ["Cọc còn giữ cho ô mới", money(calc.left)], ["Trạng thái ô " + item.fromUnit, calc.cleaningRequired || calc.damage > 0 ? "Bảo trì" : "Trống / giữ cho khách đã đặt"]]}
      hint="Kiểm tra kỹ hạng mục trước khi ghi; không sửa được sau khi lưu." />}
    {result?.kind === "ok" && <ConfirmDialog title={`Đã ghi kết quả kiểm tra ô ${result.unit}`} tone="success" cancelLabel={null} hint="" label="Về danh sách"
      text={`Đã trừ ${money(result.deduction)} vào cọc. Khách xem khoản khấu trừ trong chi tiết hợp đồng.`} onCancel={() => setResult(null)} onConfirm={() => setResult(null)} />}
    {result?.kind === "goods" && <ConfirmDialog title="Ô cũ còn đồ · chưa ghi được" tone="warning" cancelLabel={null} hint="" label="Về danh sách"
      text="Liên hệ khách chuyển hết đồ khỏi ô cũ rồi kiểm tra lại. Khách không báo chuyển kịp thì phí quá hạn 5% cọc/ngày tính đến ngày kiểm tra đạt." onCancel={() => setResult(null)} onConfirm={() => { setResult(null); setOpenId(null); }} />}
    {result?.kind === "fail" && <ConfirmDialog title="Chưa ghi được kết quả kiểm tra" tone="failure" hint="" label="Thử lại"
      text={`${result.message || "Kết nối bị gián đoạn."} Hạng mục và ghi chú bạn đã nhập vẫn được giữ.`} onCancel={() => setResult(null)} onConfirm={() => { setResult(null); setConfirm(true); }} />}
  </main>;
}
