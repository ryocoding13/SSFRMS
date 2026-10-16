import React, { useState } from "react";
import { businessApi } from "../api/business";
import { Button, Field, Modal, Notice } from "../components/UI";
import { useLoad } from "../admin/util";
import { go, href, qs } from "../lib/router";
import { useApp } from "../state/store";
import { FACILITY_STATUS, areaOf, rateLabel, shortFacility } from "./format";
import { LoadState } from "./parts";
import { coordinateLabel, facilityToForm, formToRequest, splitCoordinates } from "./facility-form";

// B05a · Sửa thông tin cơ sở (tên, địa chỉ, điện thoại, giờ ra vào, toạ độ ghim bản đồ)
function EditFacilityDialog({ facility, onClose, onSaved }) {
  const { notify } = useApp();
  const [form, setForm] = useState(() => facilityToForm(facility));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors({});
  };
  // Dán cả cặp "10.6935, 106.7222" vào ô vĩ độ / kinh độ thì tự tách ra hai ô
  const pasteCoords = (e) => {
    const pair = splitCoordinates(e.clipboardData?.getData("text"));
    if (!pair) return;
    e.preventDefault();
    setForm((f) => ({ ...f, ...pair }));
    setErrors({});
  };
  const save = async (e) => {
    e.preventDefault();
    const { errors: errs, body } = formToRequest(form);
    if (errs) return setErrors(errs);
    setBusy(true);
    try {
      const res = await businessApi.updateFacility(facility.facilityId, body);
      const warnings = res?.warnings || [];
      notify(warnings.length ? `Đã lưu thông tin cơ sở. ${warnings.join(" ")}` : "Đã lưu thông tin cơ sở.");
      onSaved();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Sửa thông tin cơ sở" size="md" onClose={onClose}>
      <form className="biz-form" onSubmit={save} noValidate>
        <p className="muted">{facility.name}</p>
        <Field label="Tên cơ sở" error={errors.name}>
          <input value={form.name} maxLength={150} onChange={set("name")} />
        </Field>
        <Field label="Địa chỉ" error={errors.address}>
          <input value={form.address} maxLength={255} onChange={set("address")} />
        </Field>
        <Field label="Số điện thoại">
          <input value={form.contactPhone} inputMode="tel" onChange={set("contactPhone")} />
        </Field>
        <div className="biz-form__pair">
          <Field label="Giờ mở cửa"><input type="time" value={form.openingTime} onChange={set("openingTime")} /></Field>
          <Field label="Giờ đóng cửa"><input type="time" value={form.closingTime} onChange={set("closingTime")} /></Field>
        </div>
        {errors.hours && <p className="field__error" role="alert">{errors.hours}</p>}
        <div className="biz-form__pair">
          <Field label="Vĩ độ"><input value={form.latitude} inputMode="decimal" placeholder="10.693500" onChange={set("latitude")} onPaste={pasteCoords} /></Field>
          <Field label="Kinh độ"><input value={form.longitude} inputMode="decimal" placeholder="106.722200" onChange={set("longitude")} onPaste={pasteCoords} /></Field>
        </div>
        {errors.coords && <p className="field__error" role="alert">{errors.coords}</p>}
        <p className="hint">
          Lấy toạ độ: mở Google Maps, nhấp chuột phải vào đúng vị trí cơ sở, bấm dòng số đầu tiên để sao chép rồi dán vào ô Vĩ độ.
          Toạ độ dùng để đặt ghim trên bản đồ Tìm kho và nút Chỉ đường.
        </p>
        <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Mở Google Maps ↗</a>
        {errors.form && <Notice tone="error">{errors.form}</Notice>}
        <div className="modal__actions">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// B05: select a facility and open its business report; no unrelated CRUD controls.
export default function BusinessFacilities({ query }) {
  const { onApiError } = useApp();
  const load = useLoad(async () => {
    const [facilities, rates] = await Promise.all([businessApi.facilities(), businessApi.rates()]);
    return { facilities, rates };
  }, [], onApiError);
  const selectedId = Number(query.get("id"));
  const [editing, setEditing] = useState(null);
  return <main className="container page business-facilities">
    <header className="page-header page-header--tight"><div>
      <h1>Mạng lưới cơ sở</h1>
      <p>Theo dõi trạng thái hoạt động, sức chứa và người phụ trách toàn hệ thống.</p>
    </div></header>
    <LoadState load={load}>{({ facilities, rates }) => {
      const current = facilities.find(f => f.facilityId === selectedId) || facilities[0];
      const typeNames = [...new Set(rates.filter(r => r.facilityId === current?.facilityId && r.isCurrent).map(r => r.unitTypeName).filter(Boolean))];
      return <>
        <div className="table-wrap"><table className="table table--hover">
          <colgroup><col style={{ width: '35.7%' }}/><col style={{ width: '21.4%' }}/><col style={{ width: '25.4%' }}/><col/></colgroup>
          <thead><tr><th>Cơ sở</th><th>Quản lý</th><th>Số kho / tỷ lệ thuê</th><th>Trạng thái</th></tr></thead>
          <tbody>{facilities.map(f => <tr key={f.facilityId} onClick={() => go(`business/facilities${qs({ id: f.facilityId })}`, { replace: true })}>
            <td><a className="biz-link" href={href(`business/facilities${qs({ id: f.facilityId })}`)} aria-current={current?.facilityId === f.facilityId ? 'true' : undefined}>{[areaOf(f.address).district, shortFacility(f.name)].filter(Boolean).join(' · ')}</a></td>
            <td>{f.managerName || ('managerName' in f ? 'Chưa phân công' : 'Chưa có thông tin')}</td><td>{f.totalUnits} kho · {rateLabel(f.occupancyRate)}</td><td>{FACILITY_STATUS[f.status]?.[0] || f.status}</td>
          </tr>)}{!facilities.length && <tr><td colSpan={4}>Chưa có cơ sở nào.</td></tr>}</tbody>
        </table></div>
        {current && <section className="panel biz-detail" aria-label={`Chi tiết ${current.name}`}>
          <h2>{current.name}</h2>
          <div className="muted"><p>{[areaOf(current.address).district, areaOf(current.address).city].filter(Boolean).join(', ')}{current.openingTime && ` · Giờ ra vào ${current.openingTime}–${current.closingTime}`}</p>
          <p>{typeNames.length ? `${typeNames.join(' & ')} · ` : ''}Quản lý: {current.managerName || ('managerName' in current ? 'Chưa phân công' : 'Chưa có thông tin')}</p>
          <p>Vị trí bản đồ: {coordinateLabel(current)}</p></div>
          <div className="ops-actions">
            <Button onClick={() => go(`business/reports${qs({ facility: current.facilityId })}`)}>Xem hiệu quả kinh doanh</Button>
            <Button variant="outline" onClick={() => setEditing(current)}>Sửa thông tin cơ sở</Button>
          </div>
        </section>}
        {editing && <EditFacilityDialog facility={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load.reload(); }} />}
      </>;
    }}</LoadState>
  </main>;
}
