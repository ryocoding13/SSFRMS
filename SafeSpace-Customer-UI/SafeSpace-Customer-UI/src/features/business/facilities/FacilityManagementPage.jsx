import React, { useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { Button, Field, Modal, Notice } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { go, href, qs } from "../../../app/router.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { FACILITY_STATUS, areaOf, rateLabel, shortFacility } from "../utils/businessFormat.js";
import { LoadState } from "../components/BusinessComponents.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { coordinateLabel, facilityToForm, formToRequest, splitCoordinates } from "./facilityForm.js";

// B05a · Sửa thông tin cơ sở / B05b · Thêm cơ sở (tên, địa chỉ, điện thoại, giờ ra vào, toạ độ ghim bản đồ)
const EMPTY_FACILITY = { name: "", address: "", contactPhone: "", openingTime: "06:00", closingTime: "22:00", latitude: null, longitude: null };
function EditFacilityDialog({ facility, onClose, onSaved, runChange }) {
  const creating = !facility;
  const [form, setForm] = useState(() => facilityToForm(facility || EMPTY_FACILITY));
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
    // Figma kết quả B05: "Đã thêm cơ sở …" / "Đã lưu thông tin cơ sở"
    setBusy(true);
    let warnings = [];
    const out = await runChange({
      action: creating ? "Thêm cơ sở" : "Lưu thông tin cơ sở", scope: body.name, confirm: false, successAction: "Đã hiểu",
      successTitle: creating ? `Đã thêm cơ sở ${body.name}` : "Đã lưu thông tin cơ sở",
      successText: creating ? "Cơ sở chưa có bảng giá, ô kho và nhân sự nên khách chưa đặt được." : "Bản đồ Tìm kho dùng vị trí mới ngay.",
      perform: async () => {
        const res = creating ? await businessApi.createFacility(body) : await businessApi.updateFacility(facility.facilityId, body);
        warnings = res?.warnings || [];
        return res;
      },
    });
    setBusy(false);
    if (out.ok) onSaved(warnings);
    else if (out.error) setErrors({ form: out.error.message });
  };
  return (
    <Modal title={creating ? "Thêm cơ sở" : "Sửa thông tin cơ sở"} size="md" onClose={onClose}>
      <form className="biz-form" onSubmit={save} noValidate>
        <p className="muted">{creating ? "Cơ sở mới cần có bảng giá, ô kho và nhân sự trước khi khách đặt được." : facility.name}</p>
        <Field label="Tên cơ sở" error={errors.name}>
          <input value={form.name} maxLength={150} placeholder="Ví dụ: SafeSpace Quận 9" onChange={set("name")} />
        </Field>
        <Field label="Địa chỉ" error={errors.address}>
          <input value={form.address} maxLength={255} placeholder="Số nhà, đường, phường, quận, TP. Hồ Chí Minh" onChange={set("address")} />
        </Field>
        <Field label="Số điện thoại">
          <input value={form.contactPhone} inputMode="tel" placeholder="Ví dụ: 028 3700 1030" onChange={set("contactPhone")} />
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
          <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : creating ? "Thêm cơ sở" : "Lưu thay đổi"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// B05c · Đổi trạng thái cơ sở (Figma 634:8894): Tạm đóng / Ngừng hoạt động / Đang hoạt động, lý do bắt buộc
const STATUS_HELP = {
  ACTIVE: "Mở lại nhận đặt chỗ mới tại cơ sở.",
  TEMPORARILY_CLOSED: "Ngừng nhận đặt chỗ mới; khách đang thuê vẫn ra vào bình thường.",
  INACTIVE: "Chỉ chọn được khi không còn hợp đồng hay đơn đặt chỗ đang xử lý.",
};
const STATUS_RESULT = {
  ACTIVE: (name) => `Khách đặt chỗ mới được ở ${name}.`,
  TEMPORARILY_CLOSED: (name) => `Khách không đặt chỗ mới được ở ${name}.`,
  INACTIVE: (name) => `${name} ngừng hoạt động; cơ sở không bị xoá và mở lại được bất cứ lúc nào.`,
};
function FacilityStatusDialog({ facility, onClose, onSaved, runChange }) {
  const options = Object.keys(FACILITY_STATUS).filter((k) => k !== facility.status);
  const [status, setStatus] = useState(options[0]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return setError("Nhập lý do đổi trạng thái.");
    setBusy(true);
    const label = FACILITY_STATUS[status][0];
    const out = await runChange({
      action: "Đổi trạng thái cơ sở", scope: facility.name, confirm: false, successAction: "Đã hiểu",
      successTitle: `Đã chuyển cơ sở sang ${label}`, successText: STATUS_RESULT[status](facility.name),
      perform: () => businessApi.setFacilityStatus(facility.facilityId, status, reason.trim()),
    });
    setBusy(false);
    if (out.ok) onSaved();
    else if (out.error) setError(out.error.message);
  };
  return (
    <Modal title="Đổi trạng thái cơ sở" size="md" onClose={onClose}>
      <p className="modal__text modal__text--sub">{facility.name} · Hiện tại: {FACILITY_STATUS[facility.status]?.[0] || facility.status}</p>
      <fieldset className="radio-list">
        <legend className="field__label">Trạng thái mới</legend>
        {options.map((k) => (
          <label key={k} className={`radio-card${status === k ? " is-on" : ""}`}>
            <input type="radio" name="facility-status" value={k} checked={status === k} onChange={() => setStatus(k)} />
            <span><strong>{FACILITY_STATUS[k][0]}</strong><small>{STATUS_HELP[k]}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="hint">Cơ sở không bị xoá. Mở lại bất cứ lúc nào bằng cách chọn Đang hoạt động.</p>
      <Field label="Lý do (bắt buộc)" error={error}>
        <textarea rows={2} maxLength={255} value={reason} placeholder="Ví dụ: Sửa chữa hệ thống điện từ 01/11 đến 15/11" onChange={(e) => { setReason(e.target.value); setError(""); }} />
      </Field>
      <p className="hint">Lần đổi được ghi vào nhật ký hoạt động; khách và quản lý cơ sở nhận thông báo.</p>
      <div className="modal__actions">
        <Button variant="outline" onClick={onClose}>Huỷ</Button>
        <Button disabled={busy} onClick={submit}>{busy ? "Đang lưu…" : "Xác nhận"}</Button>
      </div>
    </Modal>
  );
}

// B05: danh sách cơ sở, thêm cơ sở, sửa thông tin, đổi trạng thái và mở báo cáo hiệu quả kinh doanh.
export default function FacilityManagementPage({ query }) {
  const { onApiError } = useApp();
  const load = useLoad(async () => {
    const [facilities, rates] = await Promise.all([businessApi.facilities(), businessApi.rates()]);
    return { facilities, rates };
  }, [], onApiError);
  const selectedId = Number(query.get("id"));
  const [editing, setEditing] = useState(null); // cơ sở đang sửa, hoặc { new: true } khi thêm
  const [statusOf, setStatusOf] = useState(null);
  const [flowEl, runChange] = useChangeFlow();
  const { notify } = useApp();
  return <main className="container page business-facilities">
    <header className="page-header page-header--tight"><div>
      <h1>Mạng lưới cơ sở</h1>
      <p>Theo dõi trạng thái hoạt động, sức chứa và người phụ trách toàn hệ thống.</p>
    </div></header>
    <Button className="btn--fit" onClick={() => setEditing({ new: true })}>+ Thêm cơ sở</Button>
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
            <Button variant="outline" onClick={() => setStatusOf(current)}>Đổi trạng thái</Button>
          </div>
        </section>}
        {editing && (
          <EditFacilityDialog
            facility={editing.new ? null : editing}
            runChange={runChange}
            onClose={() => setEditing(null)}
            onSaved={(warnings = []) => { setEditing(null); if (warnings.length) notify(warnings.join(" ")); load.reload(); }}
          />
        )}
        {statusOf && <FacilityStatusDialog facility={statusOf} runChange={runChange} onClose={() => setStatusOf(null)} onSaved={() => { setStatusOf(null); load.reload(); }} />}
        {flowEl}
      </>;
    }}</LoadState>
  </main>;
}
