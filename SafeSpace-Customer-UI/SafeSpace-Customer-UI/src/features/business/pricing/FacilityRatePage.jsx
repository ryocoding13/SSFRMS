import React, { useEffect, useRef, useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { Button, Empty, Field, LinkButton, Modal, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { money, today } from "../../../shared/utils/format.js";
import { LoadState } from "../components/BusinessComponents.jsx";
import { parseMoney, rateError, shortFacility } from "../utils/businessFormat.js";
import { currentRate, RATE_SLOTS, rateTypeFor } from "./facilityRates.js";
import "./pricing.css";

// B03a · Bốn loại kho của cơ sở đã chọn. Form giữ lại khi huỷ/lỗi.
export function FacilityRatePage({ query }) {
  const facilityId = query?.get("facility") || "";
  const { onApiError } = useApp();
  const [edit, setEdit] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), guard = useRef(false);
  const [flow, runChange] = useChangeFlow();
  useEffect(() => { setEdit(null); setError(""); }, [facilityId]);
  const load = useLoad(async () => {
    if (!facilityId) return { facility: null, rates: [], types: [] };
    const [rates, facilities, types] = await Promise.all([businessApi.rates({ facilityId }), businessApi.facilities(), businessApi.unitTypes()]);
    return { rates, types, facility: facilities.find(f => String(f.facilityId) === facilityId) || null };
  }, [facilityId], onApiError);
  const save = async (e, facility) => {
    e.preventDefault();
    if (guard.current) return;
    const invalid = rateError(edit.monthlyRate);
    if (invalid || !/^\d{4}-\d{2}-\d{2}$/.test(edit.effectiveFrom) || edit.effectiveFrom < today()) return setError(invalid || "Chọn ngày áp dụng từ hôm nay.");
    const draft = { ...edit };
    guard.current = true; setBusy(true); setError(""); setEdit(null);
    try {
      const out = await runChange({ action: "Lưu giá thuê", scope: `${facility.name} · ${draft.type.typeName}`, content: `${money(parseMoney(draft.monthlyRate))} / tháng · từ ${draft.effectiveFrom}`,
        perform: async () => { await businessApi.setRate({ facilityId: Number(facilityId), unitTypeId: draft.type.unitTypeId, monthlyRate: parseMoney(draft.monthlyRate), effectiveFrom: draft.effectiveFrom }); return true; } });
      if (out.ok) await load.reload();
      else { setEdit(draft); if (out.error) { setError(out.error.message); onApiError(out.error); } }
    } finally { guard.current = false; setBusy(false); }
  };
  return <main className="container page facility-pricing">
    <LoadState load={load}>{({ facility, rates, types }) => !facility ? <Empty title={facilityId ? "Không tìm thấy cơ sở" : "Chọn cơ sở để xem bảng giá"} text="Mỗi cơ sở có mức giá thuê riêng."><LinkButton to="business/pricing">Chọn cơ sở</LinkButton></Empty> : <>
      <p className="facility-pricing__breadcrumb">SafeSpace / Vận hành kinh doanh / Giá &amp; phí / {shortFacility(facility.name)}</p>
      <PageHeader title="Bảng giá thuê" description={`${facility.name} · Giá thuê theo tháng cho 4 loại kho.`}><LinkButton to="business/pricing" variant="outline">Đổi cơ sở</LinkButton></PageHeader>
      <div className="facility-pricing__rates">{RATE_SLOTS.map(slot => {
        const type = rateTypeFor(types, slot), rate = type && currentRate(rates, facilityId, type.unitTypeId, today());
        return <article className="panel facility-pricing__rate" key={slot.file}>
          <img className="facility-pricing__unit-image" src={`${import.meta.env.BASE_URL}images/pricing/${slot.file}`} alt={`${slot.title} ${slot.cold ? "lạnh" : "thường"} ${slot.area} m²`} width="180" height="228" />
          <div className="facility-pricing__rate-content"><Tag tone="blue">{slot.cold ? "Kho lạnh" : "Kho thường"}</Tag><h2>{slot.title}</h2><p className="muted">Diện tích {slot.area} m²</p>
            <strong className="facility-pricing__price">{rate ? money(rate.monthlyRate) : "Chưa có mức giá"}</strong>
            <div className="facility-pricing__rate-bottom"><span className="muted">/ tháng</span><Button variant="outline" disabled={busy || !type} onClick={() => { setError(""); setEdit({ type, monthlyRate: rate ? String(rate.monthlyRate) : "", effectiveFrom: today() }); }}>{rate ? "Sửa giá" : "Thêm giá"}</Button></div>
            {!type && <small className="muted">Chưa có loại kho này trong danh mục.</small>}
          </div>
        </article>;
      })}</div>
      <Notice><strong>Áp dụng đúng mức giá của cơ sở</strong><br />Mức giá mới áp dụng theo ngày đã chọn. Giá trên hợp đồng hiện hữu được giữ nguyên. Chính sách và phí áp dụng xem tại mục Chính sách.</Notice>
      {edit && <Modal title="Sửa giá thuê" onClose={() => !busy && setEdit(null)}><form className="form-card" onSubmit={e => save(e, facility)} noValidate>
        <p>{facility.name} · {edit.type.typeName}</p>
        <Field label="Giá thuê / tháng" error={error}><input inputMode="numeric" autoFocus value={edit.monthlyRate} onChange={e => { setError(""); setEdit({ ...edit, monthlyRate: e.target.value }); }} /></Field>
        <Field label="Ngày áp dụng"><input type="date" min={today()} value={edit.effectiveFrom} onChange={e => setEdit({ ...edit, effectiveFrom: e.target.value })} /></Field>
        <div className="facility-pricing__actions"><Button variant="outline" onClick={() => setEdit(null)}>Quay lại</Button><Button type="submit" disabled={busy}>Kiểm tra &amp; lưu</Button></div>
      </form></Modal>}
    </>}</LoadState>{flow}
  </main>;
}
