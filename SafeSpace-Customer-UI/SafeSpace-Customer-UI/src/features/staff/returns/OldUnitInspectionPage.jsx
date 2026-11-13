/**
 * OLD UNIT INSPECTION PAGE - KIỂM TRA Ô CŨ KHI GIA HẠN CHUYỂN Ô (D46 / D46b)
 *
 * Quy trình chuyển ô khi gia hạn:
 * - Khách chuyển đồ sang ô mới trong 3 ngày cuối kỳ cũ.
 * - Nhân viên kiểm tra hiện trạng ô kho cũ: Khấu trừ vệ sinh 10% cọc và hư hỏng (nếu có).
 * - Nếu khách còn để lại đồ không lấy: Ghi nhận đồ khách bỏ (RENEWAL_OLD_UNIT_GOODS_ABANDONED),
 *   không phạt phí quá hạn (D46b).
 */
import React, { useState } from "react";
import "../../manager/refunds/refund-center.css";
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
// D48: ô cũ còn đồ → ghi nhận đồ khách bỏ (không trừ phí), nhân viên dọn rồi ghi kết quả kiểm tra như bình thường.
const GOODS = { CLEAR: "Đạt · không còn đồ", LEFT: "Còn đồ khách bỏ · cần dọn" };
const WALLS = { OK: "Đạt tiêu chuẩn", DIRTY: "Chưa đạt tiêu chuẩn vệ sinh", DAMAGED: "Hư hỏng (trầy, móp, thủng…)" };
const KEYS = { OK: "Đã nhận đủ chìa", NONE: "Không có chìa vật lý", MISSING: "Thiếu chìa" };
const blank = { goods: "CLEAR", walls: "OK", keys: "OK", cleaning: false, damage: "", note: "" };

function Select({ label, value, options, onChange, disabled }) {
  return <Field label={label}><select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>;
}

/**
 * Màn hình nhân viên nghiệm thu ô kho cũ sau khi khách hoàn tất chuyển sang ô mới.
 */
