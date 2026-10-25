import React, { useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { Button, Field, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { money, today } from "../../../shared/utils/format.js";
import { RecordCard } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { LoadState } from "../components/BusinessComponents.jsx";

export function FacilityRatePage() {
  const { onApiError } = useApp(), [facility, setFacility] = useState(""), [form, setForm] = useState({ unitTypeId: "", monthlyRate: "", effectiveFrom: today() }), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useLoad(async () => { const [rates, facilities, types] = await Promise.all([businessApi.rates({ facilityId: facility }), businessApi.facilities(), businessApi.unitTypes()]); return { rates, facilities, types }; }, [facility], onApiError), [flow, runChange] = useChangeFlow();
  const save = async e => { e.preventDefault(); if (!facility || !form.unitTypeId || !(Number(form.monthlyRate) > 0) || Number(form.monthlyRate) % 1000 || !form.effectiveFrom) return setError("Chọn cơ sở, loại kho, ngày áp dụng và giá dương là bội số 1.000 đ."); setError(""); setBusy(true); try { const out = await runChange({ action: "Lưu giá thuê theo cơ sở", scope: "Cơ sở đang chọn", content: `${money(form.monthlyRate)} / tháng · từ ${form.effectiveFrom}`, perform: async () => { await businessApi.setRate({ facilityId: Number(facility), ...form, unitTypeId: Number(form.unitTypeId), monthlyRate: Number(form.monthlyRate) }); return true; } }); if (out.error) onApiError(out.error); else load.reload(); } finally { setBusy(false); } };
  return <main className="container page workflow-page"><PageHeader title="Giá thuê theo cơ sở" description="Thêm hoặc thay mức giá theo ngày áp dụng; không sửa ngược giá trên hợp đồng." /><LoadState load={load}>{d => <><Field label="Cơ sở"><select value={facility} onChange={e => setFacility(e.target.value)}><option value="">Tất cả cơ sở</option>{d.facilities.map(f => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}</select></Field>
    {d.rates.map(r => <RecordCard key={r.rateId} title={r.facilityName || `Cơ sở ${r.facilityId}`} subtitle={`${r.unitTypeName} · từ ${r.effectiveFrom}`} actions={<Button variant="outline" onClick={() => { setFacility(String(r.facilityId)); setForm({ unitTypeId: String(r.unitTypeId), monthlyRate: String(r.monthlyRate), effectiveFrom: today() }); }}>Sửa giá thuê</Button>}><strong className="price">{money(r.monthlyRate)} / tháng</strong></RecordCard>)}{!d.rates.length && <Notice>Chưa có mức giá trong phạm vi này. Chọn cơ sở và thêm mức giá bên dưới.</Notice>}
    <form className="panel form-card" onSubmit={save}><h2>Thêm / cập nhật mức giá</h2><Field label="Loại kho"><select value={form.unitTypeId} onChange={e => setForm({ ...form, unitTypeId: e.target.value })}><option value="">Chọn loại kho</option>{d.types.map(t => <option key={t.unitTypeId} value={t.unitTypeId}>{t.typeName}</option>)}</select></Field><div className="form-row"><Field label="Giá thuê / tháng"><input type="number" min="1000" step="1000" value={form.monthlyRate} onChange={e => setForm({ ...form, monthlyRate: e.target.value })} /></Field><Field label="Ngày áp dụng"><input type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} /></Field></div>{error && <Notice tone="error">{error}</Notice>}<Button type="submit" disabled={busy}>Kiểm tra & lưu mức giá</Button></form>
  </>}</LoadState>{flow}</main>;
}
