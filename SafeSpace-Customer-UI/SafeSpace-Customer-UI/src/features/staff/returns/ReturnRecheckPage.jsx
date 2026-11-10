/**
 * RETURN RECHECK PAGE - KIỂM TRA LẠI SAU KHI KHÁCH TỰ DỌN / TỰ SỬA (D39 / D40)
 *
 * Nghiệp vụ D39:
 * - Khi có khoản khấu trừ, khách hàng có quyền chọn tự quay lại dọn dẹp (SELF_CLEAN)
 *   hoặc tự khắc phục/thay thế tài sản (SELF_REPLACE) trong vòng 48 giờ.
 * - Nhân viên kiểm tra lại thực tế: Nếu đạt yêu cầu -> Hủy bỏ khoản khấu trừ tương ứng.
 */
import React, { useState } from "react";
import { Button, Field, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { money } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { RecordCard, WorkflowEmpty } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";

import "../../../shared/styles/customer-detail.css";

const CHOICE = { SELF_CLEAN: "Khách tự dọn dẹp kho thay cho phí vệ sinh", SELF_REPLACE: "Khách tự thay vật dụng tương đương thay cho phí hư hỏng", DISPUTE: "Khách khiếu nại nội dung biên bản" };

// D39/D40 · Cơ sở kiểm tra lại phương án khách chọn; đạt thì không trừ khoản tương ứng. Không được từ chối tự dọn.
/**
 * Màn hình nhân viên nghiệm thu lại ô kho sau khi khách hàng tự khắc phục tồn đọng.
 */
export function ReturnRecheckPage() {
  const { ops, reload, source } = useOps();
  const api = useOpsEndpoint(null);
  const [form, setForm] = useState(null), [error, setError] = useState("");
  const items = ops.returns.filter(r => CHOICE[r.deduction_status]);
  const save = async () => {
    if (!form.note.trim()) return setError("Ghi kết quả kiểm tra lại.");
    const res = await api.post(`/api/ops/returns/${encodeURIComponent(form.item.id)}/recheck`,
      { cleaningPassed: form.cleaningPassed, replacementPassed: form.replacementPassed, note: form.note.trim() });
    if (!res.ok) return setError(res.error);
    setForm(null); setError(""); await reload?.();
  };
  return <main className="container page workflow-page">
    <PageHeader title="Kiểm tra lại sau trả kho" description="Khách đã chọn tự dọn, tự thay hoặc khiếu nại. Kiểm tra lại tại kho; đạt thì không trừ khoản tương ứng vào cọc." />
    {source !== "api" && <Notice>Chế độ mô phỏng chưa có phản hồi khấu trừ thật của khách.</Notice>}
    {items.map(r => <RecordCard key={r.id} title={`${r.id} · ${r.customer}`} subtitle={`Kho ${r.unit} · ${r.contract}`} status="Chờ kiểm tra lại"
      actions={<Button disabled={api.busy} onClick={() => setForm({ item: r, cleaningPassed: false, replacementPassed: false, note: "" })}>Ghi kết quả</Button>}>
      <p>{CHOICE[r.deduction_status]}</p><p className="muted">Cọc {money(r.deposit)}{r.deduction_photos?.length ? ` · khách gửi ${r.deduction_photos.length} ảnh` : ""}</p>
      {r.deduction_photos?.length > 0 && <ul className="deduction-photos">{r.deduction_photos.filter(p => /^(https?:)?\//.test(p.url || "")).map((p, i) => <li key={i}><a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`Ảnh khách gửi ${i + 1}`} loading="lazy" /></a></li>)}</ul>}
    </RecordCard>)}
    {!items.length && <WorkflowEmpty title="Không có kho cần kiểm tra lại" text="Khi khách chọn tự dọn, tự thay hoặc khiếu nại, hồ sơ sẽ hiện ở đây." />}
    {form && <Modal title={`Kiểm tra lại · ${form.item.id}`} onClose={() => { setForm(null); setError(""); }}>
      <p className="modal__text">{CHOICE[form.item.deduction_status]}</p>
      <fieldset className="choice-list">
        {form.item.deduction_status !== "SELF_REPLACE" && <label className="choice-list__item"><input type="checkbox" checked={form.cleaningPassed} onChange={e => setForm({ ...form, cleaningPassed: e.target.checked })} /><span>Kho đã đạt tiêu chuẩn vệ sinh · không trừ phí vệ sinh</span></label>}
        {form.item.deduction_status !== "SELF_CLEAN" && <label className="choice-list__item"><input type="checkbox" checked={form.replacementPassed} onChange={e => setForm({ ...form, replacementPassed: e.target.checked })} /><span>Vật dụng đã thay tương đương · không trừ phí hư hỏng</span></label>}
      </fieldset>
      <Field label="Kết quả kiểm tra lại *"><textarea rows={3} maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
      <p className="hint">Không tick là chưa đạt: khoản đó vẫn trừ theo biên bản. Sau khi lưu, quản lý chốt hoàn cọc.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal__actions"><Button variant="outline" onClick={() => { setForm(null); setError(""); }}>Quay lại</Button><Button disabled={api.busy} onClick={save}>Lưu kết quả</Button></div>
    </Modal>}
  </main>;
}