export function OldUnitInspectionPage({ embedded = false } = {}) {
  const load = useOpsEndpoint("/api/ops/unit-moves");
  const items = Array.isArray(load.data) ? load.data : [];
  const [openId, setOpenId] = useState(null), [form, setForm] = useState(blank);
  const [confirm, setConfirm] = useState(false), [result, setResult] = useState(null), [error, setError] = useState("");
  const [abandon, setAbandon] = useState(null);
  const item = items.find(x => x.renewalId === openId) || null;
  const calc = item ? oldUnitDeduction(item, form) : null;
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError(""); };
  const open = id => { setOpenId(id); setForm(blank); setError(""); };
  const submit = e => {
    e.preventDefault();
    if (form.goods === "LEFT") return setAbandon({ note: form.note.trim() });
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
  const sendAbandoned = async () => {
    const res = await load.post(`/api/ops/unit-moves/${encodeURIComponent(item.renewalId)}/inspection`,
      { goodsRemaining: true, cleaningRequired: false, damageFee: 0, note: abandon.note.trim() || null });
    const unit = item.fromUnit;
    setAbandon(null);
    if (res.ok) { set({ goods: "CLEAR" }); setResult({ kind: "goods", unit }); }
    else setResult({ kind: "goodsFail", message: res.error, note: abandon.note });
  };
  const Wrap = embedded ? "section" : "main";
  // #7: nhúng vào trang Kiểm tra trả kho; trang rỗng thì ẩn hẳn, không thêm khối trống
  // Máy chủ chưa có API ô cũ (404) thì cũng ẩn, không làm rối trang Kiểm tra trả kho
  if (embedded && !load.loading && ((!load.error && !items.length) || load.errorStatus === 404)) return null;
  return <Wrap className={embedded ? "container workflow-page old-unit-embedded" : "container page workflow-page"}>
    {embedded ? <h2 className="section-title">Kiểm tra ô cũ sau gia hạn sang ô khác {items.length > 0 && <Tag tone="amber">{items.length} ô</Tag>}</h2> : <PageHeader title="Kiểm tra ô cũ sau gia hạn sang ô khác" description="Khách đã chuyển sang ô mới. Kiểm tra ô cũ như trả kho nhưng không hoàn cọc; khoản khấu trừ trừ vào cọc đang giữ.">
      {items.length > 0 && <Tag tone="amber">{items.length} ô cần kiểm tra</Tag>}</PageHeader>}
    <WorkflowState load={load}>
      {items.map(x => <RecordCard key={x.renewalId} title={`GH-${String(x.renewalId).padStart(4, "0")} · ${x.customerName}`}
        subtitle={`Ô cũ ${x.fromUnit} → ô mới ${x.toUnit} · HĐ ${x.contractId}`} status={x.goodsAbandoned ? "Đồ khách bỏ · đang dọn" : x.autoMoved ? "Hệ thống tự chuyển" : "Chờ kiểm tra ô cũ"}
        actions={<Button variant={openId === x.renewalId ? "outline" : undefined} onClick={() => openId === x.renewalId ? setOpenId(null) : open(x.renewalId)}>{openId === x.renewalId ? "Thu gọn" : x.goodsAbandoned ? "Tiếp tục kiểm tra" : "Kiểm tra ô cũ"}</Button>}>
        <p className="muted">{x.autoMoved ? `Hệ thống tự chuyển ${vnStamp(x.movedAt)} (hết kỳ cũ ${vnDate(x.oldEndDate)}) · khách chưa báo · đồ còn lại coi là đồ khách bỏ` : `Khách báo đã chuyển đồ ${vnStamp(x.movedAt)}`} · cọc đang giữ {money(x.depositHeld)}{x.goodsAbandoned ? ` · đã ghi nhận đồ khách bỏ${x.goodsNote ? `: ${x.goodsNote}` : ""}` : ""}</p>
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
            <div className="customer-detail__actions">{!x.goodsAbandoned && <Button type="button" variant="outline" disabled={load.busy} onClick={() => setAbandon({ note: form.note.trim() })}>Ghi nhận đồ khách bỏ</Button>}<Button type="submit" disabled={load.busy}>Ghi kết quả kiểm tra</Button></div>
          </form>
          <aside className="panel customer-detail__card customer-detail__sidebar">
            <h2>Đối chiếu khấu trừ từ cọc</h2>
            <DetailList items={[["Cọc đang giữ", money(x.depositHeld)], ["Quá hạn · không tính", "0 đ"],
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
    {abandon && item && <ConfirmDialog title={`Ghi nhận ô ${item.fromUnit} còn đồ khách bỏ?`} busy={load.busy} onCancel={() => setAbandon(null)} onConfirm={sendAbandoned} label="Ghi nhận đồ khách bỏ" hint=""
      text="Khách đã xác nhận chuyển hết đồ. Đồ còn lại coi là đồ khách bỏ: nhân viên dọn, cơ sở không nhận bảo quản, không trừ thêm phí."
      rows={[["Ô cũ → ô mới", `${item.fromUnit} → ${item.toUnit} · HĐ ${item.contractId}`], ["Khách", item.customerName], ["Sau khi ghi nhận", "Dọn đồ rồi hoàn tất kiểm tra ô"]]}>
      <Field label="Đồ còn lại"><input value={abandon.note} maxLength={300} disabled={load.busy} placeholder="Ví dụ: 2 thùng carton ở góc trong" onChange={e => setAbandon(a => ({ ...a, note: e.target.value }))} /></Field>
    </ConfirmDialog>}
    {result?.kind === "goods" && <ConfirmDialog title={`Đã ghi nhận đồ khách bỏ ở ô ${result.unit}`} tone="success" cancelLabel={null} hint="" label="Tiếp tục kiểm tra ô"
      text="Dọn đồ ra khỏi ô rồi ghi kết quả kiểm tra như bình thường. Không trừ phí cho đồ còn lại." onCancel={() => setResult(null)} onConfirm={() => setResult(null)} />}
    {result?.kind === "goodsFail" && <ConfirmDialog title="Chưa ghi được kết quả" tone="failure" hint="" label="Thử lại"
      text={`${result.message || "Kết nối bị gián đoạn."} Ghi chú đồ còn lại vẫn được giữ.`} onCancel={() => setResult(null)} onConfirm={() => { const note = result.note || ""; setResult(null); setAbandon({ note }); }} />}
    {result?.kind === "fail" && <ConfirmDialog title="Chưa ghi được kết quả kiểm tra" tone="failure" hint="" label="Thử lại"
      text={`${result.message || "Kết nối bị gián đoạn."} Hạng mục và ghi chú bạn đã nhập vẫn được giữ.`} onCancel={() => setResult(null)} onConfirm={() => { setResult(null); setConfirm(true); }} />}
  </Wrap>;
}
